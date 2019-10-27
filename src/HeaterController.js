/**
 * @fileoverview Controls heater motor with temperature input
 */
const { Gpio } = require('pigpio-mock');

const OFF = 0;
const ON = 1;

/**
 * Controls heater servo motor with temperature inputs
 */
class HeaterController {
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

  /**
   * doesnt move motor if state hasnt changed
   * @param {bool} newState sets the heater state
   */
  setHeaterState(newState) {
    console.log('heater state set to: ', newState);
    if (newState !== this.heaterState) {
      this.heaterState = newState;
      this.motorControl.digitalWrite(1);
      this.motor.servoWrite(newState ? 2500 : 1500);
      setTimeout(() => {
        console.log('servo off');
        this.motorControl.digitalWrite(0);
        this.motor.servoWrite(0);
      }, 1000);
    }
  }

  /**
   * checks to see if motor should be on or off
   * called by updateGoalTemperature
   */
  updateHeaterState() {
    const temperatureThreshold = 3;
    const temperatureDifference = Math.abs(this.currentTemperature - this.goalTemperature);
    if (temperatureDifference >= temperatureThreshold) {
      if (this.currentTemperature > this.goalTemperature) {
        this.setHeaterState(OFF);
      } else {
        this.setHeaterState(ON);
      }
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

module.exports = HeaterController;
