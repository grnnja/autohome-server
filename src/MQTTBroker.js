/**
 * @overview mosca MQTTBroker
 */

const mosca = require('mosca');

/**
 * Wraps mosca MQTTBroker has functions to publish information
 */
class MQTTBroker {
  constructor() {
    // mosca mqtt server
    this.settings = {
      port: Number(process.env.MQTT_BROKER_PORT),
    };
    this.broker = new mosca.Server(this.settings);

    this.broker.on('clientConnected', (client) => {
      console.log('client connected ', client.id);
    });

    this.broker.on('ready', (() => {
      console.log('Mosca on port: ', this.settings.port);
    }));
  }

  /**
   * @param {1 or 0} state takes 1 or 0 and sends MQTT message
   */
  publishFanState(state) {
    const message = {
      topic: 'heater/fan/control',
      payload: `${state}`,
      qos: 2,
      retain: false,
    };
    this.broker.publish(message);
  }

  publishGoalTemperature(temperature) {
    const message = {
      topic: 'heater/goalTemperature',
      payload: `${temperature}`,
      qos: 2,
      retain: false,
    };
    this.broker.publish(message);
  }

  /**
  * exposes on method from MQTT broker
  * fires callback when message parameter matches input message
  * @param {string} message message to match
  * @param {function} callback what is fired when message matches
  */
  on(message, callback) {
    this.broker.on(message, callback);
  }
}

module.exports = MQTTBroker;
