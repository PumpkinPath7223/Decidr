import supabase from '../utils/supabase.js';
import { AppError, throwDbError } from '../utils/AppError.js';

// All validation, the insert, points and rank happen inside cast_vote() in one transaction.
export async function castVote(userId, postId, choice) {
  const { data, error } = await supabase.rpc('cast_vote', {
    p_user_id: userId,
    p_post_id: postId,
    p_choice: choice,
  });

  if (error) {
    if (error.code === '23505') throw new AppError(409, 'You have already voted on this post', 'ALREADY_VOTED');
    throwDbError(error);
  }

  return {
    vote: { post_id: data.vote.post_id, choice: data.vote.choice, weight: Number(data.vote.weight) },
    voter_stats: data.voter_stats,
  };
}
