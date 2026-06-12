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
