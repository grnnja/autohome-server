const express = require('express')
const { Gpio } = require('pigpio-mock')
const mosca = require('mosca')

const Database = require('./Database.js')

const database = new Database()

// mosca mqtt server
const settings = {
  port: 1883,
}

const mqttServer = new mosca.Server(settings)

database.serialize(() => {
  // may need to comment this stuff out if adding tables because readding tables takes a while
  // so it errors out
  database.addEventInfo('fan temperature', 'heater/fan/temperature', 'temperature sensor on sonoff fan controller', 'C')
  database.addEventInfo('heater goal temperature', 'heater/goalTemperature', '', 'C')
  database.addEventInfo('heater fan status', 'heater/fan/status', 'if fan is on then 1 if fan is off then 0, from sonoff', '')
})
mqttServer.on('clientConnected', (client) => {
  console.log('client connected', client.id);
});

// fired when a message is received
mqttServer.on('published', (packet, client) => {
  console.log('Published', packet);
  console.log(packet.payload)

  // log data to database if topic is in database
  // way cleaner than switch for each topic
  console.log('topics: ', database.topics)
  if (database.topics.includes(packet.topic)) {
    database.logEventData(packet.topic, Number(packet.payload))
  } else {
    console.log('unknown topic ', packet.topic)
  }

  // const message = {
  //   topic: '/heater/fan',
  //   payload: '0',
  //   qos: 2,
  //   retain: false,
  // }

  // if (packet.topic === '/heater/temperature') {
  //   if (parseFloat(packet.payload.toString()) > 25) {
  //     // if odd then send on
  //     if ((parseFloat(packet.payload.toString()) - 0.4) % 2) {
  //       message.payload = '1'
  //       server.publish(message)
  //     } else {
  //       message.payload = '0'
  //       server.publish(message)
  //     }
  //     console.log('message sent')
  //   }
  // }
});

// fired when the mqtt server is ready
function setup() {
  console.log('Mosca on port:  ', settings.port);
}

mqttServer.on('ready', setup);


// express backend
const app = express()
const port = 3000

console.log('express port:\t', port);

const motor = new Gpio(10, { mode: Gpio.OUTPUT })
const motorControl = new Gpio(2, { mode: Gpio.OUTPUT })

app.get('/interval/:newInterval', (req, res) => {
  console.log(req.params.newInterval)
  motorControl.digitalWrite(1)
  motor.servoWrite(req.params.newInterval);

  setTimeout(() => {
    console.log('servo off')
    motorControl.digitalWrite(0)
    motor.servoWrite(0)
  }, 1000)

  res.send('Hello World!');
})

app.get('/changeInterval/:newInterval', (req, res) => {
  motor.servoWrite(req.params.newInterval)
  res.send(`new interval:  ${req.params.newInterval}`)
})

app.listen(port, () => console.log(`Example app listening on port ${port}!`))

app.get('/on', (req, res) => {
  res.send('on')
  const message = {
    topic: 'heater/fan/control',
    payload: '1',
    qos: 2,
    retain: false,
  }
  mqttServer.publish(message)
})

app.get('/off', (req, res) => {
  res.send('off')
  const message = {
    topic: 'heater/fan/control',
    payload: '0',
    qos: 2,
    retain: false,
  }
  mqttServer.publish(message)
})
