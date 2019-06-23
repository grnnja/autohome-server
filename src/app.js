const express = require('express');
const WebSocket = require('ws');
require('dotenv').config();

const Database = require('./Database.js');
const MQTTBroker = require('./MQTTBroker');
const HeaterController = require('./HeaterController');

const webSocketServer = new WebSocket.Server({
  port: process.env.WEBSOCKET_SERVER_PORT,
});
const database = new Database();
const mqttBroker = new MQTTBroker();
const heaterController = new HeaterController();

// i'm not sure if this is good practice but to get data out of
// the database and into the heaterContoller object I would pass
// it in with a parameter in the constructor but since using
// sqlite3 to get data is async, and uses a callback, I don't
// think there is a way to pass this in using promises or something
// (not sure about this). So we are getting the data from the database
// then sending into the heaterController object
database.getCurrentGoalTemperature((err, row) => {
  if (err) {
    console.log(err);
  }
  heaterController.updateGoalTemperature(row.data);
});
database.getCurrentTemperature((err, row) => {
  if (err) {
    console.log(err);
  }
  heaterController.updateCurrentTemperature(row.data);
});

// // add events to database. should remove later
// database.serialize(() => {
//   // may need to comment this stuff out if adding tables because readding tables takes a while
//   // so it errors out
//   database.addEventInfo('fan temperature', 'heater/fan/temperature', 'temperature sensor on sonoff fan controller', 'C')
//   database.addEventInfo('heater goal temperature', 'heater/goalTemperature', '', 'C')
//   database.addEventInfo('heater fan status', 'heater/fan/status', 'if fan is on then 1 if fan is off then 0, from sonoff', '')
// })

// fired when a message is received
mqttBroker.on('published', (packet, client) => {
  console.log('published ', packet.topic, '\n', packet.payload);

  // log data to database if topic is in database
  // way cleaner than switch for each topic
  if (database.topics.includes(packet.topic)) {
    database.logEventData(packet.topic, Number(packet.payload));
    // not sure if using a switch is the best method to update heaterController with new temperature
    switch (packet.topic) {
      case 'heater/fan/temperature':
        heaterController.updateCurrentTemperature(Number(packet.payload));
        break;
      case 'heater/fan/goalTemperature':
        heaterController.updateGoalTemperature(Number(packet.payload));
        break;
      default:
        break;
    }
  } else {
    console.log('unknown topic ', packet.topic);
  }
});

// express backend
const app = express();
const port = process.env.EXPRESS_PORT;

app.use(express.json()); // for parsing application/json
app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

console.log('express port:\t', port);

// app.post('/heater/goalTemperature', (req, res) => {
//   if (Number.isNaN(Number(req.body.goalTemperature)) !== true) {
//     mqttBroker.publishGoalTemperature(req.body.goalTemperature)
//     console.log('heater goal temperature changed', req.body.goalTemperature)
//     res.send(`temperature changed: ${req.body.goalTemperature}`);
//   } else {
//     res.send('invalid request: goalTemperature in request is not a number')
//     console.log('invalid goalTemperature request: ', req.body)
//   }
// })

// app.post('/heater/fan/status', (req, res) => {
//   mqttBroker.publishFanState(req.body.status)
//   console.log('fan status changed', req.body.status)
//   res.send(`fan status changed: ${req.body.status}`);
// })

// app.get('/changeInterval/:newInterval', (req, res) => {
//   motor.servoWrite(req.params.newInterval)
//   res.send(`new interval:  ${req.params.newInterval}`)
// })

app.listen(port, () => console.log(`Example app listening on port ${port}!`));

// websocket server
webSocketServer.on('open', (ws) => {
  console.log('new websocket client connected');

  ws.on('message', () => {
    console.log('websocket message recieved');
  });

  ws.on('close', () => {
    console.log('websocket client disconnected');
  });
});
