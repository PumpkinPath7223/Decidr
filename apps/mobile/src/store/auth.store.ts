import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { type AuthUser } from '../services/api.service';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  hydrated: boolean;
  setAuth: (token: string, user: AuthUser) => Promise<void>;
  clearAuth: () => Promise<void>;
  hydrate: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  hydrated: false,

  setAuth: async (token, user) => {
    await Promise.all([
      AsyncStorage.setItem(TOKEN_KEY, token),
      AsyncStorage.setItem(USER_KEY, JSON.stringify(user)),
    ]);
    set({ token, user });
  },

  clearAuth: async () => {
    await Promise.all([
      AsyncStorage.removeItem(TOKEN_KEY),
      AsyncStorage.removeItem(USER_KEY),
    ]);
    set({ token: null, user: null });
  },

  hydrate: async () => {
    try {
      const [token, userJson] = await Promise.all([
        AsyncStorage.getItem(TOKEN_KEY),
        AsyncStorage.getItem(USER_KEY),
      ]);
      const user = userJson ? (JSON.parse(userJson) as AuthUser) : null;
      set({ token, user, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
}));
