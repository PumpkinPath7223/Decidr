import { type InfiniteData, type QueryClient } from '@tanstack/react-query';
import { type Post, type PostPage } from '../types';

// Query keys. Every list of posts lives under ['posts', ...] so one helper can patch them all.
export const queryKeys = {
  posts: ['posts'] as const,
  feed: (tag: string | null) => ['posts', 'feed', tag] as const,
  myPosts: ['posts', 'mine'] as const,
  myVotes: ['posts', 'voted'] as const,
  post: (id: string) => ['post', id] as const,
  comments: (id: string) => ['comments', id] as const,
  profile: ['profile'] as const,
  leaderboard: ['leaderboard'] as const,
  regretIndex: ['regret-index'] as const,
};

type PostLists = InfiniteData<PostPage>;

/** Applies `update` to one post everywhere it is cached: every list and the detail query. */
export function patchPost(client: QueryClient, postId: string, update: (post: Post) => Post): void {
  client.setQueriesData<PostLists>({ queryKey: queryKeys.posts }, (lists) => {
    if (!lists) return lists;
    return {
      ...lists,
      pages: lists.pages.map((page) => ({
        ...page,
        posts: page.posts.map((post) => (post.id === postId ? update(post) : post)),
      })),
    };
  });
  client.setQueryData<Post>(queryKeys.post(postId), (post) => (post ? update(post) : post));
}

/** Drops a post from every cached list (after deleting it or blocking its author). */
export function removePost(client: QueryClient, postId: string): void {
  client.setQueriesData<PostLists>({ queryKey: queryKeys.posts }, (lists) => {
    if (!lists) return lists;
    return {
      ...lists,
      pages: lists.pages.map((page) => ({
        ...page,
        posts: page.posts.filter((post) => post.id !== postId),
      })),
    };
  });
  client.removeQueries({ queryKey: queryKeys.post(postId) });
}

export function flattenPages(data: PostLists | undefined): Post[] {
  if (!data) return [];
  // A post created between two page fetches can show up twice; keep the first copy.
  const seen = new Set<string>();
  const posts: Post[] = [];
  for (const page of data.pages) {
    for (const post of page.posts) {
      if (!seen.has(post.id)) {
        seen.add(post.id);
        posts.push(post);
      }
    }
  }
  return posts;
}
