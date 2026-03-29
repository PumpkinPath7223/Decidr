import supabase from '../utils/supabase.js';

// author_id excluded from public responses but fetched internally for is_owner
const PUBLIC_POST_COLUMNS = `
  id,
  author_id,
  title,
  context,
  option_a,
  option_b,
  category_tags,
  revealed,
  outcome_text,
  poster_feeling,
  is_live_crisis,
  created_at
`.trim();

function attachVoteCounts(post, countsMap) {
  const c = countsMap[post.id] ?? { votes_a: 0, votes_b: 0, total_votes: 0 };
  return { ...post, votes_a: c.votes_a, votes_b: c.votes_b, total_votes: c.total_votes };
}

function sanitizeForPublic(post, viewerId) {
  const { author_id, ...rest } = post;
  return { ...rest, is_owner: viewerId ? author_id === viewerId : false };
}

async function fetchVoteCountsForPosts(postIds) {
  if (!postIds.length) return {};

  const { data, error } = await supabase
    .from('votes')
    .select('post_id, choice')
    .in('post_id', postIds);

  if (error) throw error;

  const map = {};
  for (const v of data) {
    if (!map[v.post_id]) map[v.post_id] = { votes_a: 0, votes_b: 0, total_votes: 0 };
    map[v.post_id].total_votes += 1;
    if (v.choice === 'A') map[v.post_id].votes_a += 1;
    else map[v.post_id].votes_b += 1;
  }
  return map;
}

export async function createPost(authorId, fields) {
  const { data, error } = await supabase
    .from('posts')
    .insert({ author_id: authorId, ...fields })
    .select(PUBLIC_POST_COLUMNS)
    .single();

  if (error) throw error;
  return data;
}

export async function getPostById(postId, viewerId = null) {
  const { data, error } = await supabase
    .from('posts')
    .select(PUBLIC_POST_COLUMNS)
    .eq('id', postId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  const countsMap = await fetchVoteCountsForPosts([data.id]);
  return sanitizeForPublic(attachVoteCounts(data, countsMap), viewerId);
}

export async function getFeed({ page = 1, hashtag, viewerId = null } = {}) {
  const limit = 20;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('posts')
    .select(PUBLIC_POST_COLUMNS, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (hashtag) {
    query = query.contains('category_tags', [hashtag]);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  const countsMap = await fetchVoteCountsForPosts(data.map((p) => p.id));

  return {
    posts: data.map((p) => sanitizeForPublic(attachVoteCounts(p, countsMap), viewerId)),
    pagination: {
      page,
      limit,
      total: count,
      has_more: offset + limit < count,
    },
  };
}
