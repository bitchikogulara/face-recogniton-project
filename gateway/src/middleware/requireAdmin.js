function requireAdmin(req, res, next) {
  if (req.claims?.role !== 'admin') {
    return res.status(403).json({ error: 'admin access required' });
  }
  next();
}

module.exports = { requireAdmin };
