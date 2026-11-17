-- Migration: 0005_core_loop_foundation
-- Restores the reveal timer, adds post status + chosen_option, tallies, safety tables,
-- RLS, and moves all scoring into transactional SQL functions.
-- Written to be safe on a database where 0001–0004 are already applied.

-- ---------------------------------------------------------------------------
-- 1. users
-- ---------------------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS resolved_votes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS correct_votes  integer NOT NULL DEFAULT 0;

UPDATE users SET
  rank        = COALESCE(rank, 'Rookie'),
  points      = COALESCE(points, 0),
  total_votes = COALESCE(total_votes, 0),
  total_posts = COALESCE(total_posts, 0),
  created_at  = COALESCE(created_at, now());

ALTER TABLE users
  ALTER COLUMN accuracy_score DROP DEFAULT,
  ALTER COLUMN rank SET NOT NULL,
  ALTER COLUMN points SET NOT NULL,
  ALTER COLUMN total_votes SET NOT NULL,
  ALTER COLUMN total_posts SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_rank_check') THEN
    ALTER TABLE users ADD CONSTRAINT users_rank_check
      CHECK (rank IN ('Rookie', 'Analyst', 'Strategist', 'Oracle'));
  END IF;
  -- Profile rows belong to a Supabase auth user. NOT VALID so pre-existing rows are not re-checked.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_id_auth_fkey') THEN
    ALTER TABLE users ADD CONSTRAINT users_id_auth_fkey
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. posts
-- ---------------------------------------------------------------------------
DELETE FROM posts WHERE author_id IS NULL;

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS reveal_at          timestamptz,
  ADD COLUMN IF NOT EXISTS status             text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS chosen_option      text,
  ADD COLUMN IF NOT EXISTS revealed_at        timestamptz,
  ADD COLUMN IF NOT EXISTS reveal_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS comments_enabled   boolean NOT NULL DEFAULT true;

UPDATE posts SET
  reveal_at      = COALESCE(reveal_at, COALESCE(created_at, now()) + interval '7 days'),
  is_live_crisis = COALESCE(is_live_crisis, false),
  created_at     = COALESCE(created_at, now());

-- Bring rows written under the old, looser validation in line with the new rules.
-- (A CHECK constraint is enforced on every later UPDATE of a row, so an old row that
-- breaks the rules could never be revealed or closed.)
UPDATE posts SET
  title = CASE
    WHEN char_length(btrim(title)) < 5 THEN rpad(btrim(title), 5, '.')
    ELSE left(btrim(title), 140)
  END,
  context      = left(context, 1000),
  option_a     = COALESCE(NULLIF(left(btrim(option_a), 80), ''), 'Option A'),
  option_b     = COALESCE(NULLIF(left(btrim(option_b), 80), ''), 'Option B'),
  outcome_text = left(outcome_text, 1000),
  poster_feeling = CASE WHEN poster_feeling IN ('happy', 'regret') THEN poster_feeling END,
  -- Keep up to three recognised categories; a post with none is filed under 'lifestyle'.
  category_tags = COALESCE(
    (
      SELECT array_agg(tag ORDER BY first_seen)
      FROM (
        SELECT lower(btrim(raw.tag, ' #')) AS tag, MIN(raw.ord) AS first_seen
        FROM unnest(COALESCE(category_tags, '{}')) WITH ORDINALITY AS raw(tag, ord)
        WHERE lower(btrim(raw.tag, ' #')) IN ('career', 'money', 'relationships', 'health', 'lifestyle', 'education')
        GROUP BY 1
        ORDER BY 2
        LIMIT 3
      ) AS kept
    ),
    ARRAY['lifestyle']
  );

-- One-time conversion from the old schema, keyed on the old `revealed` column so that
-- re-running this file can never reset scores earned under the new rules.
--
-- Earlier reveals were scored against the majority vote, which was wrong, and those posts
-- have no chosen_option so they cannot be rescored. They become 'unresolved' (the split is
-- visible) and accuracy restarts from zero. Points and rank are kept.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'posts' AND column_name = 'revealed'
  ) THEN
    UPDATE posts SET status = 'unresolved', reveal_notified_at = now() WHERE revealed IS TRUE;
    ALTER TABLE posts DROP COLUMN revealed;

    UPDATE votes SET is_correct = NULL WHERE is_correct IS NOT NULL;
    UPDATE users SET accuracy_score = NULL, resolved_votes = 0, correct_votes = 0;
  END IF;
END $$;

ALTER TABLE posts
  ALTER COLUMN author_id SET NOT NULL,
  ALTER COLUMN reveal_at SET NOT NULL,
  ALTER COLUMN category_tags SET NOT NULL,
  ALTER COLUMN is_live_crisis SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_status_check') THEN
    ALTER TABLE posts ADD CONSTRAINT posts_status_check
      CHECK (status IN ('open', 'awaiting_outcome', 'revealed', 'unresolved', 'removed'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_chosen_option_check') THEN
    ALTER TABLE posts ADD CONSTRAINT posts_chosen_option_check CHECK (chosen_option IN ('A', 'B'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_poster_feeling_check') THEN
    ALTER TABLE posts ADD CONSTRAINT posts_poster_feeling_check
      CHECK (poster_feeling IN ('happy', 'regret'));
  END IF;
  -- A revealed post always carries the two facts scoring depends on.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_revealed_complete_check') THEN
    ALTER TABLE posts ADD CONSTRAINT posts_revealed_complete_check
      CHECK (status <> 'revealed' OR (chosen_option IS NOT NULL AND poster_feeling IS NOT NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_title_length_check') THEN
    ALTER TABLE posts ADD CONSTRAINT posts_title_length_check
      CHECK (char_length(title) BETWEEN 5 AND 140);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_context_length_check') THEN
    ALTER TABLE posts ADD CONSTRAINT posts_context_length_check
      CHECK (context IS NULL OR char_length(context) <= 1000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_option_length_check') THEN
    ALTER TABLE posts ADD CONSTRAINT posts_option_length_check
      CHECK (char_length(option_a) BETWEEN 1 AND 80 AND char_length(option_b) BETWEEN 1 AND 80);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_outcome_length_check') THEN
    ALTER TABLE posts ADD CONSTRAINT posts_outcome_length_check
      CHECK (outcome_text IS NULL OR char_length(outcome_text) <= 1000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_tags_check') THEN
    ALTER TABLE posts ADD CONSTRAINT posts_tags_check
      CHECK (
        cardinality(category_tags) BETWEEN 1 AND 3
        AND category_tags <@ ARRAY['career', 'money', 'relationships', 'health', 'lifestyle', 'education']
      );
  END IF;
END $$;

ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_author_id_fkey;
ALTER TABLE posts ADD CONSTRAINT posts_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE;

DROP INDEX IF EXISTS idx_posts_reveal_at;
CREATE INDEX IF NOT EXISTS idx_posts_status_reveal_at ON posts (status, reveal_at);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts (author_id);
CREATE INDEX IF NOT EXISTS idx_posts_category_tags ON posts USING GIN (category_tags);
-- One active Live Crisis post per author.
CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_one_open_crisis
  ON posts (author_id) WHERE is_live_crisis AND status = 'open';

-- ---------------------------------------------------------------------------
-- 3. votes
-- ---------------------------------------------------------------------------
DELETE FROM votes WHERE user_id IS NULL OR post_id IS NULL OR choice NOT IN ('A', 'B');
UPDATE votes SET weight = COALESCE(weight, 1.0), created_at = COALESCE(created_at, now());

ALTER TABLE votes
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN post_id SET NOT NULL,
  ALTER COLUMN weight SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'votes_choice_check') THEN
    ALTER TABLE votes ADD CONSTRAINT votes_choice_check CHECK (choice IN ('A', 'B'));
  END IF;
END $$;

ALTER TABLE votes DROP CONSTRAINT IF EXISTS votes_user_id_fkey;
ALTER TABLE votes ADD CONSTRAINT votes_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE votes DROP CONSTRAINT IF EXISTS votes_post_id_fkey;
ALTER TABLE votes ADD CONSTRAINT votes_post_id_fkey
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_votes_user_created ON votes (user_id, created_at);

-- ---------------------------------------------------------------------------
-- 4. comments
-- ---------------------------------------------------------------------------
DELETE FROM comments WHERE user_id IS NULL OR post_id IS NULL;

DELETE FROM comments WHERE btrim(COALESCE(body, '')) = '';

ALTER TABLE comments ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;
UPDATE comments SET created_at = COALESCE(created_at, now()), body = left(btrim(body), 500);
ALTER TABLE comments
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN post_id SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comments_body_length_check') THEN
    ALTER TABLE comments ADD CONSTRAINT comments_body_length_check
      CHECK (char_length(body) BETWEEN 1 AND 500);
  END IF;
END $$;

ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_user_id_fkey;
ALTER TABLE comments ADD CONSTRAINT comments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_post_id_fkey;
ALTER TABLE comments ADD CONSTRAINT comments_post_id_fkey
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_comments_post_created ON comments (post_id, created_at);

-- ---------------------------------------------------------------------------
-- 5. post_tallies (one row per post, maintained by triggers)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS post_tallies (
  post_id    uuid PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
  votes_a    integer NOT NULL DEFAULT 0,
  votes_b    integer NOT NULL DEFAULT 0,
  weighted_a numeric(12,2) NOT NULL DEFAULT 0,
  weighted_b numeric(12,2) NOT NULL DEFAULT 0
);

INSERT INTO post_tallies (post_id, votes_a, votes_b, weighted_a, weighted_b)
SELECT
  p.id,
  COUNT(v.id) FILTER (WHERE v.choice = 'A'),
  COUNT(v.id) FILTER (WHERE v.choice = 'B'),
  COALESCE(SUM(v.weight) FILTER (WHERE v.choice = 'A'), 0),
  COALESCE(SUM(v.weight) FILTER (WHERE v.choice = 'B'), 0)
FROM posts p
LEFT JOIN votes v ON v.post_id = p.id
GROUP BY p.id
ON CONFLICT (post_id) DO UPDATE SET
  votes_a = EXCLUDED.votes_a,
  votes_b = EXCLUDED.votes_b,
  weighted_a = EXCLUDED.weighted_a,
  weighted_b = EXCLUDED.weighted_b;

CREATE OR REPLACE FUNCTION trg_posts_after_insert() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO post_tallies (post_id) VALUES (NEW.id) ON CONFLICT (post_id) DO NOTHING;
  UPDATE users SET total_posts = total_posts + 1 WHERE id = NEW.author_id;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS posts_after_insert ON posts;
CREATE TRIGGER posts_after_insert AFTER INSERT ON posts
  FOR EACH ROW EXECUTE FUNCTION trg_posts_after_insert();

CREATE OR REPLACE FUNCTION trg_votes_tally() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO post_tallies (post_id, votes_a, votes_b, weighted_a, weighted_b)
    VALUES (
      NEW.post_id,
      (NEW.choice = 'A')::int,
      (NEW.choice = 'B')::int,
      CASE WHEN NEW.choice = 'A' THEN NEW.weight ELSE 0 END,
      CASE WHEN NEW.choice = 'B' THEN NEW.weight ELSE 0 END
    )
    ON CONFLICT (post_id) DO UPDATE SET
      votes_a    = post_tallies.votes_a + EXCLUDED.votes_a,
      votes_b    = post_tallies.votes_b + EXCLUDED.votes_b,
      weighted_a = post_tallies.weighted_a + EXCLUDED.weighted_a,
      weighted_b = post_tallies.weighted_b + EXCLUDED.weighted_b;
  ELSIF TG_OP = 'DELETE' THEN
    -- Affects zero rows when the post itself is being deleted (tally row already gone).
    UPDATE post_tallies SET
      votes_a    = votes_a - (OLD.choice = 'A')::int,
      votes_b    = votes_b - (OLD.choice = 'B')::int,
      weighted_a = weighted_a - CASE WHEN OLD.choice = 'A' THEN OLD.weight ELSE 0 END,
      weighted_b = weighted_b - CASE WHEN OLD.choice = 'B' THEN OLD.weight ELSE 0 END
    WHERE post_id = OLD.post_id;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS votes_tally ON votes;
CREATE TRIGGER votes_tally AFTER INSERT OR DELETE ON votes
  FOR EACH ROW EXECUTE FUNCTION trg_votes_tally();

-- ---------------------------------------------------------------------------
-- 6. reports / blocks
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('post', 'comment')),
  target_id   uuid NOT NULL,
  reason      text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 300),
  created_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  UNIQUE (reporter_id, target_type, target_id)
);
CREATE INDEX IF NOT EXISTS idx_reports_target ON reports (target_type, target_id);

CREATE TABLE IF NOT EXISTS blocks (
  blocker_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

-- Three distinct reporters hide the content until it is reviewed.
CREATE OR REPLACE FUNCTION trg_reports_auto_hide() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count FROM reports
  WHERE target_type = NEW.target_type AND target_id = NEW.target_id AND resolved_at IS NULL;

  IF v_count >= 3 THEN
    IF NEW.target_type = 'post' THEN
      -- Only posts that have not been scored are pulled; a revealed post keeps its result.
      UPDATE posts SET status = 'removed'
      WHERE id = NEW.target_id AND status IN ('open', 'awaiting_outcome');
    ELSE
      UPDATE comments SET hidden = true WHERE id = NEW.target_id;
    END IF;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS reports_auto_hide ON reports;
CREATE TRIGGER reports_auto_hide AFTER INSERT ON reports
  FOR EACH ROW EXECUTE FUNCTION trg_reports_auto_hide();

-- ---------------------------------------------------------------------------
-- 7. Row Level Security — deny by default.
--    The API server uses the service role (bypasses RLS). No anon/authenticated policies
--    exist, so the public anon key cannot read or write any table directly.
-- ---------------------------------------------------------------------------
ALTER TABLE users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_tallies ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports      ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks       ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 8. Rank helpers (keep in sync with server/src/utils/ranks.js)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rank_for_points(p_points integer) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_points >= 300 THEN 'Oracle'
    WHEN p_points >= 150 THEN 'Strategist'
    WHEN p_points >= 50  THEN 'Analyst'
    ELSE 'Rookie'
  END
$$;

CREATE OR REPLACE FUNCTION weight_for_rank(p_rank text) RETURNS numeric
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_rank
    WHEN 'Oracle'     THEN 1.5
    WHEN 'Strategist' THEN 1.25
    WHEN 'Analyst'    THEN 1.1
    ELSE 1.0
  END
$$;

-- ---------------------------------------------------------------------------
-- 9. cast_vote — one transaction: validate, insert, award points, update rank.
--    Raises a named exception that the API maps to an HTTP error.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cast_vote(p_user_id uuid, p_post_id uuid, p_choice text)
RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
  v_post        posts%ROWTYPE;
  v_user        users%ROWTYPE;
  v_vote        votes%ROWTYPE;
  v_votes_today integer;
  v_award       integer;
  v_points      integer;
BEGIN
  IF p_choice IS NULL OR p_choice NOT IN ('A', 'B') THEN
    RAISE EXCEPTION 'INVALID_CHOICE';
  END IF;

  -- Lock order is always post, then user (reveal_post does the same) to avoid deadlocks.
  SELECT * INTO v_post FROM posts WHERE id = p_post_id FOR SHARE;
  IF NOT FOUND OR v_post.status = 'removed' THEN
    RAISE EXCEPTION 'POST_NOT_FOUND';
  END IF;

  SELECT * INTO v_user FROM users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND';
  END IF;

  IF v_post.author_id = p_user_id THEN
    RAISE EXCEPTION 'OWN_POST';
  END IF;
  IF v_post.status <> 'open' OR v_post.reveal_at <= now() THEN
    RAISE EXCEPTION 'VOTING_CLOSED';
  END IF;
  IF EXISTS (SELECT 1 FROM votes WHERE user_id = p_user_id AND post_id = p_post_id) THEN
    RAISE EXCEPTION 'ALREADY_VOTED';
  END IF;

  -- +1 point per vote, for the first 20 votes of the (UTC) day.
  SELECT COUNT(*) INTO v_votes_today FROM votes
  WHERE user_id = p_user_id AND created_at >= date_trunc('day', now());
  v_award := CASE WHEN v_votes_today < 20 THEN 1 ELSE 0 END;

  INSERT INTO votes (user_id, post_id, choice, weight)
  VALUES (p_user_id, p_post_id, p_choice, weight_for_rank(v_user.rank))
  RETURNING * INTO v_vote;

  v_points := v_user.points + v_award;

  UPDATE users SET
    points      = v_points,
    total_votes = total_votes + 1,
    rank        = rank_for_points(v_points)
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'vote', jsonb_build_object(
      'id', v_vote.id,
      'post_id', v_vote.post_id,
      'choice', v_vote.choice,
      'weight', v_vote.weight,
      'created_at', v_vote.created_at
    ),
    'voter_stats', jsonb_build_object(
      'points', v_points,
      'points_awarded', v_award,
      'total_votes', v_user.total_votes + 1,
      'rank', rank_for_points(v_points)
    )
  );
END $$;

-- ---------------------------------------------------------------------------
-- 10. reveal_post — the scoring rule.
--     happy  -> the option the poster chose was the right call
--     regret -> the other option was the right call
--     It never looks at which side the majority voted for.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION reveal_post(
  p_author_id      uuid,
  p_post_id        uuid,
  p_chosen_option  text,
  p_poster_feeling text,
  p_outcome_text   text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
  v_post         posts%ROWTYPE;
  v_correct_side text;
  v_total        integer;
  v_correct      integer;
BEGIN
  IF p_chosen_option IS NULL OR p_chosen_option NOT IN ('A', 'B') THEN
    RAISE EXCEPTION 'INVALID_CHOICE';
  END IF;
  IF p_poster_feeling IS NULL OR p_poster_feeling NOT IN ('happy', 'regret') THEN
    RAISE EXCEPTION 'INVALID_FEELING';
  END IF;

  SELECT * INTO v_post FROM posts WHERE id = p_post_id FOR UPDATE;
  IF NOT FOUND OR v_post.status = 'removed' THEN
    RAISE EXCEPTION 'POST_NOT_FOUND';
  END IF;
  IF v_post.author_id <> p_author_id THEN
    RAISE EXCEPTION 'NOT_AUTHOR';
  END IF;
  IF v_post.status = 'revealed' THEN
    RAISE EXCEPTION 'ALREADY_REVEALED';
  END IF;
  IF v_post.status = 'unresolved' THEN
    RAISE EXCEPTION 'REVEAL_WINDOW_CLOSED';
  END IF;
  IF v_post.reveal_at > now() THEN
    RAISE EXCEPTION 'TOO_EARLY';
  END IF;

  v_correct_side := CASE
    WHEN p_poster_feeling = 'happy' THEN p_chosen_option
    WHEN p_chosen_option = 'A' THEN 'B'
    ELSE 'A'
  END;

  UPDATE posts SET
    status         = 'revealed',
    chosen_option  = p_chosen_option,
    poster_feeling = p_poster_feeling,
    outcome_text   = NULLIF(btrim(COALESCE(p_outcome_text, '')), ''),
    revealed_at    = now()
  WHERE id = p_post_id;

  -- Lock every affected user row in a stable order before updating.
  PERFORM 1 FROM users
  WHERE id = p_author_id OR id IN (SELECT user_id FROM votes WHERE post_id = p_post_id)
  ORDER BY id
  FOR UPDATE;

  UPDATE votes SET is_correct = (choice = v_correct_side) WHERE post_id = p_post_id;

  -- One vote per user per post, so each voter row is updated exactly once.
  UPDATE users u SET
    resolved_votes = u.resolved_votes + 1,
    correct_votes  = u.correct_votes + (v.choice = v_correct_side)::int,
    points         = u.points + CASE WHEN v.choice = v_correct_side THEN 5 ELSE 0 END
  FROM votes v
  WHERE v.post_id = p_post_id AND v.user_id = u.id;

  UPDATE users u SET
    rank = rank_for_points(u.points),
    accuracy_score = CASE
      WHEN u.resolved_votes >= 5
        THEN round(u.correct_votes::numeric * 100 / u.resolved_votes, 2)
      ELSE NULL
    END
  WHERE u.id IN (SELECT user_id FROM votes WHERE post_id = p_post_id);

  -- Author: +5 for the post (granted now, not at creation) and +5 for reporting the outcome.
  UPDATE users SET points = points + 10, rank = rank_for_points(points + 10)
  WHERE id = p_author_id;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE is_correct)
  INTO v_total, v_correct
  FROM votes WHERE post_id = p_post_id;

  RETURN jsonb_build_object(
    'post_id', p_post_id,
    'status', 'revealed',
    'correct_side', v_correct_side,
    'total_voters', v_total,
    'correct_voters', v_correct
  );
END $$;

-- ---------------------------------------------------------------------------
-- 11. delete_post — author only, only while open and before anyone has voted.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION delete_post(p_author_id uuid, p_post_id uuid)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_post posts%ROWTYPE;
BEGIN
  SELECT * INTO v_post FROM posts WHERE id = p_post_id FOR UPDATE;
  IF NOT FOUND OR v_post.status = 'removed' THEN
    RAISE EXCEPTION 'POST_NOT_FOUND';
  END IF;
  IF v_post.author_id <> p_author_id THEN
    RAISE EXCEPTION 'NOT_AUTHOR';
  END IF;
  IF v_post.status <> 'open' OR EXISTS (SELECT 1 FROM votes WHERE post_id = p_post_id) THEN
    RAISE EXCEPTION 'POST_LOCKED';
  END IF;

  DELETE FROM posts WHERE id = p_post_id;
  UPDATE users SET total_posts = GREATEST(total_posts - 1, 0) WHERE id = p_author_id;
END $$;

-- ---------------------------------------------------------------------------
-- 12. query_posts — the single read path for feed / single post / my posts / my votes.
--     Returns raw rows (author_id and tallies included); the API serializer decides what
--     the viewer is allowed to see.
--     p_scope: 'feed' | 'mine' | 'voted'
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION query_posts(
  p_viewer_id         uuid DEFAULT NULL,
  p_tag               text DEFAULT NULL,
  p_post_id           uuid DEFAULT NULL,
  p_scope             text DEFAULT 'feed',
  p_cursor_created_at timestamptz DEFAULT NULL,
  p_cursor_id         uuid DEFAULT NULL,
  p_limit             integer DEFAULT 20
)
RETURNS TABLE (
  id               uuid,
  author_id        uuid,
  title            text,
  context          text,
  option_a         text,
  option_b         text,
  category_tags    text[],
  reveal_at        timestamptz,
  status           text,
  chosen_option    text,
  poster_feeling   text,
  outcome_text     text,
  revealed_at      timestamptz,
  is_live_crisis   boolean,
  comments_enabled boolean,
  created_at       timestamptz,
  votes_a          integer,
  votes_b          integer,
  weighted_a       numeric,
  weighted_b       numeric,
  my_choice        text,
  my_is_correct    boolean,
  comment_count    integer
)
LANGUAGE sql STABLE AS $$
  SELECT
    p.id, p.author_id, p.title, p.context, p.option_a, p.option_b, p.category_tags,
    p.reveal_at, p.status, p.chosen_option, p.poster_feeling, p.outcome_text, p.revealed_at,
    p.is_live_crisis, p.comments_enabled, p.created_at,
    COALESCE(t.votes_a, 0), COALESCE(t.votes_b, 0),
    COALESCE(t.weighted_a, 0), COALESCE(t.weighted_b, 0),
    v.choice, v.is_correct,
    (SELECT COUNT(*)::integer FROM comments c WHERE c.post_id = p.id AND NOT c.hidden)
  FROM posts p
  LEFT JOIN post_tallies t ON t.post_id = p.id
  LEFT JOIN votes v ON v.post_id = p.id AND v.user_id = p_viewer_id
  WHERE (p.status <> 'removed' OR p_scope = 'mine')
    AND (p_post_id IS NULL OR p.id = p_post_id)
    AND (p_tag IS NULL OR p.category_tags @> ARRAY[p_tag])
    AND (p_scope <> 'mine' OR p.author_id = p_viewer_id)
    AND (p_scope <> 'voted' OR v.id IS NOT NULL)
    AND (
      p_viewer_id IS NULL
      OR p_scope = 'mine'
      OR NOT EXISTS (
        SELECT 1 FROM blocks b WHERE b.blocker_id = p_viewer_id AND b.blocked_id = p.author_id
      )
    )
    AND (
      p_cursor_created_at IS NULL
      OR p_cursor_id IS NULL
      OR (p.created_at, p.id) < (p_cursor_created_at, p_cursor_id)
    )
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50)
$$;

-- ---------------------------------------------------------------------------
-- 13. Stats
-- ---------------------------------------------------------------------------
-- Regret Index: of the posts revealed in each category, how many ended in regret.
CREATE OR REPLACE FUNCTION regret_index()
RETURNS TABLE (tag text, revealed_posts integer, happy_posts integer, regret_posts integer, regret_pct numeric)
LANGUAGE sql STABLE AS $$
  SELECT
    x.tag,
    COUNT(*)::integer,
    COUNT(*) FILTER (WHERE p.poster_feeling = 'happy')::integer,
    COUNT(*) FILTER (WHERE p.poster_feeling = 'regret')::integer,
    round(COUNT(*) FILTER (WHERE p.poster_feeling = 'regret')::numeric * 100 / COUNT(*), 1)
  FROM posts p
  CROSS JOIN LATERAL unnest(p.category_tags) AS x(tag)
  WHERE p.status = 'revealed'
  GROUP BY x.tag
  ORDER BY x.tag
$$;

CREATE OR REPLACE FUNCTION user_category_accuracy(p_user_id uuid)
RETURNS TABLE (tag text, resolved_votes integer, correct_votes integer)
LANGUAGE sql STABLE AS $$
  SELECT
    x.tag,
    COUNT(*)::integer,
    COUNT(*) FILTER (WHERE v.is_correct)::integer
  FROM votes v
  JOIN posts p ON p.id = v.post_id
  CROSS JOIN LATERAL unnest(p.category_tags) AS x(tag)
  WHERE v.user_id = p_user_id AND v.is_correct IS NOT NULL
  GROUP BY x.tag
  ORDER BY x.tag
$$;

-- ---------------------------------------------------------------------------
-- 14. Lock the functions down: PostgREST exposes public functions to the anon key
--     by default, and these take a user id as a parameter.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'cast_vote', 'reveal_post', 'delete_post', 'query_posts',
        'regret_index', 'user_category_accuracy', 'rank_for_points', 'weight_for_rank',
        'trg_posts_after_insert', 'trg_votes_tally', 'trg_reports_auto_hide'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', fn);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
    END IF;
  END LOOP;
END $$;
