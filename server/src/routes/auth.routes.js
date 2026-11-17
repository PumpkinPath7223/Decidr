import { Router } from 'express';
import { login, refresh, register } from '../controllers/auth.controller.js';
import { authRateLimit } from '../middleware/rateLimit.middleware.js';

const router = Router();

router.post('/register', authRateLimit, register);
router.post('/login', authRateLimit, login);
router.post('/refresh', authRateLimit, refresh);

export default router;
