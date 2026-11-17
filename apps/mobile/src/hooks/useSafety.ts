import { useMutation, useQueryClient } from '@tanstack/react-query';
import { safetyApi } from '../services/api.service';
import { type ContentTarget } from '../types';
import { queryKeys } from './postCache';

export function useReport() {
  return useMutation({
    mutationFn: ({ target, reason }: { target: ContentTarget; reason: string }) => safetyApi.report(target, reason),
  });
}

/** Blocks whoever wrote the post or comment. Their content disappears on the next fetch. */
export function useBlock() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (target: ContentTarget) => safetyApi.block(target),
    onSuccess: (_data, target) => {
      void client.invalidateQueries({ queryKey: queryKeys.posts });
      if (target.target_type === 'comment') void client.invalidateQueries({ queryKey: ['comments'] });
    },
  });
}

export function useClearBlocks() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => safetyApi.clearBlocks(),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.posts });
      void client.invalidateQueries({ queryKey: ['comments'] });
    },
  });
}
