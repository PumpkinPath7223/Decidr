// Single definition of every product constant. The SQL functions in
// supabase/migrations mirror the rank and points values — change both together.

export const CATEGORIES = ['career', 'money', 'relationships', 'health', 'lifestyle', 'education'];

// Reveal timer options a poster can pick, in seconds.
export const REVEAL_TIMERS = {
  '24h': 24 * 60 * 60,
  '72h': 72 * 60 * 60,
  '7d': 7 * 24 * 60 * 60,
  '30d': 30 * 24 * 60 * 60,
};

export const LIVE_CRISIS_SECONDS = 2 * 60 * 60;
export const UNRESOLVED_GRACE_DAYS = 7;

export const MIN_RESOLVED_FOR_ACCURACY = 5;
export const MIN_POSTS_FOR_REGRET_INDEX = 20;

export const FEED_PAGE_SIZE = 20;
export const LEADERBOARD_SIZE = 50;
export const COMMENTS_PAGE_SIZE = 100;

export const LIMITS = {
  title: { min: 5, max: 140 },
  context: { max: 1000 },
  option: { min: 1, max: 80 },
  outcome: { max: 1000 },
  comment: { min: 1, max: 500 },
  reportReason: { min: 1, max: 300 },
  tags: { min: 1, max: 3 },
};
