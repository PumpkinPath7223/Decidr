import { Router } from 'express';
import { block, clearBlocks, report } from '../controllers/safety.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { reportRateLimit } from '../middleware/rateLimit.middleware.js';

const router = Router();

router.post('/reports', requireAuth, reportRateLimit, report);
router.post('/blocks', requireAuth, block);
router.delete('/blocks', requireAuth, clearBlocks);

export default router;
