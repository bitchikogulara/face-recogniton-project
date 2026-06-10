# Branching Strategy

FaceConnect uses a lightweight GitFlow model suited for a small team with distinct components.

---

## Branch Map

```
main ◄─── develop ◄─── feat/gateway/<name>
                  ◄─── feat/mobile/<name>
                  ◄─── feat/firmware/<name>
main ◄─── hotfix/<name>
```

## Branches

| Branch | Purpose | Who merges here |
|---|---|---|
| `main` | Stable releases only. Tagged with `vX.Y`. | Merge from `develop` via PR at phase milestones |
| `develop` | Integration branch. Always deployable for testing. | All feature branches via PR |
| `feat/gateway/<name>` | Gateway feature or task | Bitchiko |
| `feat/mobile/<name>` | Android app feature or task | Nikoloz |
| `feat/firmware/<name>` | ESP32 firmware feature or task | Bitchiko |
| `hotfix/<name>` | Critical fix on `main`. Merges to both `main` and `develop`. | Bitchiko |

---

## Rules

1. **Never commit directly to `main` or `develop`.** All changes go through a feature branch + PR.
2. **Branch off `develop`**, not `main`, for all feature work.
3. **PR to `develop`** when a feature is complete and self-tested. At least one teammate reviews.
4. **PR to `main`** only at phase milestones (end of weeks 2, 4, 6, 8). Tamara signs off after testing `develop`.
5. **Hotfixes** branch off `main`, merge back to both `main` and `develop`.
6. **Delete feature branches** after the PR merges.

---

## Naming Examples

```
feat/gateway/jwt-validation
feat/gateway/mqtt-acl-setup
feat/mobile/facenet-integration
feat/mobile/liveness-detection
feat/firmware/lock-servo-handler
feat/firmware/lights-relay-handler
hotfix/mqtt-tls-cert-expiry
```

---

## Release Tags

Tag `main` at each phase milestone:

| Tag | Milestone |
|---|---|
| `v0.1` | Phase 1 complete — foundation working |
| `v0.2` | Phase 2 complete — auth + recognition end-to-end |
| `v0.3` | Phase 3 complete — enrollment + lights |
| `v1.0` | Phase 4 complete — remote access + polish |
