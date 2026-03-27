import { z } from 'zod';
import * as postsService from '../services/posts.service.js';

const createPostSchema = z.object({
  title: z.string().min(1).max(300),
  context: z.string().max(1000).optional(),
  option_a: z.string().min(1).max(200),
  option_b: z.string().min(1).max(200),
  category_tags: z.array(z.string().min(1).max(50)).max(5).optional().default([]),
  reveal_at: z.string().datetime({ message: 'reveal_at must be an ISO 8601 datetime' }),
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

  const { reveal_at, is_live_crisis, ...rest } = parsed.data;
  const revealDate = new Date(reveal_at);

  if (revealDate <= new Date()) {
    return res.status(400).json({ success: false, error: 'reveal_at must be in the future' });
  }

  // Live Crisis Mode: override reveal_at to exactly 2 hours from now
  const finalRevealAt = is_live_crisis
    ? new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    : reveal_at;

  try {
    const post = await postsService.createPost(req.user.id, {
      ...rest,
      reveal_at: finalRevealAt,
      is_live_crisis,
    });
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

  try {
    const result = await postsService.getFeed(parsed.data);
    return res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
