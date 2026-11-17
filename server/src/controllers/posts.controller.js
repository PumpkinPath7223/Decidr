import { z } from 'zod';
import * as postsService from '../services/posts.service.js';
import { CATEGORIES, LIMITS, REVEAL_TIMERS } from '../utils/constants.js';
import { parse, parseId } from '../utils/validate.js';

const text = (min, max) => z.string().trim().min(min).max(max);

const createPostSchema = z
  .object({
    title: text(LIMITS.title.min, LIMITS.title.max),
    context: z
      .string()
      .trim()
      .max(LIMITS.context.max)
      .optional()
      .transform((value) => value || undefined),
    option_a: text(LIMITS.option.min, LIMITS.option.max),
    option_b: text(LIMITS.option.min, LIMITS.option.max),
    category_tags: z
      .array(z.enum(CATEGORIES))
      .min(LIMITS.tags.min, 'Pick at least one category')
      .max(LIMITS.tags.max, `Pick at most ${LIMITS.tags.max} categories`)
      .refine((tags) => new Set(tags).size === tags.length, 'Categories must be unique'),
    reveal_in: z.enum(Object.keys(REVEAL_TIMERS)).optional(),
    is_live_crisis: z.boolean().optional().default(false),
    comments_enabled: z.boolean().optional().default(true),
  })
  .refine((post) => post.option_a.toLowerCase() !== post.option_b.toLowerCase(), {
    message: 'The two options must be different',
    path: ['option_b'],
  })
  .refine((post) => post.is_live_crisis || post.reveal_in, {
    message: 'Pick a reveal timer',
    path: ['reveal_in'],
  });

const listQuerySchema = z.object({
  tag: z.enum(CATEGORIES).optional(),
  cursor: z.string().max(300).optional(),
});

export async function getFeed(req, res, next) {
  try {
    const { tag, cursor } = parse(listQuerySchema, req.query);
    const data = await postsService.getFeed({ viewerId: req.user?.id ?? null, tag, cursor });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getPost(req, res, next) {
  try {
    const data = await postsService.getPostById(parseId(req.params.id), req.user?.id ?? null);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// Runs before the daily post limiter so a rejected form does not use up the allowance.
export function validateCreatePost(req, res, next) {
  try {
    req.validatedBody = parse(createPostSchema, req.body);
    next();
  } catch (err) {
    next(err);
  }
}

export async function createPost(req, res, next) {
  try {
    const data = await postsService.createPost(req.user.id, req.validatedBody);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function deletePost(req, res, next) {
  try {
    await postsService.deletePost(req.user.id, parseId(req.params.id));
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
}
