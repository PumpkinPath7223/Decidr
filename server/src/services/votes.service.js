import supabase from '../utils/supabase.js';

const RANK_WEIGHTS = {
  Rookie: 1.0,
  Analyst: 1.1,
  Strategist: 1.25,
  Oracle: 1.5,
};

const RANK_THRESHOLDS = [
  { rank: 'Oracle', min: 300 },
  { rank: 'Strategist', min: 150 },
  { rank: 'Analyst', min: 50 },
  { rank: 'Rookie', min: 0 },
];

function calcRank(points) {
  return RANK_THRESHOLDS.find((t) => points >= t.min).rank;
}

export async function castVote(userId, postId, choice) {
  // Fetch post to confirm it exists and is not yet revealed
  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('id, revealed')
    .eq('id', postId)
    .single();

  if (postError || !post) {
    const err = new Error('Post not found');
    err.status = 404;
    throw err;
  }

  if (post.revealed) {
    const err = new Error('Cannot vote on a post that has already been revealed');
    err.status = 409;
    throw err;
  }

  // Fetch voter's current rank to determine weight
  const { data: voter, error: voterError } = await supabase
    .from('users')
    .select('rank, points, total_votes')
    .eq('id', userId)
    .single();

  if (voterError || !voter) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const weight = RANK_WEIGHTS[voter.rank] ?? 1.0;

  // Insert vote — unique constraint on (user_id, post_id) handles duplicates
  const { data: vote, error: voteError } = await supabase
    .from('votes')
    .insert({ user_id: userId, post_id: postId, choice, weight })
    .select('id, choice, weight, created_at')
    .single();

  if (voteError) {
    if (voteError.code === '23505') {
      const err = new Error('You have already voted on this post');
      err.status = 409;
      throw err;
    }
    throw voteError;
  }

  // Award +2 points, increment total_votes, recalculate rank
  const newPoints = voter.points + 2;
  const newTotalVotes = voter.total_votes + 1;
  const newRank = calcRank(newPoints);

  await supabase
    .from('users')
    .update({ points: newPoints, total_votes: newTotalVotes, rank: newRank })
    .eq('id', userId);

  return {
    vote,
    voter_stats: { points: newPoints, total_votes: newTotalVotes, rank: newRank },
  };
}

export async function getVoteCounts(postId) {
  const { data, error } = await supabase
    .from('votes')
    .select('choice, weight')
    .eq('post_id', postId);

  if (error) throw error;

  const counts = { A: 0, B: 0 };
  const weighted = { A: 0, B: 0 };

  for (const v of data) {
    counts[v.choice] += 1;
    weighted[v.choice] = +(weighted[v.choice] + Number(v.weight)).toFixed(2);
  }

  return {
    raw: { votes_a: counts.A, votes_b: counts.B, total: counts.A + counts.B },
    weighted: { votes_a: weighted.A, votes_b: weighted.B, total: +(weighted.A + weighted.B).toFixed(2) },
  };
}
