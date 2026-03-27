# CLAUDE.md — Decidr

## Project Overview
Decidr is a scroll-based social app where users anonymously post real-life decisions and let the crowd vote on what they should do. Every post has a time-locked outcome reveal, turning decisions into serialized stories. The app builds a personalized decision intelligence profile for each user over time.

**Tagline:** "What's the verdict?"
**Stack:** React Native (Expo) + Node.js/Express + Supabase + Redis

---

## Repository Structure

```
decidr/
├── apps/
│   ├── mobile/          # React Native (Expo) app
│   │   ├── src/
│   │   │   ├── screens/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── store/       # Zustand state
│   │   │   ├── services/    # API calls
│   │   │   └── utils/
│   │   ├── app.json
│   │   └── package.json
│   └── web/             # React (Vite) PWA — optional, later
├── server/              # Node.js + Express backend
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── services/
│   │   ├── jobs/            # Cron jobs (reveal timers, pulse pings)
│   │   └── utils/
│   ├── supabase/
│   │   └── migrations/      # SQL migration files
│   └── package.json
└── CLAUDE.md
```

---

## Tech Stack

| Layer | Tool | Notes |
|---|---|---|
| Mobile | React Native + Expo SDK 51 | Single codebase iOS + Android |
| Web | React + Vite | PWA, built later |
| Backend | Node.js 20 + Express 4 | REST API |
| Database | Supabase (PostgreSQL) | Free tier |
| Auth | Supabase Auth | Email + Google + Apple |
| Real-time | Supabase Realtime | Live Crisis Mode vote counts |
| Cache | Upstash Redis (free tier) | Feed caching, rate limiting |
| Push Notifications | Expo Push Notifications | iOS + Android |
| Background Jobs | node-cron | Reveal timers, unresolved post cleanup |
| Hosting (server) | Railway.app free tier | Node.js deploy |
| Hosting (web) | Cloudflare Pages | Free |
| CI/CD | GitHub Actions | Free |

---

## Run Commands

```bash
# Install all dependencies
npm install              # in /server
npx expo install         # in /apps/mobile

# Start backend dev server
cd server && npm run dev          # runs on port 3000 with nodemon

# Start mobile app
cd apps/mobile && npx expo start  # scan QR with Expo Go

# Run database migrations
cd server && npm run migrate

# Run tests
npm run test             # Jest

# Lint
npm run lint             # ESLint + Prettier check
```

---

## Environment Variables

Create `server/.env` — never commit this file:

```
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
UPSTASH_REDIS_URL=
UPSTASH_REDIS_TOKEN=
TOGETHER_AI_API_KEY=
EXPO_ACCESS_TOKEN=
PORT=3000
NODE_ENV=development
```

Create `apps/mobile/.env`:
```
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

---

## Database Schema (Supabase / PostgreSQL)

### users
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
username        text UNIQUE NOT NULL
avatar_url      text
created_at      timestamptz DEFAULT now()
rank            text DEFAULT 'Rookie'       -- Rookie | Analyst | Strategist | Oracle
points          integer DEFAULT 0
accuracy_score  numeric(5,2) DEFAULT 0
total_votes     integer DEFAULT 0
total_posts     integer DEFAULT 0
```

### posts
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
author_id       uuid REFERENCES users(id)
title           text NOT NULL
context         text
option_a        text NOT NULL
option_b        text NOT NULL
category_tags   text[]
reveal_at       timestamptz NOT NULL
revealed        boolean DEFAULT false
outcome_text    text
poster_feeling  text                        -- 'happy' | 'regret' | null
is_live_crisis  boolean DEFAULT false
created_at      timestamptz DEFAULT now()
```

### votes
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id         uuid REFERENCES users(id)
post_id         uuid REFERENCES posts(id)
choice          text NOT NULL               -- 'A' | 'B'
weight          numeric(3,2) DEFAULT 1.0   -- based on rank at time of vote
created_at      timestamptz DEFAULT now()
UNIQUE(user_id, post_id)
```

### comments
```sql
id                      uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id                 uuid REFERENCES users(id)
post_id                 uuid REFERENCES posts(id)
body                    text NOT NULL
voter_choice            text                -- 'A' | 'B'
user_rank_at_time       text
user_accuracy_at_time   numeric(5,2)
created_at              timestamptz DEFAULT now()
```

---

## API Routes

```
POST   /api/auth/register
POST   /api/auth/login

GET    /api/feed                    # paginated feed, filterable by hashtag
GET    /api/posts/:id
POST   /api/posts                   # create decision post
POST   /api/posts/:id/vote          # cast vote
POST   /api/posts/:id/reveal        # poster submits outcome + happy/regret
GET    /api/posts/:id/comments
POST   /api/posts/:id/comments

GET    /api/users/:id/profile
GET    /api/users/:id/votes

GET    /api/leaderboard
GET    /api/regret-index/:category  # regret stats aggregated by hashtag category
```

---

## Coding Conventions

### General
- Use **async/await** throughout — no raw promise chains
- All API responses follow this shape:
  ```json
  { "success": true, "data": {...} }
  { "success": false, "error": "message" }
  ```
- Use `camelCase` for JavaScript variables, `snake_case` for database columns
- Never expose raw Supabase errors to the client — catch and remap

### Backend (Node/Express)
- Controllers handle HTTP, services handle business logic — keep them separate
- Validate all inputs with **zod** before touching the database
- Use middleware for: auth check, rate limiting, error handling
- Rate limit votes: max 60 per hour per user (Redis)
- Every route file exports a router, mounted in `server/src/index.js`

### Frontend (React Native)
- Use **Zustand** for global state (feed, user profile, auth)
- Use **React Query** (TanStack Query) for all API fetching and caching
- Screens live in `src/screens/`, reusable UI in `src/components/`
- Use **Reanimated 2** for all swipe animations — never use Animated from core RN
- Keep components small — if a component is >150 lines, split it

### Naming Conventions
- Screens: `PascalCase.screen.tsx` (e.g. `Feed.screen.tsx`)
- Components: `PascalCase.tsx`
- Hooks: `useCamelCase.ts` (e.g. `useFeed.ts`)
- Services: `camelCase.service.ts`
- Routes: `camelCase.routes.ts`

---

## Key Business Logic Rules

1. **Vote weights:** Rookie = 1.0x, Analyst = 1.1x, Strategist = 1.25x, Oracle = 1.5x
2. **Vote counts are hidden** until the reveal fires — never return raw totals before `revealed = true`
3. **Accuracy score** = resolved votes where voter matched poster_feeling side / total resolved votes
4. **Points system:** +2 for each vote cast, +5 for correct outcome, +10 for posting, +3 for submitting outcome
5. **Rank thresholds:** Rookie 0-50pts, Analyst 50-150, Strategist 150-300, Oracle 300+
6. **Reveal timer:** Only the post author can trigger reveal (after `reveal_at` has passed)
7. **Unresolved posts:** If 7 days pass after `reveal_at` and no reveal, mark `revealed = true`, `outcome_text = null` — no accuracy changes
8. **Live Crisis Mode:** `reveal_at` is set to 2 hours from creation; Supabase Realtime pushes live vote count updates
9. **Decision DNA:** Only generated after user has cast 20+ votes; uses Together.ai to cluster vote patterns
10. **Anonymous posts:** `author_id` is never returned in feed API responses — only in the user's own profile

---

## Background Jobs (node-cron)

```
Every 5 minutes  → Check for posts where reveal_at has passed, send reveal notifications
Every hour       → Recalculate accuracy scores and ranks for active users
Daily at 2am     → Check for unresolved posts 7+ days overdue, auto-close them
```

---

## Current Build Priority

Build in this order:

- [ ] 1. Supabase schema + migrations
- [ ] 2. Auth (register, login, JWT middleware)
- [ ] 3. Post CRUD (create, get, feed with hashtag filter)
- [ ] 4. Voting endpoint + influence weight logic
- [ ] 5. Feed screen (React Native, swipe cards)
- [ ] 6. Vote UI (Option A / Option B tap, weighted result display)
- [ ] 7. Reveal timer cron job + push notification trigger
- [ ] 8. Reveal submission flow (poster submits outcome + happy/regret)
- [ ] 9. Regret Index calculation per hashtag category
- [ ] 10. User profile + accuracy score display
- [ ] 11. Rank system (points, thresholds, rank badge)
- [ ] 12. Optional comments (gated to voters only, shows rank + accuracy)
- [ ] 13. Live Crisis Mode (2-hour timer + Supabase Realtime vote count)

---

## Do Not

- Do not use `any` in TypeScript
- Do not bypass auth middleware on protected routes
- Do not return `author_id` in public feed responses
- Do not run migrations manually — always use `npm run migrate`
- Do not store sensitive keys in code — use `.env` only
- Do not use `setTimeout` for reveal timers — use cron jobs
- Do not use class components in React Native — hooks only
- Do not show raw vote counts before `revealed = true` on a post
