# Work breakdown

## Team

| | Focus |
|---|---|
| **Bitchiko** | System architecture, gateway, IoT firmware, repo management |
| **Nikoloz** | Android mobile app |
| **Tamara** | Documentation, kanban, testing, demo |

---

## Phase 1 — Foundation 

**Bitchiko**
- Set up GitHub repo: folder structure, branch strategy
- Install Mosquitto on laptop, enable MQTTS on port 8883
- Set up Node.js gateway service
- Flash one ESP32, connect to laptop broker, confirm pub/sub over MQTTS

**Nikoloz**
- Create Android project in Kotlin
- Integrate FaceNet TFLite model
- Get camera feed running with permissions handled
- Confirm app can send a dummy request to the laptop gateway

**Tamara**
- Set up kanban board (GitHub Projects)
- Write initial README draft
- Document folder structure and branching conventions

---

## Phase 2 — Core recognition + auth 

**Bitchiko**
- Build auth service: JWT validation, token expiry, rate limiting
- Set up per-device credentials and ACLs in Mosquitto
- Wire ESP32 to servo motor, implement lock/unlock command handler
- Test full command flow end to end

**Nikoloz**
- Implement face capture pipeline: camera → FaceNet inference → match/no-match
- Add liveness detection (blink check)
- Mint JWT on successful match, send signed command to gateway
- Store face embeddings in Android Keystore

**Tamara**
- Write API docs for gateway auth endpoints
- Write test cases for auth flow (valid token, expired, wrong signature, rate limit)
- Run manual tests and log results

---

## Phase 3 — Enrollment + lights 

> Bitchiko migrates gateway from laptop to Raspberry Pi before this phase starts.

**Bitchiko**
- Build identity store: embeddings and per-user permissions on the gateway
- Implement enrollment API endpoint (admin only)
- Wire second ESP32 to LED strip via relay, implement on/off/dim handler

**Nikoloz**
- Build enrollment UI: admin scans face, assigns name and permissions
- Handle enrollment API call and confirmation
- Add lights controls to device screen

**Tamara**
- Test enrollment flow end to end
- Test multi-user scenarios (different permissions, revoke access)
- Document edge cases found during testing

---

## Phase 4 — Remote access + polish 

**Bitchiko**
- Set up WireGuard on the Pi, generate peer configs per phone
- Test remote access over WireGuard
- Implement watchdog on ESP32s, test fail-safe states on all devices

**Nikoloz**
- Polish app UX: pending, success, and failed states for every command
- Handle offline and timeout scenarios
- Build live device list screen

**Tamara**
- Update all docs to reflect the final system
- Record a short demo video
- Run final end-to-end test pass and document results
