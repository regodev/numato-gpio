import { ReadlineParser, SerialPort } from 'serialport';
import { BinaryState } from './binary-state';
import { GPIODeviceState, IGPIODevice } from './gpio-device';

const NUMATO_VENDOR_ID = '2A19';
const NUMATOR_PRODUCT_ID = '0800';
const POLL_INTERVAL = 10;
const GPO_SPRINGBACK = 1000;
const GPI_DEBOUNCE = 300;

interface ICommand {
  data: string;
  isReadAll?: boolean;
}

namespace Command {
  export const readAll = () => ({ data: 'gpio readall', isReadAll: true });
  export const writeAll = (state: BinaryState) => ({ data: `gpio writeall ${state.getHex()}` });
  export const setIODir = (state: BinaryState) => ({ data: `gpio iodir ${state.getHex()}` });
  export const setMask = (state: BinaryState) => ({ data: `gpio iomask ${state.getHex()}` });
  export const setGPO = (gpo: number, invert: boolean) => ({ data: `gpio ${invert ? 'set' : 'clear'} ${gpo}` });
  export const clearGPO = (gpo: number, invert: boolean) => ({ data: `gpio ${invert ? 'clear' : 'set'} ${gpo}` });
  export const readGPI = (gpi: number) => ({ data: `gpio read ${gpi}` });
  export const readVersion = () => ({ data: 'ver' });
  export const getPowerOnInfo = () => ({ data: 'info' });
  export const getId = () => ({ data: 'id get' });
  export const setId = (id: string) => ({ data: `id set ${id}` });
}

export class NumatoDevice implements IGPIODevice {
  private port?: SerialPort;
  private parser?: ReadlineParser;
  private commandProcHandle?: NodeJS.Timeout;
  private connectionChecker?: NodeJS.Timeout;
  
  private commandQueue: ICommand[] = [];
  private gpioState;
  private portCount: number;
  private gpiIndex: number;
  private _state: GPIODeviceState = 'uninitialized';
  private lastTrigs: number[] = [];

  public invertInputs: boolean = false;
  public invertOutputs: boolean = false;

  public onGPI: (gpi: number) => void = () => { };
  public onLog: (level: string, message: string) => void;
  public onError: (error: Error) => void;

  public get state(): GPIODeviceState {
    return this._state;
  }
  
  private gpioDir;

  private waitingForReadAll = false;
  private lastReceived = Date.now();

  constructor(ports: number, gpis: number) {
    this.portCount = ports;
    this.gpioState = new BinaryState(0, ports);
    this.gpioDir = NumatoDevice.getBinaryStateFromGpiCount(gpis, ports);
    this.gpiIndex = ports - gpis;
    this.lastTrigs = new Array(ports).fill(0);

    let loggedReconnect = false;
    this.connectionChecker = setInterval(async () => {
      if (!this.port) {
        this._state = 'uninitialized';
        if (!loggedReconnect) {
          this.log('info', 'Device not initialized, trying to reconnect..');
          loggedReconnect = true;
        }
        try {
          await this.init(false);
          this.log('info', 'Numato device reconnected');
          loggedReconnect = false;
        } catch (err) {
        }
      }
    }, 1000);
  }

  private log(level: string, message: string) {
    if (this.onLog) {
      this.onLog(level, message);
    }
  }

  private error(err: Error) {
    if (this.onError) {
      this.onError(err);
    }
  }

  public static getBinaryStateFromGpiCount(gpis: number, ports: number): BinaryState {
    /* 
    Documentation states that 1 should be input
    https://numato.com/kb/understanding-readallwriteall-commands-gpio-modules/
    But in practice, 0 is input and 1 is output
    */
    const state = new BinaryState(0xff, ports);
    for (let i = ports - gpis; i < ports; i++) {
      state.updateAt(i, false);
    }
    return state;
  }

  private async openPort(path: string): Promise<SerialPort> {
    return new Promise((resolve, reject) => {
      const port = new SerialPort({ path, baudRate: 9600, rtsMode: 'enable', autoOpen: false });
      port.on('data', (data) => this.receiveData(data.toString()));

      port.on('error', (err) => {
        this.error(err);
        
        if (port.isOpen) {
          this.cleanup();
        }
        this._state = 'uninitialized';
      });
      port.open((err) => {
        if (err) {
          return reject(err);
        } else {
          return resolve(port);
        }
      });
    });
  }

  public async init(log: boolean = true): Promise<void> {
    this.commandQueue = [];
    this._state = 'uninitialized';

    if (log) this.log('info', 'Initializing..')

    const path = await NumatoDevice.findDevice();
    if (log) this.log('info', `Found Numato device at ${path}`);

    this.port = await this.openPort(path);
    this.lastReceived = Date.now();
   
    this.commandProcHandle = setInterval(() => this.process(), POLL_INTERVAL);
    this.queueCommand(Command.setMask(new BinaryState(0, this.portCount).setAllOn()));
    this.queueCommand(Command.writeAll(new BinaryState(0xff, this.portCount)));
    this.queueCommand(Command.setIODir(this.gpioDir));

    for (let i = 0; i < this.gpiIndex; i++) {
      this.queueCommand(Command.clearGPO(i, this.invertOutputs));
    }

    this._state = 'initialized';
  }

  public async updateGPICount(gpiCount: number): Promise<void> {
    this.gpiIndex = this.portCount - gpiCount;
    this.gpioDir = NumatoDevice.getBinaryStateFromGpiCount(gpiCount, this.portCount);

    const gpoString = this.gpiIndex > 0 ? `0-${this.gpiIndex - 1}` : 'none';
    const gpiString = this.gpiIndex < this.portCount ? `${this.gpiIndex}-${this.portCount - 1}` : 'none';
    this.log('info', `Numato ${this.portCount} ports. GPOs: ${gpoString} & GPIs: ${gpiString}`)

    if (this._state === 'initialized') {
      this.queueCommand(Command.setMask(new BinaryState(0, this.portCount).setAllOn()));
      this.queueCommand(Command.writeAll(new BinaryState(0xff, this.portCount)));
      this.queueCommand(Command.setIODir(this.gpioDir));

      for (let i = 0; i < this.gpiIndex; i++) {
        this.queueCommand(Command.clearGPO(i, this.invertOutputs));
      }
    }
  }

  private process() {
    try {
      if (Date.now() > this.lastReceived + 3000) {
        this.error(new Error('No data received for 3 seconds, closing port'));
        this.cleanup();
        this._state = 'uninitialized';
        return;
      }

      const cmd = this.commandQueue.splice(0, 1);
      if (cmd.length > 0) {
        this.writeCommand(cmd[0]);
      } else {
        this.writeCommand(Command.readAll());
      }
    } catch (err) {
    }
  }

  private queueCommand(command: ICommand) {
    this.commandQueue.push(command);
  }

  private writeCommand(command: ICommand) {
    this.validatePort();
    this.port?.write(command.data + '\r', 'ascii', (err) => {
      if (err) {
        this.error(err);
        this.port?.close();
        this._state = 'uninitialized';
      }
    });
  }

  private receiveData(data: string) {
    this.lastReceived = Date.now();
  
    if (data.trim() === '>gpio readall') {
      this.waitingForReadAll = true;
      return;
    }

    if (this.waitingForReadAll) {
      this.waitingForReadAll = false;
      let newState = new BinaryState(parseInt(data, 16), this.portCount);

      if (this.invertInputs) {
        newState = newState.getInverted();
      }

      for (let i = this.gpiIndex; i < this.portCount; i++) {
        let prev = this.gpioState.getAt(i);
        if (newState.getAt(i) && !prev) {
          const now = Date.now();
          if (now - this.lastTrigs[i] > GPI_DEBOUNCE) {
            this.onGPI(i);
            this.lastTrigs[i] = now;
          }
        }
      }
      this.gpioState = newState;
    }
  }

  private validatePort() {
    if (!this.port) throw new Error('Device not initialized');
    if (!this.port.isOpen) throw new Error('Device not open');
  }

  public pulseGPO(gpo: number, resetTime: number = GPO_SPRINGBACK) {
    try {
      if ((gpo < 0) || (gpo >= this.gpiIndex)) throw new Error(`Invalid GPO number: ${gpo}, should be between 0 and ${this.gpiIndex - 1}`);
      this.validatePort();
      this.gpioState.updateAt(gpo, true);
      this.queueCommand(Command.setGPO(gpo, this.invertOutputs));

      setTimeout(() => {
        this.gpioState.updateAt(gpo, false);
        this.queueCommand(Command.clearGPO(gpo, this.invertOutputs));
      }, resetTime);
    } catch (err: any) {
      this.log('error', err.message);
      this.error(err);
    }
  }

  public setGPO(gpo: number, value: boolean) {
    try {
      if ((gpo < 0) || (gpo >= this.gpiIndex)) throw new Error(`Invalid GPO number: ${gpo}, should be between 0 and ${this.gpiIndex - 1}`);
      this.validatePort();
      this.gpioState.updateAt(gpo, value);
      this.queueCommand(value ? Command.setGPO(gpo, this.invertOutputs) : Command.clearGPO(gpo, this.invertOutputs));
    } catch (err: any) {
      this.log('error', err.message);
      this.error(err);
    }
  }

  public cleanup() {
    clearInterval(this.commandProcHandle!);
    if (this.port?.isOpen) {
      this.port?.close();
    }
    this.port = undefined;
  }

  public static async findDevice(): Promise<string> {
    const ports = await SerialPort.list();
    const port = ports.find(p => p.vendorId === NUMATO_VENDOR_ID && p.productId === NUMATOR_PRODUCT_ID);
    if (port) {
      return port.path;
    }
    throw new Error('Numato device not found');
  }
}