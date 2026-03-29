-- Migration: 0002_add_push_token
-- Adds push_token column to users for Expo push notifications

ALTER TABLE users ADD COLUMN push_token text;
