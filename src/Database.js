const sqlite3 = require('sqlite3');
const schedule = require('node-schedule');

// TODO: add ability to add/change/delete events in client and make this not hardcoded
const eventInfo = {
  fanTemperature: {
    id: 1,
    firstEntryTime: undefined,
  },
  heaterGoalTemperature: {
    id: 2,
    firstEntryTime: undefined,
  },
  heaterFanStatus: {
    id: 2,
    firstEntryTime: undefined,
  },
};

module.exports = class Database {
  constructor() {
    this.database = new sqlite3.Database(process.env.DATABASE_PATH);

    // create event_info table
    this.database.run(
      `CREATE TABLE IF NOT EXISTS event_info(
        event_id     INTEGER PRIMARY KEY,
        units         VARCHAR(20),
        description   TEXT,
        name          TEXT,
        topic         TEXT,
        UNIQUE(name)
      );`,
    );

    // create event_data table
    this.database.run(
      `CREATE TABLE IF NOT EXISTS event_data(
        data_id   INTEGER PRIMARY KEY,
        event_id  INT NOT NULL,
        data      FLOAT,
        time      DATETIME,
        FOREIGN KEY(event_id) REFERENCES sensor_info(event_id)
      );`,
    );

    // create event_data_hour table
    this.database.run(
      `CREATE TABLE IF NOT EXISTS event_data_hour(
        data_id   INTEGER PRIMARY KEY,
        event_id  INT NOT NULL,
        data      FLOAT,
        time      DATETIME,
        UNIQUE(time)
        FOREIGN KEY(event_id) REFERENCES sensor_info(event_id)
      );`,
    );

    // create event_data_day table
    this.database.run(
      `CREATE TABLE IF NOT EXISTS event_data_day(
        data_id   INTEGER PRIMARY KEY,
        event_id  INT NOT NULL,
        data      FLOAT,
        time      DATETIME,
        UNIQUE(time)
        FOREIGN KEY(event_id) REFERENCES sensor_info(event_id)
      );`,
    );

    // create event_data_month table
    this.database.run(
      `CREATE TABLE IF NOT EXISTS event_data_month(
        data_id   INTEGER PRIMARY KEY,
        event_id  INT NOT NULL,
        data      FLOAT,
        time      DATETIME,
        UNIQUE(time)
        FOREIGN KEY(event_id) REFERENCES sensor_info(event_id)
      );`,
    );

    // this.database.run(`

    //   `);

    // will get topics from database then when we recieve mqtt messages we will check against topics
    // in database to see if we should send data to database
    this.getTopics((err, eventTopics) => {
      if (err) {
        console.log(err);
      } else {
        this.topics = eventTopics.map(x => x.topic);
      }
    });

    // if process.env.AVERAGE_DATA_ON_STARTUP is true then
    // update month, day, hour tables if they need to be updated
    if (process.env.AVERAGE_DATA_ON_STARTUP) {
      this.serialize(() => {
        this.averageEventData(eventInfo.fanTemperature.id, 'hour', -1);
        this.averageEventData(eventInfo.fanTemperature.id, 'day', -1);
        this.averageEventData(eventInfo.fanTemperature.id, 'month', -1);
      });
    }

    // evey hour, day, month update average tables
    schedule.scheduleJob('0 * * * *', (time) => {
      console.log('table average job fired at ', time);
      this.serialize(() => {
        // every time do hour
        this.averageEventData(eventInfo.fanTemperature.id, 'hour', 1);
        // if zeroth hour (12 pm) average for day
        if (time.getHours() === 0) {
          this.averageEventData(eventInfo.fanTemperature.id, 'day', 1);
          // if zeroth hour and first day of month then average previous month
          if (time.getDate() === 1) {
            this.averageEventData(eventInfo.fanTemperature.id, 'month', 1);
          }
        }
      });
    });
  }

  // adds event info
  addEventInfo(name, topic, description, units, callback) {
    this.database.run(
      `INSERT OR IGNORE INTO event_info (units, description, name)
      VALUES ('$units', '$description', '$name')
      ON CONFLICT(name) DO UPDATE
      SET units='$units', description='$description', topic='$topic'
      WHERE name='$name';`, {
        $units: units,
        $description: description,
        $topic: topic,
      },
      callback,
    );
  }

  // logs event data
  logEventData(topic, data, callback) {
    this.database.run(
      `INSERT INTO event_data
      (event_id, data, time)
      VALUES (
        (SELECT event_id
          FROM event_info
          WHERE event_info.topic IS $topic),
        $data,
        datetime('now', 'localtime'))`, {
        $topic: topic,
        $data: data,
      },
      callback,
    );
  }

  getTopics(callback) {
    this.database.all(`
      SELECT topic FROM event_info
      WHERE topic IS NOT NULL
    `, callback);
  }

  getCurrentGoalTemperature(callback) {
    this.database.get(
      `SELECT data FROM event_data
      WHERE event_id IS $heaterGoalTemperature
      ORDER BY time DESC`, {
        $heaterGoalTemperature: eventInfo.heaterGoalTemperature.id,
      },
      callback,
    );
  }

  getCurrentTemperature(callback) {
    this.database.get(
      `SELECT data FROM event_data
      WHERE event_id IS $fanTemperature
      ORDER BY time DESC`, {
        $fanTemperature: eventInfo.fanTemperature.id,
      },
      callback,
    );
  }

  // gets time of first event with event id
  getFirstEventTime(eventID, callback) {
    console.log('eventid: ', eventID);
    this.database.get(`
      SELECT time FROM event_data
      WHERE event_id IS $eventID
      AND time IS NOT NULL
      ORDER BY time ASC
      LIMIT 1
    `, {
      $eventID: eventID,
    },
    callback);
  }

  // gets data for graphing from any of the data tables
  getAverageData(eventID, start, end, timeScale, callback) {
    let timeScaleWithUnderscore = '';
    if (timeScale !== '') {
      timeScaleWithUnderscore = `_${timeScale}`;
    }
    const tableName = `event_data${timeScaleWithUnderscore}`;
    // for debugging:
    // this.database.on('trace', (stringSent) => {console.log('string sent: ', stringSent)})

    // for some reason you cannot do the table name as a parameter with $tableName: tableName
    // in the second parameter
    // so this doesnt sanatize the input but I'm hoping it is safe because
    // I don't know what else to do
    this.database.all(`
      SELECT time, data FROM ${tableName}
      WHERE event_id IS $eventID
      AND time IS NOT NULL AND time BETWEEN datetime($start, 'unixepoch', 'localtime') AND datetime($end, 'unixepoch', 'localtime')
      ORDER BY time ASC
      LIMIT 10000;
    `, {
      $eventID: eventID,
      $start: start,
      $end: end,
    },
    callback);
  }

  // aggregates data based on event_id, time and number of averages to compute
  // set numberOfAverages to -1 to compute averages for all values

  averageEventData(eventID, timeScale, numberOfAverages) {
    // we convert into the date format that we want then add on a string so it
    // complies with sqlite's time string formats
    const tableName = `event_data_${timeScale}`;
    let datetimeFormat = '';
    let addedString = '';
    switch (timeScale) {
      case 'hour':
        datetimeFormat = '%Y-%m-%d %H';
        addedString = ':00:00';
        break;
      case 'day':
        datetimeFormat = '%Y-%m-%d';
        addedString = ' 00:00:00';
        break;
      case 'month':
        datetimeFormat = '%Y-%m';
        addedString = '-00 00:00:00';
        break;
      default:
        console.log('error: unknown aggregateEventData timeScale');
        return;
    }
    this.database.run(`
    INSERT INTO ${tableName} (data, time, event_id)
      SELECT ROUND(AVG(data), 1) AS data, STRFTIME('${datetimeFormat}', time) || '${addedString}' AS time, event_id from event_data
        WHERE time IS NOT NULL AND event_id IS $eventID
        GROUP BY STRFTIME('${datetimeFormat}', time) || '${addedString}'
        ORDER BY time DESC
        LIMIT $numberOfAverages
      ON CONFLICT(time)
    DO UPDATE SET data=excluded.data;
    `, {
      $eventID: eventID,
      $numberOfAverages: numberOfAverages,
    });
  }

  // get data for graphing
  getGraphData(eventID, start, end, callback) {
    const dateDifference = end - start;
    let timeScale = '';
    if (dateDifference < 2 * 24 * 3600) {
      timeScale = '';
    } else if (dateDifference < 31 * 24 * 3600) {
      timeScale = 'hour';
    } else if (dateDifference < 15 * 31 * 24 * 3600) {
      timeScale = 'day';
    } else {
      timeScale = 'month';
    }
    this.getAverageData(eventID, start, end, timeScale, callback);
    console.log('timescale: ', timeScale);
  }

  serialize(x) {
    this.database.serialize(x);
  }
};
