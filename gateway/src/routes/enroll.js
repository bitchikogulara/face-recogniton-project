/**
 * @swagger
 * /enroll:
 *   post:
 *     summary: Enroll or update a user (admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, name, devices]
 *             properties:
 *               userId:
 *                 type: string
 *                 example: user-123
 *               name:
 *                 type: string
 *                 example: Bitchiko
 *               devices:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: [lock-01, lights-01]
 *               role:
 *                 type: string
 *                 enum: [user, admin]
 *                 example: user
 *     responses:
 *       201:
 *         description: User enrolled
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Admin access required
 *   get:
 *     summary: List all enrolled users (admin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of enrolled users
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Admin access required
 *
 * /enroll/{userId}:
 *   get:
 *     summary: Get a single enrolled user (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User object
 *       404:
 *         description: User not found
 *   delete:
 *     summary: Revoke a user's access (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User revoked
 *       404:
 *         description: User not found
 */
const { Router } = require('express');
const { verifyToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/requireAdmin');
const { getUser, upsertUser, listUsers } = require('../store/identities');

const router = Router();

router.post('/', verifyToken, requireAdmin, (req, res) => {
  const { userId, name, devices, role } = req.body ?? {};

  if (!userId || !name || !Array.isArray(devices) || devices.length === 0) {
    return res.status(400).json({ error: 'userId, name, and devices (non-empty array) are required' });
  }

  const user = upsertUser(userId, {
    name,
    devices,
    role: role === 'admin' ? 'admin' : 'user',
  });

  console.log(`enrolled user: ${userId} (${name}) — devices: ${devices.join(', ')}`);
  res.status(201).json({ ok: true, userId, ...user });
});

router.get('/', verifyToken, requireAdmin, (_req, res) => {
  res.json(listUsers());
});

router.get('/:userId', verifyToken, requireAdmin, (req, res) => {
  const user = getUser(req.params.userId);
  if (!user) return res.status(404).json({ error: 'user not found' });
  res.json({ userId: req.params.userId, ...user });
});

router.delete('/:userId', verifyToken, requireAdmin, (req, res) => {
  const user = getUser(req.params.userId);
  if (!user) return res.status(404).json({ error: 'user not found' });
  upsertUser(req.params.userId, { deleted: true });
  res.json({ ok: true });
});

module.exports = router;
