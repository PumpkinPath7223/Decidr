import { create } from 'zustand';
import { secureStorage } from '../services/storage.service';
import { type AuthUser, type Session } from '../types';

const TOKEN_KEY = 'auth_token';
const REFRESH_KEY = 'auth_refresh_token';
const USER_KEY = 'auth_user';

type AuthState = {
  token: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  hydrated: boolean;
  setSession: (session: Session) => Promise<void>;
  setTokens: (token: string, refreshToken: string) => Promise<void>;
  patchUser: (patch: Partial<AuthUser>) => void;
  clearAuth: () => Promise<void>;
  hydrate: () => Promise<void>;
};

// Storage failures must never block signing in or out; the in-memory state is the source
// of truth for the running app.
async function quietly(task: Promise<unknown>): Promise<void> {
  try {
    await task;
  } catch {
    // ignore
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  refreshToken: null,
  user: null,
  hydrated: false,

  setSession: async (session) => {
    set({ token: session.token, refreshToken: session.refresh_token, user: session.user });
    await quietly(
      Promise.all([
        secureStorage.set(TOKEN_KEY, session.token),
        secureStorage.set(REFRESH_KEY, session.refresh_token),
        secureStorage.set(USER_KEY, JSON.stringify(session.user)),
      ])
    );
  },

  setTokens: async (token, refreshToken) => {
    set({ token, refreshToken });
    await quietly(
      Promise.all([secureStorage.set(TOKEN_KEY, token), secureStorage.set(REFRESH_KEY, refreshToken)])
    );
  },

  patchUser: (patch) => {
    const current = get().user;
    if (!current) return;
    const user = { ...current, ...patch };
    set({ user });
    void quietly(secureStorage.set(USER_KEY, JSON.stringify(user)));
  },

  clearAuth: async () => {
    set({ token: null, refreshToken: null, user: null });
    await quietly(
      Promise.all([
        secureStorage.remove(TOKEN_KEY),
        secureStorage.remove(REFRESH_KEY),
        secureStorage.remove(USER_KEY),
      ])
    );
  },

  hydrate: async () => {
    try {
      const [token, refreshToken, userJson] = await Promise.all([
        secureStorage.get(TOKEN_KEY),
        secureStorage.get(REFRESH_KEY),
        secureStorage.get(USER_KEY),
      ]);
      const user = userJson ? (JSON.parse(userJson) as AuthUser) : null;
      // A token without its user (or the reverse) is not a usable session.
      if (token && user) set({ token, refreshToken, user, hydrated: true });
      else set({ hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
}));
