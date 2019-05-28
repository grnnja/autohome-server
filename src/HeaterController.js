const { Gpio } = require('pigpio-mock')

const OFF = 0
const ON = 1

module.exports = class HeaterController {
  constructor() {
    this.motor = new Gpio(10, { mode: Gpio.OUTPUT })
    this.motorControl = new Gpio(2, { mode: Gpio.OUTPUT })
    this.goalTemperature = 0
    this.currentTemperature = 0
    this.heaterState = OFF
  }

  setHeaterState(state) {
    this.heaterState = state
    this.motorControl.digitalWrite(1)
    this.motor.servoWrite(state ? 2500 : 1500);
    setTimeout(() => {
      console.log('servo off')
      this.motorControl.digitalWrite(0)
      this.motor.servoWrite(0)
    }, 1000)
  }

  updateHeaterState() {
    const temperatureThreshold = 3;
    if ((this.heaterState === OFF
    && this.currentTemperature - this.goalTemperature >= temperatureThreshold)
    || (this.heaterState === ON
    && this.goalTemperature - this.currentTemperature >= temperatureThreshold)) {
      this.setHeaterState(!this.heaterState)
      console.log('heater state changed', this.heaterState)
    }
  }

  updateGoalTemperature(newGoalTemperature) {
    if (newGoalTemperature !== this.goalTemperature) {
      this.goalTemperature = newGoalTemperature
      this.updateHeaterState()
    }
  }

  updateCurrentTemperature(newCurrentTemperature) {
    if (newCurrentTemperature !== this.currentTemperature) {
      this.currentTemperature = newCurrentTemperature
      this.updateHeaterState()
    }
  }
}
