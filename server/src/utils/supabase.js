import { createClient } from '@supabase/supabase-js';

const AUTH_OPTIONS = { auth: { persistSession: false, autoRefreshToken: false } };

function requireEnv() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  }
}

let adminClient = null;

function getAdminClient() {
  if (!adminClient) {
    requireEnv();
    adminClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, AUTH_OPTIONS);
  }
  return adminClient;
}

// Service-role client used for all database access. It must never sign a user in:
// signInWithPassword() stores the user's session on the client, and every later
// query would then run as that user instead of the service role.
const supabase = new Proxy(
  {},
  {
    get(_target, prop) {
      const client = getAdminClient();
      const value = client[prop];
      return typeof value === 'function' ? value.bind(client) : value;
    },
  }
);

export default supabase;

// A throwaway client for sign-in / token refresh, so sessions never leak between requests.
export function createAuthClient() {
  requireEnv();
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, AUTH_OPTIONS);
}
