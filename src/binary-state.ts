export class BinaryState {
  private state: number = 0x00;
  private bits: number = 8;
  
  constructor(state: number = 0x00, bits: number = 8) {
    this.state = state;
    this.bits = bits;
  }

  public update(state: number): BinaryState {
    this.state = state;
    return this;
  }

  public get(): number {
    return this.state;
  }

  public getHex(): string {
    return this.state.toString(16).padStart(this.bits / 4, '0').slice(-this.bits / 4);
  }

  public getInverted(): BinaryState {
    return new BinaryState(~this.state & 0xff);
  }

  public setAllOn(): BinaryState {
    this.state = 0xffffffff;
    return this;
  }

  public setAllOff(): BinaryState {
    this.state = 0;
    return this;
  }

  public getAt(idx: number): boolean {
    return (this.state & (1 << idx)) > 0;
  }

  public updateAt(idx: number, value: boolean): BinaryState {
    if (value) {
      this.state |= (1 << idx);
    } else {
      this.state &= ~(1 << idx);
    }
    return this;
  }

  public updateString(value: string): BinaryState {
    this.state = parseInt(value, 2);
    return this;
  }

  public getString(): string {
    return this.state.toString(2).padStart(this.bits, '0').slice(-this.bits);
  }
}