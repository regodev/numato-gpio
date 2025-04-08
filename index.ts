import { NumatoDevice } from './src/numato-device'

async function init() {
  const device = new NumatoDevice(8, 6);
  device.onLog = (level, message) => {
    console.log(level, message);
  }

  await device.init(true);
  device.invertInputs = true;
  
  console.log('Device initialized');

  let toggle = false;

  setInterval(() => {
    device.setGPO(0, toggle);
    device.setGPO(1, toggle);

    toggle = !toggle;
  }, 3000);

  device.onGPI = (gpi, value) => {
    console.log(`GPI ${gpi} changed to ${value}`);
  }
}

init().catch(console.error);