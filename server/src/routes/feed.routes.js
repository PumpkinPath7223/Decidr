import { Router } from 'express';
import { getFeed } from '../controllers/posts.controller.js';
import { optionalAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', optionalAuth, getFeed);

export default router;
