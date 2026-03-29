import { z } from 'zod';
import * as postsService from '../services/posts.service.js';

const createPostSchema = z.object({
  title: z.string().min(1).max(300),
  context: z.string().max(1000).optional(),
  option_a: z.string().min(1).max(200),
  option_b: z.string().min(1).max(200),
  category_tags: z.array(z.string().min(1).max(50)).max(5).optional().default([]),
  is_live_crisis: z.boolean().optional().default(false),
});

const feedQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1)),
  hashtag: z.string().min(1).max(50).optional(),
});

export async function createPost(req, res, next) {
  const parsed = createPostSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
  }

  try {
    const post = await postsService.createPost(req.user.id, parsed.data);
    return res.status(201).json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
}

export async function getPost(req, res, next) {
  try {
    const post = await postsService.getPostById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }
    return res.json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
}

export async function getFeed(req, res, next) {
  const parsed = feedQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
  }

  // Optionally resolve viewer id from Bearer token to power is_owner flag
  let viewerId = null;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const { data } = await import('../utils/supabase.js').then((m) =>
      m.default.auth.getUser(authHeader.slice(7))
    );
    viewerId = data?.user?.id ?? null;
  }

  try {
    const result = await postsService.getFeed({ ...parsed.data, viewerId });
    return res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
