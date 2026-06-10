const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing token' });
  }

  const token = header.slice(7);
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    // Dev-only fallback: JWT_SECRET not set, skip validation
    // TODO Phase 2: remove this branch — secret must always be present in production
    console.warn('JWT_SECRET not set — skipping token validation (dev only)');
    req.claims = {};
    return next();
  }

  try {
    req.claims = jwt.verify(token, secret, { algorithms: ['HS256'] });
    next();
  } catch {
    return res.status(401).json({ error: 'invalid or expired token' });
  }
}

module.exports = { verifyToken };
