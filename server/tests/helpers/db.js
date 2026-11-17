import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../supabase/migrations');

export function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

// In-process Postgres with every migration applied. `auth.users` is the only piece of
// Supabase the schema depends on, so it is stubbed.
export async function createTestDb({ upTo } = {}) {
  const db = new PGlite();
  await db.exec(`
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
  `);
  for (const file of migrationFiles()) {
    if (upTo && file > upTo) break;
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
  }
  return db;
}

export async function applyMigration(db, file) {
  await db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
}

let userSeq = 0;

export async function createUser(db, overrides = {}) {
  userSeq += 1;
  const { rows: [authUser] } = await db.query('INSERT INTO auth.users DEFAULT VALUES RETURNING id');
  const username = overrides.username ?? `user_${userSeq}`;
  const points = overrides.points ?? 0;
  const { rows: [user] } = await db.query(
    `INSERT INTO users (id, username, points, rank)
     VALUES ($1, $2, $3, rank_for_points($3)) RETURNING *`,
    [authUser.id, username, points]
  );
  return user;
}

export async function createPost(db, authorId, overrides = {}) {
  const { rows: [post] } = await db.query(
    `INSERT INTO posts (author_id, title, context, option_a, option_b, category_tags, reveal_at, is_live_crisis)
     VALUES ($1, $2, $3, $4, $5, $6, now() + ($7 || ' seconds')::interval, $8) RETURNING *`,
    [
      authorId,
      overrides.title ?? 'Should I take the new job?',
      overrides.context ?? null,
      overrides.option_a ?? 'Take it',
      overrides.option_b ?? 'Stay put',
      overrides.category_tags ?? ['career'],
      String(overrides.revealInSeconds ?? 3600),
      overrides.is_live_crisis ?? false,
    ]
  );
  return post;
}

// Moves a post's timer into the past so it can be revealed.
export async function expirePost(db, postId, secondsAgo = 60) {
  await db.query(
    `UPDATE posts SET reveal_at = now() - ($2 || ' seconds')::interval WHERE id = $1`,
    [postId, String(secondsAgo)]
  );
}

export async function getUser(db, id) {
  const { rows: [user] } = await db.query('SELECT * FROM users WHERE id = $1', [id]);
  return user;
}
