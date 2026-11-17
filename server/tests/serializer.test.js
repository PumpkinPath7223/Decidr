import { correctSide, effectiveStatus, serializePost } from '../src/serializers/posts.serializer.js';

const AUTHOR = '11111111-1111-4111-8111-111111111111';
const VOTER = '22222222-2222-4222-8222-222222222222';
const NOW = new Date('2026-06-01T12:00:00Z');

function row(overrides = {}) {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    author_id: AUTHOR,
    title: 'Should I take the new job?',
    context: null,
    option_a: 'Take it',
    option_b: 'Stay put',
    category_tags: ['career'],
    reveal_at: '2026-06-02T12:00:00Z',
    status: 'open',
    chosen_option: null,
    poster_feeling: null,
    outcome_text: null,
    revealed_at: null,
    is_live_crisis: false,
    comments_enabled: true,
    created_at: '2026-06-01T00:00:00Z',
    votes_a: 3,
    votes_b: 1,
    weighted_a: '3.50',
    weighted_b: '1.50',
    my_choice: null,
    my_is_correct: null,
    comment_count: 2,
    ...overrides,
  };
}

describe('correctSide', () => {
  test('happy means the chosen option was right', () => {
    expect(correctSide('A', 'happy')).toBe('A');
    expect(correctSide('B', 'happy')).toBe('B');
  });
  test('regret means the other option was right', () => {
    expect(correctSide('A', 'regret')).toBe('B');
    expect(correctSide('B', 'regret')).toBe('A');
  });
  test('is null until both facts are known', () => {
    expect(correctSide(null, 'happy')).toBeNull();
    expect(correctSide('A', null)).toBeNull();
  });
});

describe('effectiveStatus', () => {
  test('an open post past its timer is awaiting the outcome even before the cron job runs', () => {
    expect(effectiveStatus(row({ reveal_at: '2026-06-01T11:59:59Z' }), NOW)).toBe('awaiting_outcome');
    expect(effectiveStatus(row({ reveal_at: '2026-06-01T12:00:00Z' }), NOW)).toBe('awaiting_outcome');
  });
  test('an open post inside its timer stays open', () => {
    expect(effectiveStatus(row(), NOW)).toBe('open');
  });
  test('other statuses pass through', () => {
    expect(effectiveStatus(row({ status: 'revealed' }), NOW)).toBe('revealed');
    expect(effectiveStatus(row({ status: 'unresolved' }), NOW)).toBe('unresolved');
  });
});

describe('serializePost — anonymity', () => {
  test('never includes author_id, for any viewer or status', () => {
    const viewers = [null, VOTER, AUTHOR];
    const statuses = ['open', 'awaiting_outcome', 'revealed', 'unresolved'];
    for (const viewer of viewers) {
      for (const status of statuses) {
        const out = serializePost(
          row({ status, chosen_option: 'A', poster_feeling: 'happy' }),
          viewer,
          NOW
        );
        expect(JSON.stringify(out)).not.toContain(AUTHOR);
        expect(out).not.toHaveProperty('author_id');
      }
    }
  });

  test('unknown columns on the row are not passed through', () => {
    const out = serializePost(row({ secret_column: 'leak', push_token: 'ExponentPushToken[x]' }), VOTER, NOW);
    expect(out).not.toHaveProperty('secret_column');
    expect(out).not.toHaveProperty('push_token');
  });

  test('is_owner is true only for the author', () => {
    expect(serializePost(row(), AUTHOR, NOW).is_owner).toBe(true);
    expect(serializePost(row(), VOTER, NOW).is_owner).toBe(false);
    expect(serializePost(row(), null, NOW).is_owner).toBe(false);
  });
});

describe('serializePost — hidden counts', () => {
  test('an open post shows no counts to a voter or a guest', () => {
    for (const viewer of [VOTER, null]) {
      const out = serializePost(row({ my_choice: viewer ? 'A' : null }), viewer, NOW);
      expect(out.result).toBeNull();
      const json = JSON.stringify(out);
      for (const key of ['votes_a', 'votes_b', 'weighted_a', 'weighted_b', 'total_votes', 'pct_a']) {
        expect(json).not.toContain(key);
      }
    }
  });

  test('counts stay hidden while waiting for the author', () => {
    const out = serializePost(row({ status: 'awaiting_outcome' }), VOTER, NOW);
    expect(out.result).toBeNull();
  });

  test('a revealed post shows the weighted split and the raw total', () => {
    const out = serializePost(row({ status: 'revealed', chosen_option: 'A', poster_feeling: 'happy' }), VOTER, NOW);
    expect(out.result).toEqual({ total_votes: 4, pct_a: 70, pct_b: 30 });
  });

  test('an unresolved post shows the split but no outcome', () => {
    const out = serializePost(row({ status: 'unresolved' }), VOTER, NOW);
    expect(out.result).toEqual({ total_votes: 4, pct_a: 70, pct_b: 30 });
    expect(out.outcome).toBeNull();
  });

  test('a Live Crisis post shows counts while open', () => {
    const out = serializePost(row({ is_live_crisis: true }), VOTER, NOW);
    expect(out.result).toEqual({ total_votes: 4, pct_a: 70, pct_b: 30 });
  });

  test('the author can see the split on their own post', () => {
    expect(serializePost(row(), AUTHOR, NOW).result).toEqual({ total_votes: 4, pct_a: 70, pct_b: 30 });
  });

  test('a post with no votes reports null percentages rather than 50/50', () => {
    const out = serializePost(
      row({ status: 'unresolved', votes_a: 0, votes_b: 0, weighted_a: '0', weighted_b: '0' }),
      VOTER,
      NOW
    );
    expect(out.result).toEqual({ total_votes: 0, pct_a: null, pct_b: null });
  });
});

describe('serializePost — outcome and actions', () => {
  test('outcome is withheld until revealed', () => {
    const out = serializePost(row({ chosen_option: 'A', poster_feeling: 'happy' }), VOTER, NOW);
    expect(out.outcome).toBeNull();
  });

  test('a revealed post carries the outcome and whether the viewer was right', () => {
    const out = serializePost(
      row({
        status: 'revealed',
        chosen_option: 'B',
        poster_feeling: 'regret',
        outcome_text: 'Should have stayed.',
        my_choice: 'A',
        my_is_correct: true,
      }),
      VOTER,
      NOW
    );
    expect(out.outcome).toMatchObject({
      chosen_option: 'B',
      poster_feeling: 'regret',
      outcome_text: 'Should have stayed.',
      correct_side: 'A',
      my_is_correct: true,
    });
  });

  test('can_vote: signed-in non-author who has not voted on an open post', () => {
    expect(serializePost(row(), VOTER, NOW).can_vote).toBe(true);
    expect(serializePost(row(), null, NOW).can_vote).toBe(false);
    expect(serializePost(row(), AUTHOR, NOW).can_vote).toBe(false);
    expect(serializePost(row({ my_choice: 'A' }), VOTER, NOW).can_vote).toBe(false);
    expect(serializePost(row({ reveal_at: '2026-06-01T00:00:00Z' }), VOTER, NOW).can_vote).toBe(false);
    expect(serializePost(row({ status: 'revealed', chosen_option: 'A', poster_feeling: 'happy' }), VOTER, NOW).can_vote).toBe(false);
  });

  test('can_reveal: only the author, only once the timer has run out', () => {
    expect(serializePost(row(), AUTHOR, NOW).can_reveal).toBe(false);
    expect(serializePost(row({ reveal_at: '2026-06-01T00:00:00Z' }), AUTHOR, NOW).can_reveal).toBe(true);
    expect(serializePost(row({ status: 'awaiting_outcome' }), VOTER, NOW).can_reveal).toBe(false);
    expect(serializePost(row({ status: 'unresolved' }), AUTHOR, NOW).can_reveal).toBe(false);
  });
});
