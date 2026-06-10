const mqtt = require('mqtt');
const fs = require('fs');

let client;

function connectMqtt() {
  return new Promise((resolve, reject) => {
    const url = process.env.MQTT_BROKER_URL || 'mqtts://localhost:8883';
    const options = {
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
      rejectUnauthorized: true,
    };

    if (process.env.MQTT_CA_CERT_PATH) {
      options.ca = fs.readFileSync(process.env.MQTT_CA_CERT_PATH);
    }

    const timeout = setTimeout(() => {
      reject(new Error(`MQTT connection timed out after 10s (${url})`));
    }, 10000);

    client = mqtt.connect(url, options);

    client.once('connect', () => {
      clearTimeout(timeout);
      console.log(`MQTT connected to ${url}`);
      resolve();
    });

    client.on('error', err => console.error('MQTT error:', err.message));
    client.on('reconnect', () => console.log('MQTT reconnecting...'));
  });
}

function publish(topic, message) {
  return new Promise((resolve, reject) => {
    client.publish(topic, message, { qos: 1 }, err => {
      if (err) reject(err);
      else resolve();
    });
  });
}

module.exports = { connectMqtt, publish };
