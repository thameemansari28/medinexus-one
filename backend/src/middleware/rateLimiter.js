/**
 * MediNexus One - Sliding Window Rate Limiter
 * 
 * Protects endpoints from abuse, spamming, and denial of service.
 */

const hitMap = new Map();

export function rateLimiter({ windowMs = 60000, maxRequests = 100, message = "Too many requests, please slow down." } = {}) {
  // Periodically clean up old buckets
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hitMap.entries()) {
      if (now - record.startTime > windowMs) {
        hitMap.delete(key);
      }
    }
  }, windowMs).unref();

  return (req, res, next) => {
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
    const key = `${req.baseUrl || req.path}:${ip}`;
    const now = Date.now();

    let record = hitMap.get(key);
    if (!record || now - record.startTime > windowMs) {
      record = { count: 1, startTime: now };
      hitMap.set(key, record);
      return next();
    }

    record.count++;
    if (record.count > maxRequests) {
      return res.status(429).json({
        error: "Rate limit exceeded",
        message,
        retryAfterMs: Math.max(0, windowMs - (now - record.startTime)),
      });
    }

    next();
  };
}
