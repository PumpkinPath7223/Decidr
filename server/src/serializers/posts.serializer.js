// The only place a database post row is turned into an API response.
// It builds the response from an explicit allow-list — never spread the row — so
// author_id and hidden vote counts cannot leak by accident.

// The cron job flips 'open' to 'awaiting_outcome' every few minutes; between runs the
// timer is still the source of truth.
export function effectiveStatus(row, now = new Date()) {
  if (row.status === 'open' && new Date(row.reveal_at).getTime() <= now.getTime()) {
    return 'awaiting_outcome';
  }
  return row.status;
}

export function correctSide(chosenOption, posterFeeling) {
  if (!chosenOption || !posterFeeling) return null;
  if (posterFeeling === 'happy') return chosenOption;
  return chosenOption === 'A' ? 'B' : 'A';
}

function buildResult(row) {
  const votesA = Number(row.votes_a ?? 0);
  const votesB = Number(row.votes_b ?? 0);
  const weightedA = Number(row.weighted_a ?? 0);
  const weightedB = Number(row.weighted_b ?? 0);
  const weightedTotal = weightedA + weightedB;
  const pctA = weightedTotal > 0 ? Math.round((weightedA / weightedTotal) * 100) : null;

  return {
    total_votes: votesA + votesB,
    pct_a: pctA,
    pct_b: pctA === null ? null : 100 - pctA,
  };
}

export function serializePost(row, viewerId = null, now = new Date()) {
  const status = effectiveStatus(row, now);
  const isOwner = Boolean(viewerId) && row.author_id === viewerId;
  const isRevealed = status === 'revealed';
  const isClosed = isRevealed || status === 'unresolved';
  const myChoice = row.my_choice ?? null;

  // Who may see the split:
  //  - everyone once the post is revealed or closed as unresolved
  //  - everyone on Live Crisis posts (that is the feature)
  //  - the author at any time (the crowd's advice is what they asked for)
  const showResult = isClosed || row.is_live_crisis === true || isOwner;

  return {
    id: row.id,
    title: row.title,
    context: row.context ?? null,
    option_a: row.option_a,
    option_b: row.option_b,
    category_tags: row.category_tags ?? [],
    reveal_at: row.reveal_at,
    status,
    is_live_crisis: row.is_live_crisis === true,
    comments_enabled: row.comments_enabled !== false,
    comment_count: Number(row.comment_count ?? 0),
    created_at: row.created_at,
    is_owner: isOwner,
    my_choice: myChoice,
    can_vote: Boolean(viewerId) && status === 'open' && !isOwner && !myChoice,
    can_reveal: isOwner && status === 'awaiting_outcome',
    result: showResult ? buildResult(row) : null,
    outcome: isRevealed
      ? {
          chosen_option: row.chosen_option,
          poster_feeling: row.poster_feeling,
          outcome_text: row.outcome_text ?? null,
          revealed_at: row.revealed_at ?? null,
          correct_side: correctSide(row.chosen_option, row.poster_feeling),
          my_is_correct: myChoice ? row.my_is_correct ?? null : null,
        }
      : null,
  };
}
