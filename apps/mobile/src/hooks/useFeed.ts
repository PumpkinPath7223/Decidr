import { useInfiniteQuery } from '@tanstack/react-query';
import { feedApi, type FeedResponse } from '../services/api.service';
import { useAuthStore } from '../store/auth.store';

export function useFeed(hashtag?: string) {
  const token = useAuthStore((s) => s.token);

  return useInfiniteQuery<FeedResponse>({
    queryKey: ['feed', hashtag, !!token],
    queryFn: async ({ pageParam }) => {
      const result = await feedApi.getFeed(pageParam as number, hashtag, token);
      console.log(`[useFeed] page ${pageParam}: received ${result.posts.length} posts, total=${result.pagination.total}`);
      return result;
    },
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.pagination.has_more ? last.pagination.page + 1 : undefined,
    refetchInterval: 10000,
  });
}
