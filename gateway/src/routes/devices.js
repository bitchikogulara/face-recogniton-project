const { Router } = require('express');
const { verifyToken } = require('../middleware/auth');
const { getDeviceStates, getDeviceState } = require('../mqtt');
const { getUser } = require('../store/identities');

const router = Router();

function allowedDevices(claims) {
  const userId = claims?.sub || claims?.userId;
  if (!userId) return null;
  const user = getUser(userId);
  if (!user || user.deleted) return [];
  if (user.role === 'admin') return null; // null = all devices
  return user.devices;
}

/**
 * @swagger
 * /devices:
 *   get:
 *     summary: List all devices and their last reported state
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of device state objects
 *         content:
 *           application/json:
 *             example:
 *               - deviceId: lock-01
 *                 state: locked
 *                 online: true
 *                 ts: 1718186400000
 *                 updatedAt: 1718186400123
 *                 lastSeen: 1718186400123
 *       401:
 *         description: Missing or invalid token
 */
router.get('/', verifyToken, (req, res) => {
  const allowed = allowedDevices(req.claims);
  const all = getDeviceStates();
  const result = allowed === null ? all : all.filter(d => allowed.includes(d.deviceId));
  res.json(result);
});

/**
 * @swagger
 * /devices/{id}:
 *   get:
 *     summary: Get a specific device's last reported state
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: lock-01
 *     responses:
 *       200:
 *         description: Device state object
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Not authorised to view this device
 *       404:
 *         description: No status received from this device yet
 */
router.get('/:id', verifyToken, (req, res) => {
  const allowed = allowedDevices(req.claims);
  if (allowed !== null && !allowed.includes(req.params.id)) {
    return res.status(403).json({ error: 'not authorised to view this device' });
  }
  const state = getDeviceState(req.params.id);
  if (!state) return res.status(404).json({ error: 'no status received from this device yet' });
  res.json(state);
});

module.exports = router;
