import "mocha";
import { expect } from 'chai';
import { NumatoDevice } from '../src/numato-device';

describe('GpiCountToBinaryState', () => {
  it('should set correct state from a gpi number', () => {
    const state = NumatoDevice.getBinaryStateFromGpiCount(3, 8);
    expect(state.getString()).to.equal('00011111');
  });

  
});