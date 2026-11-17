import { z } from 'zod';
import * as postsService from '../services/posts.service.js';
import * as usersService from '../services/users.service.js';
import { parse, parseId } from '../utils/validate.js';

const pushTokenSchema = z.object({
  push_token: z.string().min(1).max(200),
});

const listQuerySchema = z.object({
  cursor: z.string().max(300).optional(),
});

export async function getMe(req, res, next) {
  try {
    res.json({ success: true, data: await usersService.getMe(req.user.id) });
  } catch (err) {
    next(err);
  }
}

export async function getMyPosts(req, res, next) {
  try {
    const { cursor } = parse(listQuerySchema, req.query);
    res.json({ success: true, data: await postsService.getMyPosts({ userId: req.user.id, cursor }) });
  } catch (err) {
    next(err);
  }
}

export async function getMyVotes(req, res, next) {
  try {
    const { cursor } = parse(listQuerySchema, req.query);
    res.json({ success: true, data: await postsService.getMyVotedPosts({ userId: req.user.id, cursor }) });
  } catch (err) {
    next(err);
  }
}

export async function getPublicProfile(req, res, next) {
  try {
    res.json({ success: true, data: await usersService.getPublicProfile(parseId(req.params.id)) });
  } catch (err) {
    next(err);
  }
}

export async function setPushToken(req, res, next) {
  try {
    const { push_token: token } = parse(pushTokenSchema, req.body);
    res.json({ success: true, data: await usersService.setPushToken(req.user.id, token) });
  } catch (err) {
    next(err);
  }
}

export async function clearPushToken(req, res, next) {
  try {
    res.json({ success: true, data: await usersService.setPushToken(req.user.id, null) });
  } catch (err) {
    next(err);
  }
}

export async function deleteAccount(req, res, next) {
  try {
    res.json({ success: true, data: await usersService.deleteAccount(req.user.id) });
  } catch (err) {
    next(err);
  }
}
