// Keep in sync with rank_for_points() / weight_for_rank() in the SQL migrations.
// tests/db.test.js asserts the two agree.

export const RANKS = [
  { rank: 'Rookie', min: 0, weight: 1.0 },
  { rank: 'Analyst', min: 50, weight: 1.1 },
  { rank: 'Strategist', min: 150, weight: 1.25 },
  { rank: 'Oracle', min: 300, weight: 1.5 },
];

export function rankForPoints(points) {
  let current = RANKS[0];
  for (const tier of RANKS) {
    if (points >= tier.min) current = tier;
  }
  return current.rank;
}

export function weightForRank(rank) {
  return RANKS.find((tier) => tier.rank === rank)?.weight ?? 1.0;
}

// What the profile screen needs to draw the "next rank" progress bar.
export function rankProgress(points) {
  const index = RANKS.findIndex((tier) => tier.rank === rankForPoints(points));
  const current = RANKS[index];
  const next = RANKS[index + 1] ?? null;
  return {
    rank: current.rank,
    weight: current.weight,
    next_rank: next?.rank ?? null,
    points_to_next: next ? next.min - points : 0,
    progress: next ? (points - current.min) / (next.min - current.min) : 1,
  };
}
