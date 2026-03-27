import redis from '../utils/redis.js';

const WINDOW_SECONDS = 60 * 60; // 1 hour
const MAX_VOTES = 60;

export async function voteRateLimit(req, res, next) {
  const key = `vote_rate:${req.user.id}`;

  const count = await redis.incr(key);

  if (count === 1) {
    // First vote in this window — set the expiry
    await redis.expire(key, WINDOW_SECONDS);
  }

  if (count > MAX_VOTES) {
    const ttl = await redis.ttl(key);
    return res.status(429).json({
      success: false,
      error: `Vote limit reached. Try again in ${Math.ceil(ttl / 60)} minutes.`,
    });
  }

  next();
}
