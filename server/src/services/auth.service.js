import supabase, { createAuthClient } from '../utils/supabase.js';
import { AppError, throwDbError } from '../utils/AppError.js';
import { containsAbuse } from '../utils/moderation.js';

const PROFILE_COLUMNS = 'id, username, rank, points, accuracy_score';

function sessionPayload(session, user) {
  return {
    token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at ?? null,
    user,
  };
}

async function signIn(email, password) {
  const { data, error } = await createAuthClient().auth.signInWithPassword({ email, password });
  if (error || !data?.session) return null;
  return data;
}

export async function register({ email, password, username }) {
  if (containsAbuse(username)) {
    throw new AppError(400, 'Please choose a different username');
  }

  const { data: existing, error: lookupError } = await supabase
    .from('users')
    .select('id')
    .ilike('username', username.replace(/_/g, '\\_'))
    .maybeSingle();
  throwDbError(lookupError);
  if (existing) throw new AppError(409, 'Username already taken');

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !created?.user) {
    if (createError?.code === 'email_exists' || /already.*registered/i.test(createError?.message ?? '')) {
      throw new AppError(409, 'Email already registered');
    }
    if (createError?.code === 'weak_password') {
      throw new AppError(400, 'Password is too weak');
    }
    throw createError ?? new Error('createUser returned no user');
  }

  const authUser = created.user;
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .insert({ id: authUser.id, username })
    .select(PROFILE_COLUMNS)
    .single();

  if (profileError) {
    // Do not leave an auth account without a profile row.
    await supabase.auth.admin.deleteUser(authUser.id);
    if (profileError.code === '23505') throw new AppError(409, 'Username already taken');
    throw profileError;
  }

  const signedIn = await signIn(email, password);
  if (!signedIn) throw new AppError(500, 'Account created — please sign in');

  return sessionPayload(signedIn.session, { ...profile, email: authUser.email });
}

export async function login({ email, password }) {
  const signedIn = await signIn(email, password);
  if (!signedIn) throw new AppError(401, 'Invalid email or password');

  const { data: profile, error } = await supabase
    .from('users')
    .select(PROFILE_COLUMNS)
    .eq('id', signedIn.user.id)
    .maybeSingle();
  throwDbError(error);
  if (!profile) throw new AppError(401, 'Invalid email or password');

  return sessionPayload(signedIn.session, { ...profile, email: signedIn.user.email });
}

// Supabase access tokens last about an hour; the app trades its refresh token for a new pair.
export async function refresh(refreshToken) {
  const { data, error } = await createAuthClient().auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data?.session) {
    throw new AppError(401, 'Session expired. Please sign in again.', 'SESSION_EXPIRED');
  }
  return {
    token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at ?? null,
  };
}
