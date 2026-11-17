import supabase from '../utils/supabase.js';
import { AppError, throwDbError } from '../utils/AppError.js';
import { containsAbuse } from '../utils/moderation.js';
import { sendPush } from '../utils/push.js';
import { getPostById } from './posts.service.js';

async function notifyVoters(postId, title) {
  const { data, error } = await supabase
    .from('votes')
    .select('users(push_token)')
    .eq('post_id', postId);
  if (error) {
    console.error('[reveal] could not load voters to notify:', error.message);
    return;
  }
  const tokens = (data ?? []).map((vote) => vote.users?.push_token);
  await sendPush(tokens, {
    title: 'The verdict is in',
    body: `"${title}" — see what they chose and whether you called it.`,
    data: { postId, type: 'revealed' },
  });
}

// Scoring is done by reveal_post() in a single transaction; see the migration for the rule.
export async function revealPost(authorId, postId, { chosen_option, poster_feeling, outcome_text }) {
  if (containsAbuse(outcome_text)) {
    throw new AppError(422, 'This outcome contains language that is not allowed on Decidr', 'CONTENT_REJECTED');
  }

  const { data, error } = await supabase.rpc('reveal_post', {
    p_author_id: authorId,
    p_post_id: postId,
    p_chosen_option: chosen_option,
    p_poster_feeling: poster_feeling,
    p_outcome_text: outcome_text ?? null,
  });
  throwDbError(error);

  const post = await getPostById(postId, authorId);

  // The reveal is committed; a notification problem must not turn it into an error.
  try {
    await notifyVoters(postId, post.title);
  } catch (err) {
    console.error('[reveal] notify failed:', err.message);
  }

  return {
    post,
    correct_side: data.correct_side,
    total_voters: data.total_voters,
    correct_voters: data.correct_voters,
  };
}
