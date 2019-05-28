const mosca = require('mosca')

module.exports = class MQTTBroker {
  constructor() {
    // mosca mqtt server
    this.settings = {
      port: 1883,
    }

    this.broker = new mosca.Server(this.settings)

    this.broker.on('clientConnected', (client) => {
      console.log('client connected', client.id);
    });

    this.broker.on('ready', (() => {
      console.log('Mosca on port:  ', this.settings.port);
    }));
  }

  on(message, callback) {
    this.broker.on(message, callback)
  }
}
