const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mqtt = require('mqtt');
const fs = require('fs');

const HEARTBEAT_INTERVAL_MS = 30 * 1000;

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

const caPath = process.env.MQTT_CA_CERT_PATH
  ? path.resolve(__dirname, process.env.MQTT_CA_CERT_PATH)
  : null;
const ca = caPath ? fs.readFileSync(caPath) : undefined;

function deviceEnvKey(id) {
  return `MQTT_PASSWORD_${id.replace(/-/g, '_').toUpperCase()}`;
}

function startDevice(id, device) {
  const password = process.env[deviceEnvKey(id)] || process.env.MQTT_PASSWORD;

  if (!password) {
    console.error(`[${id}] no password set — set ${deviceEnvKey(id)} in .env`);
    process.exit(1);
  }

  const statusTopic = `devices/${id}/status`;
  const cmdTopic    = `devices/${id}/cmd`;

  const client = mqtt.connect(url, {
    username: id,
    password,
    rejectUnauthorized: true,
    clientId: `esp32-sim-${id}-${Date.now()}`,
    ...(ca && { ca }),
    // LWT: broker publishes this automatically if device disconnects unexpectedly
    will: {
      topic: statusTopic,
      payload: JSON.stringify({ online: false }),
      qos: 1,
      retain: true,
    },
  });

  client.on('connect', () => {
    console.log(`[${id}] connected`);

    client.subscribe(cmdTopic, { qos: 1 }, err => {
      if (err) { console.error(`[${id}] subscribe failed:`, err.message); return; }
      publishStatus(id, device, client, statusTopic);
    });

    // Heartbeat — lets gateway know device is still alive without a command
    setInterval(() => publishStatus(id, device, client, statusTopic), HEARTBEAT_INTERVAL_MS);
  });

  client.on('message', (_topic, message) => {
    let cmd;
    try {
      cmd = JSON.parse(message.toString());
    } catch {
      console.error(`[${id}] malformed command (not valid JSON)`);
      return;
    }

    if (typeof cmd !== 'object' || cmd === null || Array.isArray(cmd)) {
      console.error(`[${id}] malformed command (expected JSON object)`);
      return;
    }

    const { action, payload } = cmd;
    console.log(`\n[${id}] ← cmd  action=${action}${payload ? '  payload=' + JSON.stringify(payload) : ''}`);
    device.state = device.handle(action, payload, device.state);
    publishStatus(id, device, client, statusTopic);
  });

  client.on('error',     err => console.error(`[${id}] error:`, err.message));
  client.on('reconnect', ()  => console.log(`[${id}] reconnecting...`));
  client.on('close',     ()  => console.log(`[${id}] disconnected`));
}

function publishStatus(id, device, client, statusTopic) {
  const msg = JSON.stringify({ online: true, ...device.status(device.state), ts: Date.now() });
  // retain:true so gateway gets current state immediately when it (re)connects
  client.publish(statusTopic, msg, { qos: 1, retain: true });
  console.log(`[${id}] → status ${msg}`);
}

console.log(`[sim] connecting to ${url}\n`);
for (const [id, device] of Object.entries(DEVICES)) {
  startDevice(id, device);
}
