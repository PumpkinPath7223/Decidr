import supabase from '../utils/supabase.js';
import { AppError, throwDbError } from '../utils/AppError.js';

export async function getBlockedUserIds(userId) {
  if (!userId) return [];
  const { data, error } = await supabase.from('blocks').select('blocked_id').eq('blocker_id', userId);
  throwDbError(error);
  return (data ?? []).map((row) => row.blocked_id);
}

// Returns the user id behind a post or comment. Internal only — never send it to a client.
async function findTargetOwner(targetType, targetId) {
  if (targetType === 'post') {
    const { data, error } = await supabase
      .from('posts')
      .select('author_id, status')
      .eq('id', targetId)
      .maybeSingle();
    throwDbError(error);
    if (!data || data.status === 'removed') throw new AppError(404, 'Post not found');
    return data.author_id;
  }

  const { data, error } = await supabase
    .from('comments')
    .select('user_id, hidden')
    .eq('id', targetId)
    .maybeSingle();
  throwDbError(error);
  if (!data || data.hidden) throw new AppError(404, 'Comment not found');
  return data.user_id;
}

export async function reportContent(reporterId, { target_type, target_id, reason }) {
  const ownerId = await findTargetOwner(target_type, target_id);
  if (ownerId === reporterId) throw new AppError(400, "You can't report your own content");

  const { error } = await supabase
    .from('reports')
    .insert({ reporter_id: reporterId, target_type, target_id, reason });

  // Reporting the same thing twice is a no-op, not an error.
  if (error && error.code !== '23505') throw error;
  return { reported: true };
}

// Posts are anonymous, so a user blocks "whoever wrote this" by pointing at the content.
export async function blockAuthorOf(blockerId, { target_type, target_id }) {
  const ownerId = await findTargetOwner(target_type, target_id);
  if (ownerId === blockerId) throw new AppError(400, "You can't block yourself");

  const { error } = await supabase
    .from('blocks')
    .upsert({ blocker_id: blockerId, blocked_id: ownerId }, { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true });
  throwDbError(error);
  return { blocked: true };
}

export async function clearBlocks(blockerId) {
  const { error } = await supabase.from('blocks').delete().eq('blocker_id', blockerId);
  throwDbError(error);
  return { cleared: true };
}
