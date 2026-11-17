export type Choice = 'A' | 'B';
export type Feeling = 'happy' | 'regret';
export type Rank = 'Rookie' | 'Analyst' | 'Strategist' | 'Oracle';
export type PostStatus = 'open' | 'awaiting_outcome' | 'revealed' | 'unresolved' | 'removed';

export const CATEGORIES = ['career', 'money', 'relationships', 'health', 'lifestyle', 'education'] as const;
export type Category = (typeof CATEGORIES)[number];

export const REVEAL_TIMERS = [
  { value: '24h', label: '24 hours' },
  { value: '72h', label: '3 days' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
] as const;
export type RevealTimer = (typeof REVEAL_TIMERS)[number]['value'];

export type PostResult = { total_votes: number; pct_a: number | null; pct_b: number | null };

export type PostOutcome = {
  chosen_option: Choice;
  poster_feeling: Feeling;
  outcome_text: string | null;
  revealed_at: string | null;
  correct_side: Choice;
  my_is_correct: boolean | null;
};

export type Post = {
  id: string;
  title: string;
  context: string | null;
  option_a: string;
  option_b: string;
  category_tags: Category[];
  reveal_at: string;
  status: PostStatus;
  is_live_crisis: boolean;
  comments_enabled: boolean;
  comment_count: number;
  created_at: string;
  is_owner: boolean;
  my_choice: Choice | null;
  can_vote: boolean;
  can_reveal: boolean;
  /** null while the split is hidden from this viewer */
  result: PostResult | null;
  /** null until the author reveals */
  outcome: PostOutcome | null;
};

export type PostPage = { posts: Post[]; next_cursor: string | null };

export type AuthUser = {
  id: string;
  email: string;
  username: string;
  rank: Rank;
  points: number;
  accuracy_score: number | null;
};

export type Session = { token: string; refresh_token: string; expires_at: number | null; user: AuthUser };

export type VoteResponse = {
  vote: { post_id: string; choice: Choice; weight: number };
  voter_stats: { points: number; points_awarded: number; total_votes: number; rank: Rank };
};

export type RevealResponse = {
  post: Post;
  correct_side: Choice;
  total_voters: number;
  correct_voters: number;
};

export type Comment = {
  id: string;
  body: string;
  username: string;
  voter_choice: Choice;
  rank: Rank;
  accuracy: number | null;
  created_at: string;
  is_mine: boolean;
};

export type CategoryAccuracy = {
  tag: Category;
  resolved_votes: number;
  correct_votes: number;
  accuracy: number | null;
};

export type RankProgress = {
  rank: Rank;
  weight: number;
  next_rank: Rank | null;
  points_to_next: number;
  progress: number;
};

export type Profile = {
  id: string;
  username: string;
  avatar_url: string | null;
  rank: Rank;
  points: number;
  accuracy_score: number | null;
  resolved_votes: number;
  correct_votes: number;
  votes_until_accuracy: number;
  total_votes: number;
  total_posts: number;
  created_at: string;
  rank_progress: RankProgress;
  categories: CategoryAccuracy[];
};

export type LeaderboardEntry = {
  position: number;
  id: string;
  username: string;
  rank: Rank;
  points: number;
  accuracy_score: number;
  resolved_votes: number;
};

export type RegretEntry = {
  tag: Category;
  revealed_posts: number;
  enough_data: boolean;
  posts_needed: number;
  regret_pct: number | null;
  happy_pct: number | null;
};

export type CreatePostInput = {
  title: string;
  context?: string;
  option_a: string;
  option_b: string;
  category_tags: Category[];
  reveal_in?: RevealTimer;
  is_live_crisis: boolean;
  comments_enabled: boolean;
};

export type RevealInput = { chosen_option: Choice; poster_feeling: Feeling; outcome_text?: string };

export type ContentTarget = { target_type: 'post' | 'comment'; target_id: string };
