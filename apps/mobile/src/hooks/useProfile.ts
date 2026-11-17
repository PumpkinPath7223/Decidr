import { useQuery } from '@tanstack/react-query';
import { statsApi, usersApi } from '../services/api.service';
import { queryKeys } from './postCache';

export function useProfile() {
  return useQuery({ queryKey: queryKeys.profile, queryFn: usersApi.me });
}

export function useLeaderboard() {
  return useQuery({ queryKey: queryKeys.leaderboard, queryFn: statsApi.leaderboard, staleTime: 60_000 });
}

export function useRegretIndex() {
  return useQuery({ queryKey: queryKeys.regretIndex, queryFn: statsApi.regretIndex, staleTime: 60_000 });
}
