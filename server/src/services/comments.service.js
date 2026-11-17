import supabase from '../utils/supabase.js';
import { AppError, throwDbError } from '../utils/AppError.js';
import { COMMENTS_PAGE_SIZE } from '../utils/constants.js';
import { containsAbuse } from '../utils/moderation.js';
import { getBlockedUserIds } from './safety.service.js';

const COMMENT_COLUMNS =
  'id, user_id, body, voter_choice, user_rank_at_time, user_accuracy_at_time, created_at, users(username)';

function serializeComment(row, viewerId) {
  return {
    id: row.id,
    body: row.body,
    username: row.users?.username ?? 'deleted',
    voter_choice: row.voter_choice,
    rank: row.user_rank_at_time,
    accuracy: row.user_accuracy_at_time === null ? null : Number(row.user_accuracy_at_time),
    created_at: row.created_at,
    is_mine: Boolean(viewerId) && row.user_id === viewerId,
  };
}

async function loadVisiblePost(postId) {
  const { data, error } = await supabase
    .from('posts')
    .select('id, status, comments_enabled')
    .eq('id', postId)
    .maybeSingle();
  throwDbError(error);
  if (!data || data.status === 'removed') throw new AppError(404, 'Post not found');
  return data;
}

export async function listComments(postId, viewerId = null) {
  const post = await loadVisiblePost(postId);
  if (!post.comments_enabled) return [];

  const [{ data, error }, blockedIds] = await Promise.all([
    supabase
      .from('comments')
      .select(COMMENT_COLUMNS)
      .eq('post_id', postId)
      .eq('hidden', false)
      .order('created_at', { ascending: true })
      .limit(COMMENTS_PAGE_SIZE),
    getBlockedUserIds(viewerId),
  ]);
  throwDbError(error);

  const blocked = new Set(blockedIds);
  return (data ?? [])
    .filter((row) => !blocked.has(row.user_id))
    .map((row) => serializeComment(row, viewerId));
}

// Only people who voted on the post may comment; the comment carries their vote and a
// snapshot of their rank and accuracy at the time.
export async function addComment(userId, postId, body) {
  const post = await loadVisiblePost(postId);
  if (!post.comments_enabled) throw new AppError(403, 'Comments are turned off for this post');
  if (containsAbuse(body)) {
    throw new AppError(422, 'This comment contains language that is not allowed on Decidr', 'CONTENT_REJECTED');
  }

  const [voteResult, userResult] = await Promise.all([
    supabase.from('votes').select('choice').eq('post_id', postId).eq('user_id', userId).maybeSingle(),
    supabase.from('users').select('rank, accuracy_score').eq('id', userId).maybeSingle(),
  ]);
  throwDbError(voteResult.error);
  throwDbError(userResult.error);
  if (!userResult.data) throw new AppError(404, 'User not found');
  if (!voteResult.data) throw new AppError(403, 'Vote on this post to join the discussion', 'VOTE_REQUIRED');

  const { data, error } = await supabase
    .from('comments')
    .insert({
      user_id: userId,
      post_id: postId,
      body,
      voter_choice: voteResult.data.choice,
      user_rank_at_time: userResult.data.rank,
      user_accuracy_at_time: userResult.data.accuracy_score,
    })
    .select(COMMENT_COLUMNS)
    .single();
  throwDbError(error);

  return serializeComment(data, userId);
}
