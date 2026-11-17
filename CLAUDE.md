# CLAUDE.md — Decidr

## Project Overview
Decidr is a scroll-based social app where users anonymously post real-life decisions and the crowd votes on what they should do. Every post has a time-locked outcome reveal: the poster comes back, says what they chose and whether they're happy or regret it, and voters are scored on whether they called it. Over time each user builds a decision profile (accuracy, rank, per-category strengths).

**Tagline:** "What's the verdict?"
**Stack:** React Native (Expo) + Node.js/Express + Supabase (Postgres, Auth, Realtime) + Upstash Redis
**Source of truth for product intent:** `docs/Decidr_PRD.docx`. This file wins where they disagree (decisions below are deliberate changes).

---

## The Core Loop (what the MVP must nail)

1. Scroll feed → 2. Vote A or B (counts hidden) → 3. Reveal timer expires → 4. Poster reports **which option they chose** + **happy / regret** → 5. Voters get notified, see the weighted split, and gain/lose accuracy → 6. Rank and profile update.

Everything not on this loop is Phase 2+. If a feature doesn't make people come back for reveals, it waits.

---

## Repository Structure

```
decidr/
├── apps/
│   └── mobile/              # Expo app (TypeScript)
│       ├── src/
│       │   ├── screens/     # *.screen.tsx
│       │   ├── components/
│       │   ├── navigation/
│       │   ├── hooks/       # React Query hooks
│       │   ├── store/       # Zustand (auth/session + UI state only)
│       │   ├── services/    # API client
│       │   └── utils/
│       └── app.json
├── server/                  # Express API (JavaScript, ES modules)
│   ├── src/
│   │   ├── routes/          # *.routes.js — export a Router, mounted in src/index.js
│   │   ├── controllers/     # HTTP in/out only (zod validation lives here)
│   │   ├── services/        # business logic + database access
│   │   ├── serializers/     # DB row -> API response (the anonymity / hidden-count gate)
│   │   ├── middleware/      # auth, rate limits, error handler
│   │   ├── jobs/            # node-cron jobs
│   │   ├── utils/           # constants, ranks, AppError, cursor, moderation, push
│   │   ├── app.js           # builds the Express app (imported by tests)
│   │   └── index.js         # starts the server and the cron jobs
│   ├── tests/               # Jest: unit, SQL (PGlite) and HTTP (supertest)
│   └── supabase/
│       ├── config.toml      # Supabase CLI project config
│       └── migrations/      # numbered SQL migrations (NNNN_description.sql)
├── .github/workflows/ci.yml # lint + tests + typecheck
├── docs/
└── CLAUDE.md
```

`apps/web` (PWA) is deferred — Expo's web target covers early testing.

---

## Tech Stack (actual versions in the repo)

| Layer | Tool | Notes |
|---|---|---|
| Mobile | Expo SDK 55, React Native 0.83, React 19, TypeScript | iOS + Android |
| Navigation | React Navigation 7 (native-stack + bottom-tabs) | |
| Data fetching | TanStack Query 5 | All server state |
| Client state | Zustand 5 | Auth/session + UI only — never cache server data here |
| Animation | react-native-reanimated 4 (+ react-native-worklets) | No core `Animated` |
| Backend | Node.js 20 + Express 4, JS (ESM) | Validate with zod |
| Database / Auth | Supabase (Postgres, Auth, Realtime) | Email first; Apple + Google before App Store submission (Apple requires Sign in with Apple if any social login exists) |
| Cache / rate limit | Upstash Redis | |
| Push | Expo Push (`expo-server-sdk`) | |
| Jobs | node-cron in the server process | Must be idempotent (see Jobs) |
| Hosting | Railway (server), Supabase (DB) | |
| Tests | Jest + supertest + PGlite | PGlite runs the real migrations and SQL functions in-process — no database needed |
| CI | GitHub Actions: server lint + tests, mobile typecheck | |

---

## Run Commands

```bash
# Backend
cd server && npm install
cd server && npm run dev            # nodemon, port 3000

# Mobile
cd apps/mobile && npm install
cd apps/mobile && npx expo start    # Expo Go / dev client / press w for web

# Database migrations — Supabase CLI (one-time: npx supabase login && npx supabase link)
cd server && npm run migrate        # = supabase db push: applies pending migrations

# Checks (CI runs all three)
cd server && npm test               # Jest
cd server && npm run lint           # ESLint
cd apps/mobile && npm run typecheck # tsc --noEmit
```

If migrations 0001–0004 were applied by hand, tell the CLI once before the first push:
`npx supabase migration repair --status applied 0001 0002 0003 0004`.

---

## Environment Variables

**Never commit `.env` files.** Commit `.env.example` with empty values only.

`server/.env`
```
SUPABASE_URL=
SUPABASE_SERVICE_KEY=        # server-only, bypasses RLS — never ship to the client
UPSTASH_REDIS_URL=
UPSTASH_REDIS_TOKEN=
EXPO_ACCESS_TOKEN=
CORS_ORIGINS=http://localhost:8081,http://localhost:19006   # browsers only; native apps send no Origin
PORT=3000
NODE_ENV=development
```

`apps/mobile/.env`
```
EXPO_PUBLIC_API_URL=http://localhost:3000   # use your machine's LAN IP when testing on a phone
```
The mobile app talks only to this API — it holds no Supabase keys. Anything named `EXPO_PUBLIC_*` is bundled into the app, so never put a secret there.

---

## Database Schema

Defined by migrations 0001–0005. (0004 dropped `reveal_at`; 0005 restores it, converts old data, and adds everything below.) To change the schema, add `0006_…sql` — never edit an applied migration.

### users
```sql
id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
username        text UNIQUE NOT NULL
avatar_url      text
push_token      text
rank            text NOT NULL DEFAULT 'Rookie'   -- Rookie | Analyst | Strategist | Oracle
points          integer NOT NULL DEFAULT 0
accuracy_score  numeric(5,2)                     -- null until MIN_RESOLVED_FOR_ACCURACY
resolved_votes  integer NOT NULL DEFAULT 0
correct_votes   integer NOT NULL DEFAULT 0
total_votes     integer NOT NULL DEFAULT 0
total_posts     integer NOT NULL DEFAULT 0
created_at      timestamptz NOT NULL DEFAULT now()
```

### posts
```sql
id                  uuid PRIMARY KEY DEFAULT gen_random_uuid()
author_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
title               text NOT NULL CHECK (char_length(title) BETWEEN 5 AND 140)
context             text CHECK (char_length(context) <= 1000)
option_a            text NOT NULL CHECK (char_length(option_a) <= 80)
option_b            text NOT NULL CHECK (char_length(option_b) <= 80)
category_tags       text[] NOT NULL              -- 1–3 from the curated list
reveal_at           timestamptz NOT NULL
status              text NOT NULL DEFAULT 'open' -- open | awaiting_outcome | revealed | unresolved | removed
chosen_option       text CHECK (chosen_option IN ('A','B'))   -- what the poster actually did
poster_feeling      text CHECK (poster_feeling IN ('happy','regret'))
outcome_text        text CHECK (char_length(outcome_text) <= 1000)
revealed_at         timestamptz
reveal_notified_at  timestamptz                  -- "time's up" ping sent to poster
is_live_crisis      boolean NOT NULL DEFAULT false
comments_enabled    boolean NOT NULL DEFAULT true
created_at          timestamptz NOT NULL DEFAULT now()
```
`status` replaces the `revealed` boolean — the app needs to tell "voting open", "waiting on poster", "revealed" and "abandoned" apart.

### votes
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
post_id     uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE
choice      text NOT NULL CHECK (choice IN ('A','B'))
weight      numeric(3,2) NOT NULL DEFAULT 1.0   -- rank weight at time of vote
is_correct  boolean                              -- set at reveal; null = unresolved
created_at  timestamptz NOT NULL DEFAULT now()
UNIQUE (user_id, post_id)
```

### post_tallies (one row per post, maintained by trigger on votes)
```sql
post_id     uuid PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE
votes_a     integer NOT NULL DEFAULT 0
votes_b     integer NOT NULL DEFAULT 0
weighted_a  numeric NOT NULL DEFAULT 0
weighted_b  numeric NOT NULL DEFAULT 0
```
Avoids re-counting every vote row on every feed load.

### comments
```sql
id                     uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id                uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
post_id                uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE
body                   text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500)
voter_choice           text
user_rank_at_time      text
user_accuracy_at_time  numeric(5,2)
hidden                 boolean NOT NULL DEFAULT false   -- set by 3+ reports
created_at             timestamptz NOT NULL DEFAULT now()
```

### reports / blocks (required for App Store UGC approval)
```sql
reports(id, reporter_id, target_type 'post'|'comment', target_id, reason, created_at, resolved_at, UNIQUE(reporter_id, target_type, target_id))
blocks(blocker_id, blocked_id, created_at, PRIMARY KEY (blocker_id, blocked_id))
```

### SQL functions (all business-critical writes go through these)
| Function | What it does |
|---|---|
| `cast_vote(user, post, choice)` | Validates, inserts the vote, awards the point, updates rank — one transaction |
| `reveal_post(author, post, chosen, feeling, text)` | Scores every vote, updates accuracy/points/rank for voters and author |
| `delete_post(author, post)` | Author only, open posts with zero votes |
| `query_posts(viewer, tag, post, scope, cursor…, limit)` | The one read path: feed, single post, my posts, my votes |
| `regret_index()`, `user_category_accuracy(user)` | Stats |
| `rank_for_points`, `weight_for_rank` | Mirror `server/src/utils/ranks.js` (a test asserts they agree) |

They signal failures with `RAISE EXCEPTION '<NAME>'` (e.g. `ALREADY_VOTED`); `utils/AppError.js` maps each name to an HTTP status.

### Database rules
- **RLS is enabled on every table with no policies** — deny by default. The server uses the service key (bypasses RLS); the anon key can read and write nothing. The SQL functions are revoked from `anon`/`authenticated` too, because they take a user id as a parameter.
- The service-role client must never call `signInWithPassword` — that stores a user session on it and every later query would run as that user. Sign-in and refresh use `createAuthClient()` (a throwaway client).
- Multi-row scoring runs in the SQL functions above, inside one transaction. Never do read-modify-write of `points` from Node (race conditions) and never loop over votes with one query each.
- Triggers keep `post_tallies` and `users.total_posts` in sync, and hide content after 3 reports.

---

## API Routes

Every response: `{ "success": true, "data": ... }` or `{ "success": false, "error": "message", "code"?: "NAME" }`.

```
POST   /api/auth/register            # Supabase sign-up + users row -> { token, refresh_token, user }
POST   /api/auth/login
POST   /api/auth/refresh             # { refresh_token } -> new token pair (access tokens last ~1h)

GET    /api/feed?cursor=&tag=        # cursor pagination -> { posts, next_cursor }; auth optional
GET    /api/posts/:id                # auth optional
POST   /api/posts                    # { title, context?, option_a, option_b, category_tags[1-3], reveal_in: 24h|72h|7d|30d, is_live_crisis?, comments_enabled? }
DELETE /api/posts/:id                # author only, only while open with zero votes
POST   /api/posts/:id/vote           # { choice }
POST   /api/posts/:id/reveal         # author only, after reveal_at: { chosen_option, poster_feeling, outcome_text? }
GET    /api/posts/:id/comments       # auth optional
POST   /api/posts/:id/comments       # voters only: { body }

GET    /api/users/me                 # own profile: stats, rank progress, per-category accuracy
DELETE /api/users/me                 # delete account and everything in it (App Store requirement)
GET    /api/users/me/posts?cursor=
GET    /api/users/me/votes?cursor=
PUT    /api/users/me/push-token      # { push_token }
DELETE /api/users/me/push-token      # on sign-out
GET    /api/users/:id/profile        # public stats only — never lists or counts their posts

GET    /api/leaderboard              # by accuracy, users with 5+ resolved votes
GET    /api/regret-index             # all categories
GET    /api/regret-index/:tag

POST   /api/reports                  # { target_type: post|comment, target_id, reason }
POST   /api/blocks                   # { target_type, target_id } — blocks whoever wrote it
DELETE /api/blocks                   # unblock everyone (posts are anonymous, so blocks can't be listed)
```

A post in a response looks like: `id, title, context, option_a, option_b, category_tags, reveal_at, status, is_live_crisis, comments_enabled, comment_count, created_at, is_owner, my_choice, can_vote, can_reveal, result, outcome`. `result` (`{ total_votes, pct_a, pct_b }`) is `null` while the split is hidden from this viewer; `outcome` is `null` until revealed.

---

## Key Business Logic Rules

1. **Scoring a reveal (the most important rule).** The poster reports `chosen_option` and `poster_feeling`.
   - `happy` → the correct side is `chosen_option`.
   - `regret` → the correct side is the *other* option.
   - A vote is correct when `vote.choice = correct side`. This does **not** depend on what the majority voted.
   Implemented in `reveal_post()`; mirrored for display by `correctSide()` in the serializer.
2. **Hidden counts.** Until a post is revealed (or closed as unresolved), no endpoint returns counts, totals or percentages. Two exceptions: Live Crisis posts show them to everyone, and **the author can always see the split on their own post** (the crowd's advice is what they asked for, and they need it before they decide). After voting, a voter sees only their own choice. `serializers/posts.serializer.js` is the single place this is enforced.
3. **Displayed result** after reveal = weighted split (`weighted_a / (weighted_a + weighted_b)`), with the raw vote total shown as "N votes".
4. **Vote weights** by rank at time of vote: Rookie 1.0, Analyst 1.1, Strategist 1.25, Oracle 1.5.
5. **Ranks** are derived from points: Rookie 0–49, Analyst 50–149, Strategist 150–299, Oracle 300+. Defined in `server/src/utils/ranks.js` and mirrored in the SQL functions.
6. **Points** — reward being right, not volume:
   - +1 per vote cast, for the first 20 votes of the UTC day (stops vote farming)
   - +5 per correct vote at reveal
   - +10 to the author when they reveal (+5 for the post, +5 for the outcome — nothing at creation, which stops post spam)
7. **Accuracy** = `correct_votes / resolved_votes`. Shown only after 5 resolved votes (`MIN_RESOLVED_FOR_ACCURACY`); before that the profile says "Calibrating". Also computed per category.
8. **Reveal timer options:** 24h, 72h, 7d, 30d. Only the author can reveal, only after `reveal_at`, and a reveal can't be changed. Voting closes at `reveal_at`; the cron job flips the status to `awaiting_outcome` a few minutes later, so code must treat an `open` post past its timer as closed (`effectiveStatus()` and `cast_vote` both do).
9. **Unresolved posts:** 7 days after `reveal_at` with no reveal → `status = 'unresolved'`; the split is shown; no accuracy or points change.
10. **No self-voting.** Authors cannot vote on their own posts.
11. **Anonymity.** `author_id` never appears in any response except the author's own `/api/users/me`. Responses include `is_owner: boolean` instead. Comments show the commenter's username/rank/accuracy (identity is the point there); posts never do.
12. **Comments** only for users who voted on that post, and only if `comments_enabled`.
13. **Live Crisis Mode:** `reveal_at = created_at + 2h`; counts are visible to everyone; the app refreshes an open crisis post every 5 seconds; one open crisis post per user (unique index). Supabase Realtime is not used yet — polling was simpler and needs no client keys.
14. **Safety:** posts, outcomes, comments and usernames pass a small abuse filter (`utils/moderation.js`). A post with self-harm language is not published; the author gets support resources instead (`CRISIS_RESOURCES`). Content with 3 reports from different users is hidden (open posts become `removed`, comments `hidden`). Blocking is done by pointing at a post or comment, never by user id; a blocked author's posts and comments disappear for the blocker.

---

## Background Jobs (node-cron)

All jobs must be **idempotent** — safe to run twice, safe after a server restart.

```
Every 5 min  → posts with status='open' and reveal_at <= now():
                 set status='awaiting_outcome', push "Time's up — what did you choose?" to the author,
                 set reveal_notified_at. (The UPDATE itself is the claim, so a post is never notified twice.)
On reveal    → (inside the reveal request, after the RPC commits) push "The verdict is in" to every voter.
Daily 02:00  → open/awaiting_outcome posts 7+ days past reveal_at → status='unresolved'.
```

There is no "recalculate accuracy" job — scoring is updated transactionally at reveal. Expo push tokens that return `DeviceNotRegistered` are cleared. Not built yet: reminder pushes to the author at +24h / +72h.

---

## Coding Conventions

### General
- async/await only; no `.then()` chains.
- `camelCase` in JS, `snake_case` in the database and in API payloads (keep payloads matching columns; don't convert back and forth).
- Never send raw Supabase/Postgres errors to the client. Throw an `AppError(status, message, code?)` from services (or `throwDbError(error)` for a Supabase error); `error.middleware.js` maps it, logs unknown errors and returns a generic 500.
- Build API responses from an explicit allow-list of fields — never spread a database row into a response.

### Backend
- Controllers: parse + validate with zod, call a service, send the response. Services: business logic and DB access. No Express objects in services.
- Middleware: `requireAuth` on every non-public route, Redis rate limiting (votes 60/hr/user, posts 5/day/user, comments 30/hr/user), error handling.
- Shared constants (ranks, weights, points, timers, categories) live in `server/src/utils/` — one definition each.
- Tests (Jest) are required for scoring, rank, points and anonymity logic. `tests/db.test.js` exercises the SQL in PGlite, `tests/api.test.js` the HTTP layer with fakes, the rest are pure unit tests. A change to a migration or SQL function needs a test there.
- Put validation before a rate limiter when a rejected form shouldn't use up the allowance (see `POST /api/posts`).

### Mobile
- TypeScript, no `any`. Function components + hooks only.
- TanStack Query for every API call (hooks in `src/hooks/`, keys in `hooks/postCache.ts`); Zustand only for the auth session. Votes update optimistically via `patchPost()`.
- All requests go through `services/api.service.ts`, which attaches the token and refreshes it once on a 401.
- The navigator picks its screens from the session, so screens never navigate to Login/Tabs by hand. Use `ConfirmModal`, not `Alert.alert` (which does nothing on web).
- Screens `PascalCase.screen.tsx`, components `PascalCase.tsx`, hooks `useCamelCase.ts`, services `camelCase.service.ts`.
- Split any component over ~150 lines.
- Reanimated for animations.
- Auth tokens in `expo-secure-store` (AsyncStorage only as the web fallback) — see `services/storage.service.ts`.

---

## Build Status

### Done
- [x] Secrets out of git, root `.gitignore`, `node_modules` untracked
- [x] Migration 0005: timer restored, `status`, `chosen_option`, tallies, reports/blocks, RLS, SQL functions
- [x] Scoring by chosen option + feeling; atomic votes, points and ranks; no self-votes
- [x] Auth with refresh tokens; hidden counts and anonymity enforced in one serializer
- [x] Feed (tag filter, cursor pagination), create post, post detail, vote, reveal flow
- [x] Comments (voters only), report / block, content filter, crisis-resources handling
- [x] Profile (rank progress, accuracy, per-category accuracy, my votes / my posts), account deletion
- [x] Leaderboard and Regret Index
- [x] Live Crisis Mode (2h timer, live counts by polling)
- [x] Cron jobs: close voting + notify author, auto-close unresolved; push to voters on reveal
- [x] Jest suite, ESLint, GitHub Actions

### Before real users (needs your accounts — cannot be done from code)
- [ ] **Rotate the Supabase service key and Upstash token** — the old ones are in the GitHub history
- [ ] Apply migration 0005 to the Supabase project (`npm run migrate`)
- [ ] Create an EAS project and add `extra.eas.projectId` to `apps/mobile/app.json` — push notifications are skipped without it
- [ ] Set iOS `bundleIdentifier` / Android `package` in `app.json`; build with EAS; test on a real phone
- [ ] Deploy the server (Railway) with the env vars above and point `EXPO_PUBLIC_API_URL` at it

### Next
- [ ] Sign in with Apple + Google (Apple requires it if any social login is offered)
- [ ] A review queue for reported content (reports are stored and auto-hide at 3, but nobody reviews them yet)
- [ ] Reminder pushes to authors who haven't revealed (+24h, +72h)
- [ ] Full-screen swipe feed (currently a scrolling list of cards)
- [ ] Redis feed caching; analytics events (vote, post, reveal, return-after-push)
- [ ] Rank-up moments; weekly leaderboard; rank perks from the PRD
- [ ] Decision DNA (archetypes from vote patterns, after 20+ resolved votes)
- [ ] Supabase Realtime for Live Crisis instead of polling; web/PWA polish

---

## Do Not

- Do not commit `.env` files, keys, or `node_modules`
- Do not return `author_id` in any public response
- Do not return vote counts/splits before reveal (except Live Crisis posts)
- Do not derive the "correct" side from the majority vote — use `chosen_option` + `poster_feeling`
- Do not read-modify-write points or counters from Node — use SQL increments / RPC
- Do not bypass `requireAuth` on protected routes
- Do not use `setTimeout` for timers — use the cron jobs
- Do not use `any` in TypeScript or class components in React Native
- Do not expose the Supabase service key to the mobile app
- Do not apply migrations by hand in the Supabase dashboard — add a numbered migration file and run `npm run migrate`
- Do not edit a migration that has already been applied
- Do not sign users in on the service-role Supabase client
- Do not spread database rows into API responses
