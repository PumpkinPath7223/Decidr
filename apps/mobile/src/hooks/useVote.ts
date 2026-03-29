import { useMutation, useQueryClient } from '@tanstack/react-query';
import { voteApi, type FeedResponse } from '../services/api.service';
import { useAuthStore } from '../store/auth.store';

export function useVote(postId: string) {
  const token = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (choice: 'A' | 'B') => {
      console.log('[useVote] mutationFn called', { postId, choice, hasToken: !!token });
      if (!token) throw new Error('Not authenticated');
      return voteApi.castVote(postId, choice, token);
    },
    onSuccess: (result) => {
      // Patch every cached feed page so the voter_stats rank is fresh
      // (vote counts stay hidden until reveal — no count update needed here)
      queryClient.setQueriesData<{ pages: FeedResponse[] }>(
        { queryKey: ['feed'] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              posts: page.posts.map((p) =>
                p.id === postId
                  ? { ...p } // post itself unchanged; counts still hidden
                  : p
              ),
            })),
          };
        }
      );
      // Also update the auth store rank/points so VoteConfirmation is fresh
      const { rank, points } = result.voter_stats;
      const { user, setAuth } = useAuthStore.getState();
      if (user && token) {
        void setAuth(token, { ...user, rank, points });
      }
    },
  });
}
