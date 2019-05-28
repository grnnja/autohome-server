const express = require('express')

const Database = require('./Database.js')
const MQTTBroker = require('./MQTTBroker')
const HeaterController = require('./HeaterController')

const database = new Database()
const mqttBroker = new MQTTBroker()
const heaterController = new HeaterController(
  database.getCurrentGoalTemperature((err, row) => {
    if (err) {
      console.log(err)
    }
    heaterController.updateGoalTemperature(row.data)
  },
  database.getCurrentTemperature((err, row) => {
    if (err) {
      console.log(err)
    }
    heaterController.updateCurrentTemperature(row.data)
  })),
)

// add events to database. should remove later
database.serialize(() => {
  // may need to comment this stuff out if adding tables because readding tables takes a while
  // so it errors out
  database.addEventInfo('fan temperature', 'heater/fan/temperature', 'temperature sensor on sonoff fan controller', 'C')
  database.addEventInfo('heater goal temperature', 'heater/goalTemperature', '', 'C')
  database.addEventInfo('heater fan status', 'heater/fan/status', 'if fan is on then 1 if fan is off then 0, from sonoff', '')
})

// fired when a message is received
mqttBroker.on('published', (packet, client) => {
  console.log('published ', packet.topic, '\n', packet.payload)

  // log data to database if topic is in database
  // way cleaner than switch for each topic
  if (database.topics.includes(packet.topic)) {
    database.logEventData(packet.topic, Number(packet.payload))
    if (packet.topic === 'heater/fan/temperature') {
      heaterController.currentTemperature = Number(packet.payload)
    }
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

// express backend
const app = express()
const port = 3000

console.log('express port:\t', port);

app.post('/heater/goalTemperature', (req, res) => {
  console.log(req.params.newInterval)
  heaterController.setTemperature(req.body.temperature)
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
  mqttBroker.publish(message)
})

app.get('/off', (req, res) => {
  res.send('off')
  const message = {
    topic: 'heater/fan/control',
    payload: '0',
    qos: 2,
    retain: false,
  }
  mqttBroker.publish(message)
})
