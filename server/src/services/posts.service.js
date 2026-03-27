import supabase from '../utils/supabase.js';

// Columns returned to the public — author_id is intentionally excluded
const PUBLIC_POST_COLUMNS = `
  id,
  title,
  context,
  option_a,
  option_b,
  category_tags,
  reveal_at,
  revealed,
  outcome_text,
  poster_feeling,
  is_live_crisis,
  created_at
`.trim();

function stripVoteCounts(post) {
  if (!post.revealed) {
    return { ...post, votes_a: null, votes_b: null, total_votes: null };
  }
  return post;
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

export async function getPostById(postId) {
  const { data, error } = await supabase
    .from('posts')
    .select(PUBLIC_POST_COLUMNS)
    .eq('id', postId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return stripVoteCounts(data);
}

export async function getFeed({ page = 1, hashtag } = {}) {
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

  return {
    posts: data.map(stripVoteCounts),
    pagination: {
      page,
      limit,
      total: count,
      has_more: offset + limit < count,
    },
  };
}
