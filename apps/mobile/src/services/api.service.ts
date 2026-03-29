const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const { headers: extraHeaders, ...restOptions } = options ?? {};
  if (__DEV__ && restOptions.body) {
    console.log('[api] request', restOptions.method, path, 'body:', restOptions.body);
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    ...restOptions,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? 'Request failed');
  return json.data as T;
}

export type Post = {
  id: string;
  title: string;
  context: string | null;
  option_a: string;
  option_b: string;
  category_tags: string[];
  revealed: boolean;
  outcome_text: string | null;
  poster_feeling: 'happy' | 'regret' | null;
  is_live_crisis: boolean;
  is_owner: boolean;
  created_at: string;
  votes_a: number | null;
  votes_b: number | null;
  total_votes: number | null;
};

export type FeedResponse = {
  posts: Post[];
  pagination: { page: number; limit: number; total: number; has_more: boolean };
};

export type VoteResult = {
  vote: { id: string; choice: string; weight: number; created_at: string };
  voter_stats: { points: number; total_votes: number; rank: string };
};

export const feedApi = {
  getFeed: async (page = 1, hashtag?: string, token?: string | null) => {
    const params = new URLSearchParams({ page: String(page) });
    if (hashtag) params.set('hashtag', hashtag);
    const result = await request<FeedResponse>(`/api/feed?${params}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (__DEV__) {
      console.log('[feed] first post raw:', JSON.stringify(result.posts[0], null, 2));
    }
    return result;
  },

  getPost: (id: string) => request<Post>(`/api/posts/${id}`),
};

export const voteApi = {
  castVote: (postId: string, choice: 'A' | 'B', token: string) =>
    request<VoteResult>(`/api/posts/${postId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ choice }),
      headers: { Authorization: `Bearer ${token}` },
    }),
};

export type RevealResult = {
  revealed: boolean;
  winning_choice: 'A' | 'B';
  correct_voters: number;
};

export const revealApi = {
  submit: (postId: string, outcome_text: string, poster_feeling: 'happy' | 'regret', token: string) =>
    request<RevealResult>(`/api/posts/${postId}/reveal`, {
      method: 'POST',
      body: JSON.stringify({ outcome_text, poster_feeling }),
      headers: { Authorization: `Bearer ${token}` },
    }),
};

export type AuthUser = {
  id: string;
  email: string;
  username: string;
  rank?: string;
  points?: number;
  accuracy_score?: number;
};

export type AuthResponse = { token: string; user: AuthUser };

export const authApi = {
  login: (email: string, password: string) =>
    request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (email: string, password: string, username: string) =>
    request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, username }),
    }),
};

export type UserVote = { post_id: string; choice: 'A' | 'B' };

export const usersApi = {
  getMyVotes: (userId: string, token: string) =>
    request<UserVote[]>(`/api/users/${userId}/votes`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
};
