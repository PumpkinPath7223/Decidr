# Decidr

**What's the verdict?**

Decidr is a social app where people anonymously post real-life decisions and the crowd votes on what they should do. Every post has a timer. When it runs out, the poster comes back and says which option they went with and whether they're happy or regret it — and everyone who voted finds out if they called it.

## How it works

1. **Ask** — post a decision with two options, a category and a timer (24 hours to 30 days). Posts are always anonymous.
2. **Vote** — scroll the feed and pick A or B. The split stays hidden until the reveal, so nobody is swayed by the crowd.
3. **Reveal** — when the timer ends, the poster reports what they chose and how it turned out.
4. **Score** — voters who picked the side that turned out right gain accuracy and points, and climb from Rookie to Analyst, Strategist and Oracle. Higher ranks carry more weight in the result.

Also in the app:

- **Live Crisis** — a 2-hour post for decisions that can't wait, with the vote count visible live
- **Comments** — only people who voted can comment, shown with their vote, rank and accuracy
- **Profile** — your accuracy overall and by category, your votes and your posts
- **Leaderboard and Regret Index** — who calls it right most often, and how often posters regret their choice in each category
- **Safety** — report and block, a content filter, and in-app account deletion

## Tech

| Part | Built with |
|---|---|
| Mobile app (`apps/mobile`) | React Native, Expo SDK 55, TypeScript, TanStack Query, Zustand |
| API (`server`) | Node.js 20, Express, zod |
| Data | Supabase (Postgres + Auth), Upstash Redis for rate limits |
| Notifications | Expo Push |

## Running it locally

You need Node.js 20+, a Supabase project and an Upstash Redis database.

**1. Server**

```bash
cd server
npm install
cp .env.example .env      # then fill in your Supabase and Upstash values
npx supabase login
npx supabase link         # pick your Supabase project
npm run migrate           # creates the tables
npm run dev               # http://localhost:3000
```

**2. Mobile app**

```bash
cd apps/mobile
npm install
cp .env.example .env      # on a phone, set EXPO_PUBLIC_API_URL to your computer's LAN IP
npx expo start            # scan the QR code with Expo Go, or press w for web
```

## Checks

```bash
cd server && npm test                 # Jest — includes the scoring rules run on a real Postgres engine
cd server && npm run lint
cd apps/mobile && npm run typecheck
```

These run on every push and pull request through GitHub Actions.

## More detail

[CLAUDE.md](CLAUDE.md) documents the database schema, API routes, business rules and what's planned next.
