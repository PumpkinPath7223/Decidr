import { z } from 'zod';
import * as commentsService from '../services/comments.service.js';
import { LIMITS } from '../utils/constants.js';
import { parse, parseId } from '../utils/validate.js';

const commentSchema = z.object({
  body: z.string().trim().min(LIMITS.comment.min, 'Write something first').max(LIMITS.comment.max),
});

export async function listComments(req, res, next) {
  try {
    const data = await commentsService.listComments(parseId(req.params.id), req.user?.id ?? null);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function addComment(req, res, next) {
  try {
    const { body } = parse(commentSchema, req.body);
    const data = await commentsService.addComment(req.user.id, parseId(req.params.id), body);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
