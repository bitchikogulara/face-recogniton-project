# FaceGate

A local-first smart home control system that uses on-device face recognition to authenticate users and send commands to smart devices — door locks and lights.

Face matching happens entirely on the mobile device. No biometric data is ever transmitted over the network.

---

## How it works

The system has three layers:

**Mobile app (Android)** — captures the user's face, runs liveness detection and recognition on-device, mints a signed auth token on success, and sends the command to the gateway over an encrypted connection.

**Home gateway** — a Raspberry Pi on the local network. Validates every inbound request, then forwards it to the target device via MQTT. Acts as the single trust boundary between the outside world and your devices.

**Edge devices** — ESP32/ESP8266 microcontrollers connected to physical hardware (locks, lights). Each device subscribes only to its own command topic and reports status back to the gateway.

```
Mobile app  ──(TLS)──▶  Home gateway  ──(MQTTS)──▶  Smart devices
 face recog              Raspberry Pi                 ESP32 / ESP8266
 on-device               auth + broker                lock, lights
```

---

## Key design decisions

- **On-device recognition** — FaceNet embeddings stored in Android Keystore, never transmitted
- **Multi-user** — household members enrolled by an admin via the app; each user gets individual permissions
- **MQTTS** — all device communication encrypted (port 8883, TLS)
- **Per-device credentials** — each device authenticates separately; a compromised bulb can't touch the door lock
- **Fail-safe states** — every device has an explicit safe state defined at provisioning (door lock defaults to locked)
- **No cloud relay** — everything runs on your LAN; remote access via WireGuard VPN

---

## Stack

| Layer | Technology |
|---|---|
| Mobile | Kotlin + TensorFlow Lite |
| Face model | FaceNet (quantized INT8) |
| Gateway | Raspberry Pi OS + Node.js |
| MQTT broker | Eclipse Mosquitto 2.x |
| Edge firmware | ESP-IDF (ESP32) |
| Remote access | WireGuard VPN |

---

## Roadmap

1. Mobile app — face capture + on-device recognition
2. Gateway auth service + Mosquitto setup
3. Door lock prototype (ESP32)
4. Lights integration
5. User enrollment flow (admin app)
6. Remote access via WireGuard

---