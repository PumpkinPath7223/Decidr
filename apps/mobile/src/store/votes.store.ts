import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const STORAGE_KEY = 'decidr-votes';

type VotesState = {
  votes: Record<string, 'A' | 'B'>;
  hydrated: boolean;
  setVote: (postId: string, choice: 'A' | 'B') => void;
  clearVote: (postId: string) => void;
  preloadVotes: (entries: { post_id: string; choice: 'A' | 'B' }[]) => void;
  hydrate: () => Promise<void>;
};

function persist(votes: Record<string, 'A' | 'B'>) {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(votes)).catch(() => {});
}

export const useVotesStore = create<VotesState>((set, get) => ({
  votes: {},
  hydrated: false,

  setVote: (postId, choice) => {
    set((s) => ({ votes: { ...s.votes, [postId]: choice } }));
    persist(get().votes); // get() reflects the updated state synchronously after set
  },

  // Only called on API error to revert an optimistic vote that failed.
  clearVote: (postId) => {
    set((s) => {
      const votes = { ...s.votes };
      delete votes[postId];
      return { votes };
    });
    persist(get().votes);
  },

  // Merges server-side votes into the store. Local store wins on conflict so
  // any in-flight optimistic choices are never overwritten.
  preloadVotes: (entries) => {
    set((s) => {
      const votes = { ...s.votes };
      for (const { post_id, choice } of entries) {
        if (!(post_id in votes)) votes[post_id] = choice as 'A' | 'B';
      }
      return { votes };
    });
  },

  // Called once on app startup to restore votes from AsyncStorage.
  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as Record<string, 'A' | 'B'>;
        // Merge: existing in-memory votes (from optimistic updates that may have
        // fired before hydration) take priority over the stored value.
        set((s) => ({ votes: { ...stored, ...s.votes }, hydrated: true }));
      } else {
        set({ hydrated: true });
      }
    } catch {
      set({ hydrated: true });
    }
  },
}));
