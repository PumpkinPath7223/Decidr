import supabase from '../utils/supabase.js';
import { AppError } from '../utils/AppError.js';

async function resolveUserId(req) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}

// Protected routes: 401 without a valid token.
export async function requireAuth(req, res, next) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      throw new AppError(401, 'Sign in required', 'UNAUTHENTICATED');
    }
    req.user = { id: userId };
    next();
  } catch (err) {
    next(err);
  }
}

// Public routes that personalise the response when a valid token is present.
export async function optionalAuth(req, res, next) {
  try {
    const userId = await resolveUserId(req);
    req.user = userId ? { id: userId } : null;
    next();
  } catch (err) {
    next(err);
  }
}
