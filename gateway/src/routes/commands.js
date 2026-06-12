/**
 * @swagger
 * /command:
 *   post:
 *     summary: Send a command to a device
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [device, action]
 *             properties:
 *               device:
 *                 type: string
 *                 example: lock-01
 *               action:
 *                 type: string
 *                 example: unlock
 *               payload:
 *                 type: object
 *                 example: { brightness: 50 }
 *     responses:
 *       200:
 *         description: Command published to broker
 *         content:
 *           application/json:
 *             example: { ok: true, topic: "devices/lock-01/cmd" }
 *       400:
 *         description: Missing device or action
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Not authorised to control this device / account revoked
 *       429:
 *         description: Rate limit exceeded
 *       502:
 *         description: MQTT publish failed
 */
const { Router } = require('express');
const { publish } = require('../mqtt');
const { verifyToken } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const { getUser } = require('../store/identities');

const router = Router();

router.post('/', verifyToken, rateLimit, async (req, res) => {
  const { device, action, payload } = req.body ?? {};

  if (!device || !action) {
    return res.status(400).json({ error: 'device and action are required' });
  }

  const userId = req.claims.sub || req.claims.userId;
  if (userId) {
    const user = getUser(userId);
    if (user) {
      if (user.deleted) {
        return res.status(403).json({ error: 'account revoked' });
      }
      if (!user.devices.includes(device)) {
        return res.status(403).json({ error: 'not authorised to control this device' });
      }
    }
  }

  const topic = `devices/${device}/cmd`;
  const message = JSON.stringify({ action, payload: payload ?? null, ts: Date.now() });

  try {
    await publish(topic, message);
    res.json({ ok: true, topic });
  } catch (err) {
    console.error('MQTT publish failed:', err.message);
    res.status(502).json({ error: 'failed to reach device' });
  }
});

module.exports = router;
