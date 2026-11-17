import { Router } from 'express';
import { addComment, listComments } from '../controllers/comments.controller.js';
import { createPost, deletePost, getPost, validateCreatePost } from '../controllers/posts.controller.js';
import { submitReveal } from '../controllers/reveal.controller.js';
import { castVote } from '../controllers/votes.controller.js';
import { optionalAuth, requireAuth } from '../middleware/auth.middleware.js';
import { commentRateLimit, postRateLimit, voteRateLimit } from '../middleware/rateLimit.middleware.js';

const router = Router();

router.post('/', requireAuth, validateCreatePost, postRateLimit, createPost);
router.get('/:id', optionalAuth, getPost);
router.delete('/:id', requireAuth, deletePost);
router.post('/:id/vote', requireAuth, voteRateLimit, castVote);
router.post('/:id/reveal', requireAuth, submitReveal);
router.get('/:id/comments', optionalAuth, listComments);
router.post('/:id/comments', requireAuth, commentRateLimit, addComment);

export default router;
