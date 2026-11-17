import supabase from '../utils/supabase.js';
import { AppError, throwDbError } from '../utils/AppError.js';
import {
  CATEGORIES,
  LEADERBOARD_SIZE,
  MIN_POSTS_FOR_REGRET_INDEX,
  MIN_RESOLVED_FOR_ACCURACY,
} from '../utils/constants.js';

// Ranked by accuracy among users with enough resolved votes for it to mean something.
export async function getLeaderboard() {
  const { data, error } = await supabase
    .from('users')
    .select('id, username, rank, points, accuracy_score, resolved_votes')
    .gte('resolved_votes', MIN_RESOLVED_FOR_ACCURACY)
    .not('accuracy_score', 'is', null)
    .order('accuracy_score', { ascending: false })
    .order('resolved_votes', { ascending: false })
    .order('points', { ascending: false })
    .limit(LEADERBOARD_SIZE);
  throwDbError(error);

  return (data ?? []).map((row, index) => ({
    position: index + 1,
    id: row.id,
    username: row.username,
    rank: row.rank,
    points: row.points,
    accuracy_score: Number(row.accuracy_score),
    resolved_votes: row.resolved_votes,
  }));
}

export async function getRegretIndex() {
  const { data, error } = await supabase.rpc('regret_index');
  throwDbError(error);

  const byTag = new Map((data ?? []).map((row) => [row.tag, row]));
  return CATEGORIES.map((tag) => {
    const row = byTag.get(tag);
    const revealed = Number(row?.revealed_posts ?? 0);
    const enoughData = revealed >= MIN_POSTS_FOR_REGRET_INDEX;
    return {
      tag,
      revealed_posts: revealed,
      enough_data: enoughData,
      posts_needed: Math.max(0, MIN_POSTS_FOR_REGRET_INDEX - revealed),
      // Percentages on a handful of posts are noise, so they are withheld until there is enough data.
      regret_pct: enoughData ? Number(row.regret_pct) : null,
      happy_pct: enoughData ? Math.round((100 - Number(row.regret_pct)) * 10) / 10 : null,
    };
  });
}

export async function getRegretIndexForTag(tag) {
  if (!CATEGORIES.includes(tag)) throw new AppError(404, 'Unknown category');
  const all = await getRegretIndex();
  return all.find((entry) => entry.tag === tag);
}
