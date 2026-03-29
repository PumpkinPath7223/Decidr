-- Remove reveal_at column from posts — reveals are now triggered immediately by the poster
ALTER TABLE posts DROP COLUMN IF EXISTS reveal_at;
