const { Gpio } = require('pigpio-mock');

const OFF = 0;
const ON = 1;

module.exports = class HeaterController {
  constructor() {
    // servo motor data line
    this.motor = new Gpio(10, { mode: Gpio.OUTPUT });
    // power mosfet to turn on and off motor
    // when testing turning the heater on and off, the motor would get like 90%
    // of the way there then stop and make a loud sound, drain a lot of power (~7W) and
    // crash the pi. So now after a second, we turn off the motor
    this.motorControl = new Gpio(2, { mode: Gpio.OUTPUT });
    this.goalTemperature = 0;
    this.currentTemperature = 0;
    this.heaterState = OFF;
  }

  setHeaterState(state) {
    this.heaterState = state;
    this.motorControl.digitalWrite(1);
    this.motor.servoWrite(state ? 2500 : 1500);
    setTimeout(() => {
      console.log('servo off');
      this.motorControl.digitalWrite(0);
      this.motor.servoWrite(0);
    }, 1000);
  }

  updateHeaterState() {
    const temperatureThreshold = 3;
    const temperatureDifference = this.currentTemperature - this.goalTemperature;
    if ((this.heaterState === OFF
    && temperatureDifference >= temperatureThreshold)
    || (this.heaterState === ON
    && temperatureDifference <= temperatureThreshold)) {
      this.setHeaterState(!this.heaterState);
      console.log('heater state changed', this.heaterState);
    }
  }

  updateGoalTemperature(newGoalTemperature) {
    if (newGoalTemperature !== this.goalTemperature) {
      this.goalTemperature = newGoalTemperature;
      this.updateHeaterState();
    }
  }

  updateCurrentTemperature(newCurrentTemperature) {
    if (newCurrentTemperature !== this.currentTemperature) {
      this.currentTemperature = newCurrentTemperature;
      this.updateHeaterState();
    }
  }
};
