import { Router } from 'express';
import { getLeaderboard, getRegretIndex, getRegretIndexForTag } from '../controllers/stats.controller.js';

const router = Router();

router.get('/leaderboard', getLeaderboard);
router.get('/regret-index', getRegretIndex);
router.get('/regret-index/:tag', getRegretIndexForTag);

export default router;
