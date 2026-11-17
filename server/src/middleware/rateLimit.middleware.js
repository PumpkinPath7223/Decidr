import redis from '../utils/redis.js';
import { AppError } from '../utils/AppError.js';

let warned = false;

// Fixed-window counter in Redis. `by` picks what is being limited: the signed-in user
// (default) or the caller's IP for unauthenticated routes.
// If Redis is unreachable the request is allowed through — an outage of the limiter
// should not take the whole API down.
export function rateLimit({ name, max, windowSeconds, by = 'user' }) {
  return async function rateLimitMiddleware(req, res, next) {
    const subject = by === 'ip' ? req.ip : req.user?.id;
    if (!subject) return next();

    const key = `rl:${name}:${subject}`;
    let count;
    let ttl = windowSeconds;

    try {
      count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, windowSeconds);
      } else if (count > max) {
        ttl = await redis.ttl(key);
        // A key without an expiry would lock the user out forever; repair it.
        if (ttl < 0) {
          await redis.expire(key, windowSeconds);
          ttl = windowSeconds;
        }
      }
    } catch (err) {
      if (!warned) {
        console.warn('[rateLimit] Redis unavailable, rate limiting is disabled:', err.message);
        warned = true;
      }
      return next();
    }

    if (count > max) {
      const minutes = Math.max(1, Math.ceil(ttl / 60));
      return next(
        new AppError(429, `Too many requests. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`, 'RATE_LIMITED')
      );
    }
    next();
  };
}

const HOUR = 60 * 60;

export const voteRateLimit = rateLimit({ name: 'vote', max: 60, windowSeconds: HOUR });
export const postRateLimit = rateLimit({ name: 'post', max: 5, windowSeconds: 24 * HOUR });
export const commentRateLimit = rateLimit({ name: 'comment', max: 30, windowSeconds: HOUR });
export const reportRateLimit = rateLimit({ name: 'report', max: 20, windowSeconds: HOUR });
export const authRateLimit = rateLimit({ name: 'auth', max: 20, windowSeconds: 15 * 60, by: 'ip' });
