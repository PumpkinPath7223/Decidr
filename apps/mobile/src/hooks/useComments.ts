import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { postsApi } from '../services/api.service';
import { type Comment } from '../types';
import { patchPost, queryKeys } from './postCache';

export function useComments(postId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.comments(postId),
    queryFn: () => postsApi.comments(postId),
    enabled,
  });
}

export function useAddComment(postId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => postsApi.addComment(postId, body),
    onSuccess: (comment) => {
      client.setQueryData<Comment[]>(queryKeys.comments(postId), (existing) => [...(existing ?? []), comment]);
      patchPost(client, postId, (post) => ({ ...post, comment_count: post.comment_count + 1 }));
    },
  });
}
