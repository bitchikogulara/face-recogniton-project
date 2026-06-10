const { Router } = require('express');
const { publish } = require('../mqtt');
const { verifyToken } = require('../middleware/auth');

const router = Router();

router.post('/', verifyToken, async (req, res) => {
  const { device, action, payload } = req.body;

  if (!device || !action) {
    return res.status(400).json({ error: 'device and action are required' });
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
