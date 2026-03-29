import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { createPost, getPost } from '../controllers/posts.controller.js';
import { castVote } from '../controllers/votes.controller.js';
import { submitReveal } from '../controllers/reveal.controller.js';
import { voteRateLimit } from '../middleware/voteRateLimit.middleware.js';

const router = Router();

router.get('/:id', getPost);
router.post('/', requireAuth, createPost);
router.post('/:id/vote', requireAuth, voteRateLimit, castVote);
router.post('/:id/reveal', requireAuth, submitReveal);

export default router;
