export type GPIODeviceState = 'uninitialized' | 'initialized';

export interface IGPIODevice {
  init(): Promise<void>;
  updateGPICount(gpiCount: number): Promise<void>;
  cleanup(): void;
  pulseGPO(gpo: number, resetTime?: number): void;
  setGPO(gpo: number, value: boolean): void;
  invertInputs: boolean;
  invertOutputs: boolean;
  onGPI(gpi: number, value: boolean): void;
  state: GPIODeviceState;
  onLog: (level: string, message: string) => void;
  onError: (error: Error) => void;
}