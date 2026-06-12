const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing token' });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('JWT_SECRET is not set — refusing all requests');
    return res.status(500).json({ error: 'server misconfiguration' });
  }

  const token = header.slice(7);

  let claims;
  try {
    claims = jwt.verify(token, secret, {
      algorithms: ['HS256'],
      clockTolerance: 10,
    });
  } catch {
    return res.status(401).json({ error: 'invalid or expired token' });
  }

  if (!claims.iat) {
    return res.status(401).json({ error: 'token missing iat' });
  }

  req.claims = claims;
  next();
}

module.exports = { verifyToken };
