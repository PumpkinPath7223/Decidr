import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { postsApi, usersApi } from '../services/api.service';
import { useAuthStore } from '../store/auth.store';
import { type Category, type CreatePostInput, type Post, type PostPage, type RevealInput } from '../types';
import { patchPost, queryKeys, removePost } from './postCache';

const LIVE_REFRESH_MS = 5_000;

function usePostList(queryKey: readonly unknown[], fetchPage: (cursor: string | null) => Promise<PostPage>) {
  return useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
  });
}

export function useFeed(tag: Category | null) {
  return usePostList(queryKeys.feed(tag), (cursor) => postsApi.feed(tag, cursor));
}

export function useMyPosts() {
  return usePostList(queryKeys.myPosts, usersApi.myPosts);
}

export function useMyVotes() {
  return usePostList(queryKeys.myVotes, usersApi.myVotes);
}

export function usePost(id: string) {
  return useQuery({
    queryKey: queryKeys.post(id),
    queryFn: () => postsApi.get(id),
    // Live Crisis posts show the split while voting is open, so keep it fresh.
    refetchInterval: (query) => {
      const post = query.state.data;
      return post?.is_live_crisis && post.status === 'open' ? LIVE_REFRESH_MS : false;
    },
  });
}

export function useVote(postId: string) {
  const client = useQueryClient();
  const patchUser = useAuthStore((s) => s.patchUser);

  return useMutation({
    mutationFn: (choice: 'A' | 'B') => postsApi.vote(postId, choice),
    // Optimistic: lock the choice in immediately, roll back if the server says no.
    onMutate: async (choice) => {
      await client.cancelQueries({ queryKey: queryKeys.posts });
      await client.cancelQueries({ queryKey: queryKeys.post(postId) });
      patchPost(client, postId, (post) => ({ ...post, my_choice: choice, can_vote: false }));
    },
    onError: () => {
      patchPost(client, postId, (post) => ({ ...post, my_choice: null, can_vote: post.status === 'open' }));
      void client.invalidateQueries({ queryKey: queryKeys.post(postId) });
    },
    onSuccess: ({ voter_stats: stats }) => {
      patchUser({ rank: stats.rank, points: stats.points });
      void client.invalidateQueries({ queryKey: queryKeys.profile });
      void client.invalidateQueries({ queryKey: queryKeys.myVotes });
      // Live Crisis posts return the updated split.
      void client.invalidateQueries({ queryKey: queryKeys.post(postId) });
    },
  });
}

export function useCreatePost() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePostInput) => postsApi.create(input),
    onSuccess: (post) => {
      client.setQueryData<Post>(queryKeys.post(post.id), post);
      void client.invalidateQueries({ queryKey: queryKeys.posts });
      void client.invalidateQueries({ queryKey: queryKeys.profile });
    },
  });
}

export function useReveal(postId: string) {
  const client = useQueryClient();
  const patchUser = useAuthStore((s) => s.patchUser);
  return useMutation({
    mutationFn: (input: RevealInput) => postsApi.reveal(postId, input),
    onSuccess: async ({ post }) => {
      patchPost(client, postId, () => post);
      client.setQueryData<Post>(queryKeys.post(postId), post);
      // The author just earned points; pick up the new total and rank.
      const profile = await client.fetchQuery({ queryKey: queryKeys.profile, queryFn: usersApi.me, staleTime: 0 });
      patchUser({ rank: profile.rank, points: profile.points, accuracy_score: profile.accuracy_score });
    },
  });
}

export function useDeletePost(postId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => postsApi.remove(postId),
    onSuccess: () => {
      removePost(client, postId);
      void client.invalidateQueries({ queryKey: queryKeys.profile });
    },
  });
}
