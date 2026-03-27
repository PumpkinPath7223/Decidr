import { Router } from 'express';
import { z } from 'zod';
import supabase from '../utils/supabase.js';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  username: z.string().min(2).max(30).regex(/^\w+$/, 'Username may only contain letters, numbers, and underscores'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
  }

  const { email, password, username } = parsed.data;

  // Check username uniqueness before creating auth user
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .maybeSingle();

  if (existing) {
    return res.status(409).json({ success: false, error: 'Username already taken' });
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    if (authError.code === 'email_exists') {
      return res.status(409).json({ success: false, error: 'Email already registered' });
    }
    return res.status(500).json({ success: false, error: 'Registration failed' });
  }

  const { error: profileError } = await supabase
    .from('users')
    .insert({ id: authData.user.id, username });

  if (profileError) {
    // Roll back the auth user to avoid orphaned accounts
    await supabase.auth.admin.deleteUser(authData.user.id);
    return res.status(500).json({ success: false, error: 'Failed to create user profile' });
  }

  // Sign in to get a session token for the new user
  const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (sessionError) {
    return res.status(500).json({ success: false, error: 'Account created but sign-in failed' });
  }

  return res.status(201).json({
    success: true,
    data: {
      token: sessionData.session.access_token,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        username,
      },
    },
  });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
  }

  const { email, password } = parsed.data;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return res.status(401).json({ success: false, error: 'Invalid email or password' });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('username, rank, points, accuracy_score')
    .eq('id', data.user.id)
    .single();

  return res.json({
    success: true,
    data: {
      token: data.session.access_token,
      user: {
        id: data.user.id,
        email: data.user.email,
        ...profile,
      },
    },
  });
});

export default router;
