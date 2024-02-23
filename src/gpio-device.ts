export type GPIODeviceState = 'uninitialized' | 'initialized';

export interface IGPIODevice {
  init(): Promise<void>;
  updateGPICount(gpiCount: number): Promise<void>;
  cleanup(): void;
  sendGPO(gpo: number): void;
  invertInputs: boolean;
  invertOutputs: boolean;
  onGPI(gpi: number): void;
  state: GPIODeviceState;
  onLog: (level: string, message: string) => void;
  onError: (error: Error) => void;
}