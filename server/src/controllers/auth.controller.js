import { z } from 'zod';
import * as authService from '../services/auth.service.js';
import { parse } from '../utils/validate.js';

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(72),
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be 20 characters or fewer')
    .regex(/^\w+$/, 'Username may only contain letters, numbers, and underscores'),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password').max(72),
});

const refreshSchema = z.object({
  refresh_token: z.string().min(1).max(2000),
});

export async function register(req, res, next) {
  try {
    const data = await authService.register(parse(registerSchema, req.body));
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const data = await authService.login(parse(loginSchema, req.body));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req, res, next) {
  try {
    const { refresh_token: refreshToken } = parse(refreshSchema, req.body);
    const data = await authService.refresh(refreshToken);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
