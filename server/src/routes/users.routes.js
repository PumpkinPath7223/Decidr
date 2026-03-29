import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import * as votesService from '../services/votes.service.js';

const router = Router();

// GET /api/users/:id/votes — returns the authenticated user's votes (only own votes allowed)
router.get('/:id/votes', requireAuth, async (req, res, next) => {
  if (req.params.id !== req.user.id) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }
  try {
    const votes = await votesService.getUserVotes(req.user.id);
    return res.json({ success: true, data: votes });
  } catch (err) {
    next(err);
  }
});

export default router;
