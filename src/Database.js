const sqlite3 = require('sqlite3')

module.exports = class Database {
  constructor() {
    this.database = new sqlite3.Database('F:\\autohome database\\autohome.db')
    this.eventInfo = {
      FAN_TEMPERATURE: 1,
      HEATER_GOAL_TEMPERATURE: 2,
      HEATER_FAN_STATUS: 3,
    }

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
    )
    // create event_data table
    this.database.run(
      `CREATE TABLE IF NOT EXISTS event_data(
        data_id   INTEGER PRIMARY KEY,
        event_id  INT NOT NULL,
        data      FLOAT,
        time      DATETIME,
        FOREIGN KEY(event_id) REFERENCES sensor_info(event_id)
      );`,
    )
    // will get topics from database then when we recieve mqtt messages we will check against topics
    // in database to see if we should send data to database
    this.getTopics((err, eventTopics) => {
      if (err) {
        console.log(err)
      }
      this.topics = eventTopics.map(x => x.topic)
    })
  }

  // adds event info
  addEventInfo(name, topic, description, units, callback) {
    this.database.run(
      `INSERT OR IGNORE INTO event_info (units, description, name)
      VALUES ('${units}', '${description}', '${name}')
      ON CONFLICT(name) DO UPDATE
      SET units='${units}', description='${description}', topic='${topic}'
      WHERE name='${name}';`,
      callback,
    )
  }

  // logs event data
  logEventData(topic, data, callback) {
    this.database.run(
      `INSERT INTO event_data
      (event_id, data, time)
      VALUES (
        (SELECT event_id
          FROM event_info
          WHERE event_info.topic IS '${topic}'),
        ${data},
        datetime('now', 'localtime'))`,
      callback,
    )
  }

  getTopics(callback) {
    this.database.all(`
      SELECT topic FROM event_info
      WHERE topic IS NOT NULL
    `, callback)
  }

  async getCurrentGoalTemperature(callback) {
    this.database.get(
      `SELECT data FROM event_data
      WHERE event_id IS ${this.eventInfo.HEATER_GOAL_TEMPERATURE}
      ORDER BY time DESC`,
      callback,
    )
  }

  async getCurrentTemperature(callback) {
    this.database.get(
      `SELECT data FROM event_data
      WHERE event_id IS ${this.eventInfo.FAN_TEMPERATURE}
      ORDER BY time DESC`,
      callback,
    )
  }

  serialize(x) {
    this.database.serialize(x)
  }
}
