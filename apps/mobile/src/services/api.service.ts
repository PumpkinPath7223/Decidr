import { useAuthStore } from '../store/auth.store';
import {
  type Category,
  type Choice,
  type Comment,
  type ContentTarget,
  type CreatePostInput,
  type LeaderboardEntry,
  type Post,
  type PostPage,
  type Profile,
  type RegretEntry,
  type RevealInput,
  type RevealResponse,
  type Session,
  type VoteResponse,
} from '../types';

const BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

export class ApiError extends Error {
  status: number;
  code: string | null;

  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

type Envelope<T> = { success: true; data: T } | { success: false; error?: string; code?: string };

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
};

async function send<T>(path: string, options: RequestOptions, token: string | null): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0, 'NETWORK');
  }

  let json: Envelope<T>;
  try {
    json = (await response.json()) as Envelope<T>;
  } catch {
    throw new ApiError('Something went wrong. Please try again.', response.status);
  }

  if (!json.success) {
    throw new ApiError(json.error ?? 'Request failed', response.status, json.code ?? null);
  }
  return json.data;
}

// Access tokens last about an hour. All requests that hit a 401 at the same time share one
// refresh call.
let refreshInFlight: Promise<'refreshed' | 'expired' | 'offline'> | null = null;

async function refreshSession(): Promise<'refreshed' | 'expired' | 'offline'> {
  const { refreshToken, setTokens } = useAuthStore.getState();
  if (!refreshToken) return 'expired';
  try {
    const data = await send<{ token: string; refresh_token: string }>(
      '/api/auth/refresh',
      { method: 'POST', body: { refresh_token: refreshToken } },
      null
    );
    await setTokens(data.token, data.refresh_token);
    return 'refreshed';
  } catch (err) {
    // Only a definite "no" from the server ends the session; being offline does not.
    return err instanceof ApiError && err.status === 401 ? 'expired' : 'offline';
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = useAuthStore.getState().token;
  try {
    return await send<T>(path, options, token);
  } catch (err) {
    const isAuthFailure = err instanceof ApiError && err.status === 401 && token !== null;
    if (!isAuthFailure) throw err;

    refreshInFlight ??= (async () => {
      try {
        return await refreshSession();
      } finally {
        refreshInFlight = null;
      }
    })();
    const outcome = await refreshInFlight;

    if (outcome === 'refreshed') {
      return send<T>(path, options, useAuthStore.getState().token);
    }
    if (outcome === 'expired') {
      await useAuthStore.getState().clearAuth();
      throw new ApiError('Your session expired. Please sign in again.', 401, 'SESSION_EXPIRED');
    }
    throw err;
  }
}

function query(params: Record<string, string | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export const authApi = {
  login: (email: string, password: string) =>
    send<Session>('/api/auth/login', { method: 'POST', body: { email, password } }, null),
  register: (email: string, password: string, username: string) =>
    send<Session>('/api/auth/register', { method: 'POST', body: { email, password, username } }, null),
};

export const postsApi = {
  feed: (tag: Category | null, cursor: string | null) => request<PostPage>(`/api/feed${query({ tag, cursor })}`),
  get: (id: string) => request<Post>(`/api/posts/${id}`),
  create: (input: CreatePostInput) => request<Post>('/api/posts', { method: 'POST', body: input }),
  remove: (id: string) => request<{ deleted: boolean }>(`/api/posts/${id}`, { method: 'DELETE' }),
  vote: (id: string, choice: Choice) =>
    request<VoteResponse>(`/api/posts/${id}/vote`, { method: 'POST', body: { choice } }),
  reveal: (id: string, input: RevealInput) =>
    request<RevealResponse>(`/api/posts/${id}/reveal`, { method: 'POST', body: input }),
  comments: (id: string) => request<Comment[]>(`/api/posts/${id}/comments`),
  addComment: (id: string, body: string) =>
    request<Comment>(`/api/posts/${id}/comments`, { method: 'POST', body: { body } }),
};

export const usersApi = {
  me: () => request<Profile>('/api/users/me'),
  myPosts: (cursor: string | null) => request<PostPage>(`/api/users/me/posts${query({ cursor })}`),
  myVotes: (cursor: string | null) => request<PostPage>(`/api/users/me/votes${query({ cursor })}`),
  setPushToken: (pushToken: string) =>
    request<{ registered: boolean }>('/api/users/me/push-token', { method: 'PUT', body: { push_token: pushToken } }),
  clearPushToken: () => request<{ registered: boolean }>('/api/users/me/push-token', { method: 'DELETE' }),
  deleteAccount: () => request<{ deleted: boolean }>('/api/users/me', { method: 'DELETE' }),
};

export const statsApi = {
  leaderboard: () => request<LeaderboardEntry[]>('/api/leaderboard'),
  regretIndex: () => request<RegretEntry[]>('/api/regret-index'),
};

export const safetyApi = {
  report: (target: ContentTarget, reason: string) =>
    request<{ reported: boolean }>('/api/reports', { method: 'POST', body: { ...target, reason } }),
  block: (target: ContentTarget) => request<{ blocked: boolean }>('/api/blocks', { method: 'POST', body: target }),
  clearBlocks: () => request<{ cleared: boolean }>('/api/blocks', { method: 'DELETE' }),
};

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong';
}
