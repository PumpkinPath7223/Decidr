-- Migration: 0001_initial_schema
-- Creates core tables: users, posts, votes, comments

-- users
CREATE TABLE users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username        text UNIQUE NOT NULL,
  avatar_url      text,
  created_at      timestamptz DEFAULT now(),
  rank            text DEFAULT 'Rookie',
  points          integer DEFAULT 0,
  accuracy_score  numeric(5,2) DEFAULT 0,
  total_votes     integer DEFAULT 0,
  total_posts     integer DEFAULT 0
);

-- posts
CREATE TABLE posts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       uuid REFERENCES users(id),
  title           text NOT NULL,
  context         text,
  option_a        text NOT NULL,
  option_b        text NOT NULL,
  category_tags   text[],
  reveal_at       timestamptz NOT NULL,
  revealed        boolean DEFAULT false,
  outcome_text    text,
  poster_feeling  text,
  is_live_crisis  boolean DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_posts_reveal_at ON posts (reveal_at);

-- votes
CREATE TABLE votes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES users(id),
  post_id     uuid REFERENCES posts(id),
  choice      text NOT NULL,
  weight      numeric(3,2) DEFAULT 1.0,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (user_id, post_id)
);

CREATE INDEX idx_votes_user_id ON votes (user_id);
CREATE INDEX idx_votes_post_id ON votes (post_id);

-- comments
CREATE TABLE comments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid REFERENCES users(id),
  post_id               uuid REFERENCES posts(id),
  body                  text NOT NULL,
  voter_choice          text,
  user_rank_at_time     text,
  user_accuracy_at_time numeric(5,2),
  created_at            timestamptz DEFAULT now()
);

CREATE INDEX idx_comments_user_id ON comments (user_id);
CREATE INDEX idx_comments_post_id ON comments (post_id);
