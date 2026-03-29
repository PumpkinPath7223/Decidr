-- Migration: 0003_add_vote_is_correct
-- Tracks whether a vote matched the winning side after reveal

ALTER TABLE votes ADD COLUMN is_correct boolean;
