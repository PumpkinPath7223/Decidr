import { Router } from 'express';
import {
  clearPushToken,
  deleteAccount,
  getMe,
  getMyPosts,
  getMyVotes,
  getPublicProfile,
  setPushToken,
} from '../controllers/users.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

// '/me' routes are registered before '/:id' so "me" is never read as an id.
router.get('/me', requireAuth, getMe);
router.delete('/me', requireAuth, deleteAccount);
router.get('/me/posts', requireAuth, getMyPosts);
router.get('/me/votes', requireAuth, getMyVotes);
router.put('/me/push-token', requireAuth, setPushToken);
router.delete('/me/push-token', requireAuth, clearPushToken);
router.get('/:id/profile', getPublicProfile);

export default router;
