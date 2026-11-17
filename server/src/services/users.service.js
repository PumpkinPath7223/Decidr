import supabase from '../utils/supabase.js';
import { AppError, throwDbError } from '../utils/AppError.js';
import { CATEGORIES, MIN_RESOLVED_FOR_ACCURACY } from '../utils/constants.js';
import { rankProgress } from '../utils/ranks.js';

const PROFILE_COLUMNS =
  'id, username, avatar_url, rank, points, accuracy_score, resolved_votes, correct_votes, total_votes, total_posts, created_at';

async function loadCategoryAccuracy(userId) {
  const { data, error } = await supabase.rpc('user_category_accuracy', { p_user_id: userId });
  throwDbError(error);

  const byTag = new Map((data ?? []).map((row) => [row.tag, row]));
  return CATEGORIES.map((tag) => {
    const resolved = Number(byTag.get(tag)?.resolved_votes ?? 0);
    const correct = Number(byTag.get(tag)?.correct_votes ?? 0);
    return {
      tag,
      resolved_votes: resolved,
      correct_votes: correct,
      accuracy: resolved > 0 ? Math.round((correct / resolved) * 100) : null,
    };
  });
}

function serializeProfile(row, categories) {
  const resolved = Number(row.resolved_votes);
  return {
    id: row.id,
    username: row.username,
    avatar_url: row.avatar_url ?? null,
    rank: row.rank,
    points: row.points,
    // null until enough votes have resolved — the app shows "Calibrating".
    accuracy_score: row.accuracy_score === null ? null : Number(row.accuracy_score),
    resolved_votes: resolved,
    correct_votes: Number(row.correct_votes),
    votes_until_accuracy: Math.max(0, MIN_RESOLVED_FOR_ACCURACY - resolved),
    total_votes: row.total_votes,
    total_posts: row.total_posts,
    created_at: row.created_at,
    rank_progress: rankProgress(row.points),
    categories,
  };
}

async function loadProfile(userId) {
  const [{ data, error }, categories] = await Promise.all([
    supabase.from('users').select(PROFILE_COLUMNS).eq('id', userId).maybeSingle(),
    loadCategoryAccuracy(userId),
  ]);
  throwDbError(error);
  if (!data) throw new AppError(404, 'User not found');
  return serializeProfile(data, categories);
}

export function getMe(userId) {
  return loadProfile(userId);
}

// Public stats only. Posts are anonymous, so a profile never lists what the user posted,
// and total_posts is left out so it cannot be used to guess.
export async function getPublicProfile(userId) {
  const { total_posts: _totalPosts, ...publicProfile } = await loadProfile(userId);
  return publicProfile;
}

export async function setPushToken(userId, token) {
  // A device belongs to one account at a time.
  if (token) {
    const { error: clearError } = await supabase
      .from('users')
      .update({ push_token: null })
      .eq('push_token', token)
      .neq('id', userId);
    throwDbError(clearError);
  }
  const { error } = await supabase.from('users').update({ push_token: token }).eq('id', userId);
  throwDbError(error);
  return { registered: Boolean(token) };
}

// App Store requirement: an account can be deleted from inside the app.
// Deleting the profile row cascades to the user's posts, votes, comments, reports and blocks.
export async function deleteAccount(userId) {
  const { error } = await supabase.from('users').delete().eq('id', userId);
  throwDbError(error);

  const { error: authError } = await supabase.auth.admin.deleteUser(userId);
  if (authError && authError.status !== 404) throw authError;
  return { deleted: true };
}
