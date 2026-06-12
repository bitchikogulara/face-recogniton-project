const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX || '10', 10);

// Map<userId, { count, windowStart }>
const buckets = new Map();

function rateLimit(req, res, next) {
  const userId = req.claims?.sub || req.claims?.userId || 'anonymous';
  const now = Date.now();

  let bucket = buckets.get(userId);
  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    bucket = { count: 0, windowStart: now };
  }

  bucket.count += 1;
  buckets.set(userId, bucket);

  if (bucket.count > MAX_REQUESTS) {
    const retryAfter = Math.ceil((WINDOW_MS - (now - bucket.windowStart)) / 1000);
    res.set('Retry-After', retryAfter);
    return res.status(429).json({ error: 'rate limit exceeded', retryAfter });
  }

  next();
}

module.exports = { rateLimit };
