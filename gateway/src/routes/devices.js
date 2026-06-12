const { Router } = require('express');
const { verifyToken } = require('../middleware/auth');
const { getDeviceStates, getDeviceState } = require('../mqtt');

const router = Router();

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
 *                 ts: 1718186400000
 *                 updatedAt: 1718186400123
 *               - deviceId: lights-01
 *                 state: on
 *                 brightness: 80
 *                 ts: 1718186401000
 *                 updatedAt: 1718186401050
 *       401:
 *         description: Missing or invalid token
 */
router.get('/', verifyToken, (_req, res) => {
  res.json(getDeviceStates());
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
 *         content:
 *           application/json:
 *             example:
 *               deviceId: lock-01
 *               state: locked
 *               ts: 1718186400000
 *               updatedAt: 1718186400123
 *       401:
 *         description: Missing or invalid token
 *       404:
 *         description: No status received from this device yet
 */
router.get('/:id', verifyToken, (req, res) => {
  const state = getDeviceState(req.params.id);
  if (!state) return res.status(404).json({ error: 'no status received from this device yet' });
  res.json(state);
});

module.exports = router;
