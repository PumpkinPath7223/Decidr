import supabase from '../utils/supabase.js';

const RANK_THRESHOLDS = [
  { rank: 'Oracle', min: 300 },
  { rank: 'Strategist', min: 150 },
  { rank: 'Analyst', min: 50 },
  { rank: 'Rookie', min: 0 },
];

function calcRank(points) {
  return RANK_THRESHOLDS.find((t) => points >= t.min).rank;
}

export async function revealPost(authorId, postId, { outcome_text, poster_feeling }) {
  // 1. Fetch post — verify it exists, belongs to requester, is not already revealed
  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('id, author_id, revealed')
    .eq('id', postId)
    .single();

  if (postError || !post) {
    const err = new Error('Post not found');
    err.status = 404;
    throw err;
  }

  if (post.author_id !== authorId) {
    const err = new Error('Only the post author can submit the outcome');
    err.status = 403;
    throw err;
  }

  if (post.revealed) {
    const err = new Error('Outcome has already been submitted for this post');
    err.status = 409;
    throw err;
  }

  // 2. Mark post as revealed
  const { error: updateError } = await supabase
    .from('posts')
    .update({ revealed: true, outcome_text, poster_feeling })
    .eq('id', postId);

  if (updateError) throw updateError;

  // 3. Fetch all votes on this post
  const { data: votes, error: votesError } = await supabase
    .from('votes')
    .select('id, user_id, choice')
    .eq('post_id', postId);

  if (votesError) throw votesError;
  if (!votes.length) {
    return { revealed: true, correct_voters: 0 };
  }

  // 4. Determine winning side
  //    happy  = poster went with majority → majority side is correct
  //    regret = poster regrets going with majority → minority side is correct
  const countA = votes.filter((v) => v.choice === 'A').length;
  const countB = votes.filter((v) => v.choice === 'B').length;
  const majorityChoice = countA >= countB ? 'A' : 'B';
  const winningChoice =
    poster_feeling === 'happy' ? majorityChoice : majorityChoice === 'A' ? 'B' : 'A';

  // 5. Mark each vote is_correct and collect voter ids
  const correctVoterIds = new Set();
  const incorrectVoterIds = new Set();

  for (const vote of votes) {
    const correct = vote.choice === winningChoice;
    await supabase.from('votes').update({ is_correct: correct }).eq('id', vote.id);
    if (correct) correctVoterIds.add(vote.user_id);
    else incorrectVoterIds.add(vote.user_id);
  }

  const allVoterIds = [...new Set(votes.map((v) => v.user_id))];

  // 6. Fetch all affected voters
  const { data: voters, error: votersError } = await supabase
    .from('users')
    .select('id, points, total_votes, accuracy_score')
    .in('id', allVoterIds);

  if (votersError) throw votersError;

  // 7. For each voter: award +5 if correct, recalculate accuracy_score, recalculate rank
  for (const voter of voters) {
    const isCorrect = correctVoterIds.has(voter.id);
    const newPoints = voter.points + (isCorrect ? 5 : 0);

    // accuracy_score = correct resolved votes / total resolved votes for this user
    const { count: totalResolved } = await supabase
      .from('votes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', voter.id)
      .not('is_correct', 'is', null);

    const { count: totalCorrect } = await supabase
      .from('votes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', voter.id)
      .eq('is_correct', true);

    const accuracyScore =
      totalResolved > 0 ? +((totalCorrect / totalResolved) * 100).toFixed(2) : 0;

    await supabase
      .from('users')
      .update({ points: newPoints, accuracy_score: accuracyScore, rank: calcRank(newPoints) })
      .eq('id', voter.id);
  }

  // 8. Award poster +3 for submitting outcome, recalculate rank
  const { data: poster } = await supabase
    .from('users')
    .select('points')
    .eq('id', authorId)
    .single();

  if (poster) {
    const newPoints = poster.points + 3;
    await supabase
      .from('users')
      .update({ points: newPoints, rank: calcRank(newPoints) })
      .eq('id', authorId);
  }

  return { revealed: true, winning_choice: winningChoice, correct_voters: correctVoterIds.size };
}
