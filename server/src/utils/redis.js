import { Redis } from '@upstash/redis';

let _redis = null;

function getRedis() {
  if (_redis) return _redis;
  if (!process.env.UPSTASH_REDIS_URL || !process.env.UPSTASH_REDIS_TOKEN) {
    throw new Error('Missing UPSTASH_REDIS_URL or UPSTASH_REDIS_TOKEN');
  }
  _redis = new Redis({
    url: process.env.UPSTASH_REDIS_URL,
    token: process.env.UPSTASH_REDIS_TOKEN,
  });
  return _redis;
}

// Proxy so callers use `redis.incr(...)` etc. without changes
const redis = new Proxy(
  {},
  {
    get(_, prop) {
      return (...args) => getRedis()[prop](...args);
    },
  }
);

export default redis;
