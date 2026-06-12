const mqtt = require('mqtt');
const fs = require('fs');

let client;
const statusCache = new Map();

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

      client.subscribe('devices/+/status', { qos: 1 }, err => {
        if (err) console.error('failed to subscribe to status topics:', err.message);
      });

      resolve();
    });

    client.on('message', (topic, message) => {
      const match = topic.match(/^devices\/(.+)\/status$/);
      if (!match) return;
      const deviceId = match[1];
      try {
        const state = JSON.parse(message.toString());
        statusCache.set(deviceId, { deviceId, ...state, updatedAt: Date.now() });
      } catch {
        console.error(`[mqtt] malformed status message from ${deviceId}`);
      }
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

function getDeviceStates() {
  return Array.from(statusCache.values());
}

function getDeviceState(id) {
  return statusCache.get(id) ?? null;
}

module.exports = { connectMqtt, publish, getDeviceStates, getDeviceState };
