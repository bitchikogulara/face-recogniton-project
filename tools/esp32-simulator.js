const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mqtt = require('mqtt');
const fs = require('fs');

// Simulated devices — mirrors what the real ESP32 firmware will do
const DEVICES = {
  'lock-01': {
    state: { locked: true },
    handle(action, payload, state) {
      if (action === 'lock')   return { locked: true };
      if (action === 'unlock') return { locked: false };
      console.warn(`[lock-01] unknown action: ${action}`);
      return state;
    },
    status(state) {
      return { state: state.locked ? 'locked' : 'unlocked' };
    },
  },
  'lights-01': {
    state: { on: false, brightness: 100 },
    handle(action, payload, state) {
      if (action === 'on')  return { ...state, on: true };
      if (action === 'off') return { ...state, on: false };
      if (action === 'dim') return { ...state, on: true, brightness: payload?.brightness ?? 50 };
      console.warn(`[lights-01] unknown action: ${action}`);
      return state;
    },
    status(state) {
      return state.on
        ? { state: 'on', brightness: state.brightness }
        : { state: 'off' };
    },
  },
};

const url = process.env.MQTT_BROKER_URL || 'mqtts://localhost:8883';
const options = {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
  rejectUnauthorized: true,
  clientId: `esp32-sim-${Date.now()}`,
};

if (process.env.MQTT_CA_CERT_PATH) {
  options.ca = fs.readFileSync(path.resolve(__dirname, process.env.MQTT_CA_CERT_PATH));
}

const client = mqtt.connect(url, options);

client.on('connect', () => {
  console.log(`[sim] connected to ${url}\n`);

  for (const id of Object.keys(DEVICES)) {
    const cmdTopic = `devices/${id}/cmd`;
    client.subscribe(cmdTopic, { qos: 1 }, err => {
      if (err) { console.error(`[${id}] subscribe failed:`, err.message); return; }
      console.log(`[${id}] subscribed to ${cmdTopic}`);
      publishStatus(id);
    });
  }
});

client.on('message', (topic, message) => {
  const match = topic.match(/^devices\/(.+)\/cmd$/);
  if (!match) return;

  const id = match[1];
  const device = DEVICES[id];
  if (!device) { console.warn(`[sim] unknown device id: ${id}`); return; }

  let cmd;
  try {
    cmd = JSON.parse(message.toString());
  } catch {
    console.error(`[${id}] malformed command (not valid JSON)`);
    return;
  }

  const { action, payload } = cmd;
  console.log(`\n[${id}] ← cmd  action=${action}${payload ? '  payload=' + JSON.stringify(payload) : ''}`);

  device.state = device.handle(action, payload, device.state);
  publishStatus(id);
});

function publishStatus(id) {
  const device = DEVICES[id];
  const msg = JSON.stringify({ ...device.status(device.state), ts: Date.now() });
  client.publish(`devices/${id}/status`, msg, { qos: 1 });
  console.log(`[${id}] → status ${msg}`);
}

client.on('error',     err => console.error('[sim] error:', err.message));
client.on('reconnect', ()  => console.log('[sim] reconnecting...'));
client.on('close',     ()  => console.log('[sim] disconnected'));
