import supabase from '../utils/supabase.js';
import { AppError, throwDbError } from '../utils/AppError.js';
import { FEED_PAGE_SIZE, LIVE_CRISIS_SECONDS, REVEAL_TIMERS } from '../utils/constants.js';
import { decodeCursor, encodeCursor } from '../utils/cursor.js';
import { CRISIS_MESSAGE, containsAbuse, containsCrisisLanguage } from '../utils/moderation.js';
import { serializePost } from '../serializers/posts.serializer.js';

async function queryPosts({ viewerId = null, tag = null, postId = null, scope = 'feed', cursor = null, limit = FEED_PAGE_SIZE }) {
  const { data, error } = await supabase.rpc('query_posts', {
    p_viewer_id: viewerId,
    p_tag: tag,
    p_post_id: postId,
    p_scope: scope,
    p_cursor_created_at: cursor?.createdAt ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_limit: limit,
  });
  throwDbError(error);
  return data ?? [];
}

// One page of posts plus the cursor for the next one. Asks for one extra row to know
// whether another page exists.
async function listPosts({ viewerId, tag, scope, cursor }) {
  const rows = await queryPosts({
    viewerId,
    tag,
    scope,
    cursor: decodeCursor(cursor),
    limit: FEED_PAGE_SIZE + 1,
  });
  const page = rows.slice(0, FEED_PAGE_SIZE);
  const hasMore = rows.length > FEED_PAGE_SIZE;

  return {
    posts: page.map((row) => serializePost(row, viewerId)),
    next_cursor: hasMore ? encodeCursor(page[page.length - 1]) : null,
  };
}

export function getFeed({ viewerId = null, tag = null, cursor = null }) {
  return listPosts({ viewerId, tag, scope: 'feed', cursor });
}

export function getMyPosts({ userId, cursor = null }) {
  return listPosts({ viewerId: userId, tag: null, scope: 'mine', cursor });
}

export function getMyVotedPosts({ userId, cursor = null }) {
  return listPosts({ viewerId: userId, tag: null, scope: 'voted', cursor });
}

export async function getPostById(postId, viewerId = null) {
  const [row] = await queryPosts({ viewerId, postId, limit: 1 });
  if (!row) throw new AppError(404, 'Post not found');
  return serializePost(row, viewerId);
}

export async function createPost(authorId, input) {
  const texts = [input.title, input.context, input.option_a, input.option_b];
  if (containsCrisisLanguage(...texts)) {
    throw new AppError(422, CRISIS_MESSAGE, 'CRISIS_RESOURCES');
  }
  if (containsAbuse(...texts)) {
    throw new AppError(422, 'This post contains language that is not allowed on Decidr', 'CONTENT_REJECTED');
  }

  const seconds = input.is_live_crisis ? LIVE_CRISIS_SECONDS : REVEAL_TIMERS[input.reveal_in];
  const revealAt = new Date(Date.now() + seconds * 1000).toISOString();

  const { data, error } = await supabase
    .from('posts')
    .insert({
      author_id: authorId,
      title: input.title,
      context: input.context ?? null,
      option_a: input.option_a,
      option_b: input.option_b,
      category_tags: input.category_tags,
      reveal_at: revealAt,
      is_live_crisis: input.is_live_crisis,
      comments_enabled: input.comments_enabled,
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new AppError(409, 'You already have a Live Crisis post running. Wait for it to close first.');
    }
    if (error.code === '23503') throw new AppError(404, 'User not found');
    throw error;
  }

  return getPostById(data.id, authorId);
}

export async function deletePost(authorId, postId) {
  const { error } = await supabase.rpc('delete_post', { p_author_id: authorId, p_post_id: postId });
  throwDbError(error);
}
