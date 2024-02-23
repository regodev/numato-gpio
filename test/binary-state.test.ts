import { BinaryState } from '../src/binary-state';
import "mocha";
import { expect } from 'chai';

describe('BinaryState', () => {
  it('should be able to set and get a bit', () => {
    const state = new BinaryState();
    state.updateAt(0, true);
    expect(state.getAt(0)).to.be.true;
  });
  it('should be able to set and get some more bits', () => {
    const state = new BinaryState();
    state.updateAt(3, true);
    expect(state.getAt(0)).to.be.false;
    expect(state.getAt(1)).to.be.false;
    expect(state.getAt(2)).to.be.false;
    expect(state.getAt(3)).to.be.true;
  });

  it('should be able to set a binary string', () => {
    const state = new BinaryState();
    state.updateString('11101010');
    expect(state.getAt(0)).to.be.false;
    expect(state.getAt(1)).to.be.true;
    expect(state.getAt(2)).to.be.false;
    expect(state.getAt(3)).to.be.true;
    expect(state.getAt(4)).to.be.false;
    expect(state.getAt(5)).to.be.true;
    expect(state.getAt(6)).to.be.true;
    expect(state.getAt(7)).to.be.true;
  });

  it('should be able to get a binary string', () => {
    const state = new BinaryState();
    state.updateAt(0, true);
    state.updateAt(1, false);
    state.updateAt(2, true);
    state.updateAt(3, false);
    state.updateAt(4, true);
    state.updateAt(5, false);
    state.updateAt(6, true);
    state.updateAt(7, false);
    expect(state.getString()).to.equal('01010101');
  });

  it('should be able to invert a state', () => {
    const state = new BinaryState();
    state.updateAt(0, true);
    state.updateAt(1, true);
    state.updateAt(2, true);
    state.updateAt(3, false);
    state.updateAt(4, true);
    state.updateAt(5, false);
    state.updateAt(6, true);
    state.updateAt(7, false);
    const inverted = state.getInverted();
    expect(state.getString()).to.equal('01010111');
    expect(inverted.getString()).to.equal('10101000');
  });

  it('should be able to set all bits on', () => {
    const state = new BinaryState();
    state.setAllOn();
    expect(state.getString()).to.equal('11111111');
  });

  it('should be able to set all bits off', () => {
    const state = new BinaryState();
    state.setAllOn();
    state.setAllOff();
    expect(state.getString()).to.equal('00000000');
  });

  it('should be able to set and get a hex value', () => {
    const state = new BinaryState();
    state.update(65534);
    expect(state.getHex()).to.equal('fe');
  });

  it('should be able to set and get a hex value', () => {
    const state = new BinaryState(65534, 16);
    expect(state.getHex()).to.equal('fffe');
  });

  it('should be able to set a 16 bit value and get a binary string', () => {
    const state = new BinaryState(65534, 16);
    expect(state.getString()).to.equal('1111111111111110');
  });
});
