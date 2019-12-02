# Autohome: Server
* Part of the autohome project<br />
* The server communicates with the MQTT clients (currently just the fan controller) to actuate and recieve and collect data
* The server also has a REST API to allow for the client to get data and send commands to the server
* Currently this code runs on a Raspberry Pi to control a servo motor to turn on the heater but this could change in the future<br />
* Works with [client](https://github.com/grnnja/autohome-client) and [fan controller](https://github.com/grnnja/autohome-fan-controller)
## Features
* Turn fan on and off through MQTT
* Turn heater on and off using servo connected to Raspberry Pi
* Recieve and log temperature data
* Log usage data
* Store data in SQLite database
* REST API for client
