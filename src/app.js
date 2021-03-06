const express = require('express');
const cors = require('cors');
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
  const date = new Date();
  console.log('published', packet.topic, '\n', packet.payload, 'number: ', Number(packet.payload), 'at', date.toLocaleTimeString());

  // log data to database if topic is in database
  // way cleaner than switch for each topic
  if (database.topics.includes(packet.topic)) {
    database.logEventData(packet.topic, Number(packet.payload));
    // not sure if using a switch is the best method to update heaterController with new temperature
    switch (packet.topic) {
      case 'heater/fan/temperature':
        heaterController.updateCurrentTemperature(Number(packet.payload));
        break;
      case 'heater/goalTemperature':
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
app.use(cors());

console.log('express port:\t', port);

app.get('/fan/temperature', (req, res) => {
  if (!/^[0-9]*$/.test(req.query.start)) {
    res.status(400).send({
      message: 'start value is not a number',
    });
    return;
  }
  if (!/^[0-9]*$/.test(req.query.end)) {
    res.status(400).send({
      message: 'end value is not a number',
    });
    return;
  }
  // res.send('fan temperatrure request recieved');
  database.getGraphData(1, req.query.start, req.query.end, (err, data) => {
    if (err) {
      res.status(500).send(`sql error: ${err}`);
      return;
    }
    res.status(200).send(data.map((datum) => [datum.time, datum.data]));
  });
});

// sets goal temeprature from post request
app.post('/heater/goalTemperature', (req, res) => {
  if (Number.isNaN(Number(req.body.goalTemperature)) !== true) {
    mqttBroker.publishGoalTemperature(req.body.goalTemperature);
    console.log('heater goal temperature changed', req.body.goalTemperature);
    res.status(202);
    res.send(`temperature changed to: ${req.body.goalTemperature}`);
  } else if (req.body.goalTemperature === undefined) {
    res.status(400);
    res.send('invalid request: goalTemperature is undefined')
  } else {
    res.status(400);
    res.send('invalid request: goalTemperature in request is not a number');
    console.log('invalid goalTemperature request: ', req.body);
  }
});

app.post('/heater/fan/control', (req, res) => {
  switch (req.body.status) {
    case 1:
      mqttBroker.publishFanState(1);
      res.status(202);
      break;
    case 0:
      mqttBroker.publishFanState(0);
      res.status(202);
      break;
    case undefined:
      res.status(400);
      res.send('invalid request: status is not defined');
      break;
    default:
      res.status(400);
      res.send('invalid request: status is not 1 or 0');
      break;
  }
});

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
