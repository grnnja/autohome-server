const mosca = require('mosca')

module.exports = class MQTTBroker {
  constructor() {
    // mosca mqtt server
    this.settings = {
      port: 1883,
    }

    this.broker = new mosca.Server(this.settings)

    this.broker.on('clientConnected', (client) => {
      console.log('client connected ', client.id);
    });

    this.broker.on('ready', (() => {
      console.log('Mosca on port: ', this.settings.port);
    }));
  }

  publishFanState(state) {
    const message = {
      topic: 'heater/fan/control',
      payload: `${state}`,
      qos: 2,
      retain: false,
    }
    this.broker.publish(message)
  }

  publishGoalTemperature(temperature) {
    const message = {
      topic: 'heater/goalTemperature',
      payload: `${temperature}`,
      qos: 2,
      retain: false,
    }
    this.broker.publish(message)
  }

  on(message, callback) {
    this.broker.on(message, callback)
  }
}
