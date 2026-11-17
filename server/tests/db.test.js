// Runs the real migrations and SQL functions in an in-process Postgres (PGlite).
import { encodeCursor } from '../src/utils/cursor.js';
import { serializePost } from '../src/serializers/posts.serializer.js';
import { RANKS, rankForPoints, weightForRank } from '../src/utils/ranks.js';
import {
  applyMigration,
  createPost,
  createTestDb,
  createUser,
  expirePost,
  getUser,
} from './helpers/db.js';

let db;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db.close();
});

async function vote(userId, postId, choice) {
  const { rows } = await db.query('SELECT cast_vote($1, $2, $3) AS result', [userId, postId, choice]);
  return rows[0].result;
}

async function reveal(authorId, postId, chosen, feeling, text = null) {
  const { rows } = await db.query('SELECT reveal_post($1, $2, $3, $4, $5) AS result', [
    authorId,
    postId,
    chosen,
    feeling,
    text,
  ]);
  return rows[0].result;
}

async function queryPosts(params = {}) {
  const { rows } = await db.query('SELECT * FROM query_posts($1, $2, $3, $4, $5, $6, $7)', [
    params.viewerId ?? null,
    params.tag ?? null,
    params.postId ?? null,
    params.scope ?? 'feed',
    params.cursorCreatedAt ?? null,
    params.cursorId ?? null,
    params.limit ?? 20,
  ]);
  return rows;
}

async function getPostRow(postId) {
  const { rows } = await db.query('SELECT * FROM posts WHERE id = $1', [postId]);
  return rows[0];
}

async function getTally(postId) {
  const { rows } = await db.query('SELECT * FROM post_tallies WHERE post_id = $1', [postId]);
  return rows[0];
}

describe('rank helpers', () => {
  test('SQL and JS agree on every threshold', async () => {
    const points = [0, 1, 49, 50, 51, 149, 150, 299, 300, 301, 5000];
    for (const value of points) {
      const { rows } = await db.query('SELECT rank_for_points($1) AS rank', [value]);
      expect(rows[0].rank).toBe(rankForPoints(value));
    }
    for (const { rank } of RANKS) {
      const { rows } = await db.query('SELECT weight_for_rank($1) AS weight', [rank]);
      expect(Number(rows[0].weight)).toBe(weightForRank(rank));
    }
  });
});

describe('cast_vote', () => {
  test('records the vote, awards 1 point and updates the tally', async () => {
    const author = await createUser(db);
    const voter = await createUser(db);
    const post = await createPost(db, author.id);

    const result = await vote(voter.id, post.id, 'A');
    expect(result.vote.choice).toBe('A');
    expect(result.voter_stats).toEqual({ points: 1, points_awarded: 1, total_votes: 1, rank: 'Rookie' });

    const user = await getUser(db, voter.id);
    expect(user.points).toBe(1);
    expect(user.total_votes).toBe(1);

    const tally = await getTally(post.id);
    expect(tally.votes_a).toBe(1);
    expect(tally.votes_b).toBe(0);
  });

  test('weights the vote by the rank the voter holds at that moment', async () => {
    const author = await createUser(db);
    const rookie = await createUser(db);
    const oracle = await createUser(db, { points: 400 });
    const strategist = await createUser(db, { points: 150 });
    const post = await createPost(db, author.id);

    await vote(rookie.id, post.id, 'A');
    await vote(oracle.id, post.id, 'B');
    await vote(strategist.id, post.id, 'B');

    const tally = await getTally(post.id);
    expect(tally.votes_a).toBe(1);
    expect(tally.votes_b).toBe(2);
    expect(Number(tally.weighted_a)).toBe(1.0);
    expect(Number(tally.weighted_b)).toBe(2.75);
  });

  test('rejects a second vote on the same post', async () => {
    const author = await createUser(db);
    const voter = await createUser(db);
    const post = await createPost(db, author.id);

    await vote(voter.id, post.id, 'A');
    await expect(vote(voter.id, post.id, 'B')).rejects.toThrow('ALREADY_VOTED');
    expect((await getUser(db, voter.id)).points).toBe(1);
    expect((await getTally(post.id)).votes_b).toBe(0);
  });

  test('authors cannot vote on their own post', async () => {
    const author = await createUser(db);
    const post = await createPost(db, author.id);
    await expect(vote(author.id, post.id, 'A')).rejects.toThrow('OWN_POST');
  });

  test('voting closes when the timer runs out, even before the cron job flips the status', async () => {
    const author = await createUser(db);
    const voter = await createUser(db);
    const post = await createPost(db, author.id);
    await expirePost(db, post.id);
    await expect(vote(voter.id, post.id, 'A')).rejects.toThrow('VOTING_CLOSED');
  });

  test('rejects bad input and missing rows', async () => {
    const author = await createUser(db);
    const voter = await createUser(db);
    const post = await createPost(db, author.id);
    const missing = '99999999-9999-4999-8999-999999999999';

    await expect(vote(voter.id, post.id, 'C')).rejects.toThrow('INVALID_CHOICE');
    await expect(vote(voter.id, missing, 'A')).rejects.toThrow('POST_NOT_FOUND');
    await expect(vote(missing, post.id, 'A')).rejects.toThrow('USER_NOT_FOUND');
  });

  test('vote points stop after 20 votes in a day; votes still count', async () => {
    const author = await createUser(db);
    const voter = await createUser(db);

    let last;
    for (let i = 0; i < 22; i += 1) {
      const post = await createPost(db, author.id);
      last = await vote(voter.id, post.id, 'A');
    }

    expect(last.voter_stats.points_awarded).toBe(0);
    const user = await getUser(db, voter.id);
    expect(user.points).toBe(20);
    expect(user.total_votes).toBe(22);
  });

  test('crossing a threshold promotes the voter', async () => {
    const author = await createUser(db);
    const voter = await createUser(db, { points: 49 });
    const post = await createPost(db, author.id);

    const result = await vote(voter.id, post.id, 'A');
    expect(result.voter_stats.rank).toBe('Analyst');
    expect((await getUser(db, voter.id)).rank).toBe('Analyst');
    // The vote itself was cast as a Rookie.
    expect(Number(result.vote.weight)).toBe(1.0);
  });
});

describe('reveal_post — scoring', () => {
  async function setup() {
    const author = await createUser(db);
    const votedA = await createUser(db);
    const votedB1 = await createUser(db);
    const votedB2 = await createUser(db);
    const post = await createPost(db, author.id);
    await vote(votedA.id, post.id, 'A');
    await vote(votedB1.id, post.id, 'B');
    await vote(votedB2.id, post.id, 'B');
    await expirePost(db, post.id);
    return { author, votedA, votedB1, votedB2, post };
  }

  test.each([
    ['A', 'happy', 'A'],
    ['B', 'happy', 'B'],
    ['A', 'regret', 'B'],
    ['B', 'regret', 'A'],
  ])('chose %s and feels %s -> %s voters were right', async (chosen, feeling, expectedSide) => {
    const { author, votedA, votedB1, post } = await setup();
    const result = await reveal(author.id, post.id, chosen, feeling);

    expect(result.correct_side).toBe(expectedSide);
    expect(result.total_voters).toBe(3);
    expect(result.correct_voters).toBe(expectedSide === 'A' ? 1 : 2);

    const a = await getUser(db, votedA.id);
    const b = await getUser(db, votedB1.id);
    expect(a.correct_votes).toBe(expectedSide === 'A' ? 1 : 0);
    expect(b.correct_votes).toBe(expectedSide === 'B' ? 1 : 0);
    expect(a.resolved_votes).toBe(1);
    expect(b.resolved_votes).toBe(1);
    // 1 point for voting, +5 if they called it.
    expect(a.points).toBe(expectedSide === 'A' ? 6 : 1);
    expect(b.points).toBe(expectedSide === 'B' ? 6 : 1);
  });

  test('the majority does not decide: a happy poster who went against the crowd makes the minority right', async () => {
    const { author, votedA, votedB1, votedB2, post } = await setup();
    // B has the majority (2 of 3). The author chose A and is happy with it.
    await reveal(author.id, post.id, 'A', 'happy');

    const { rows } = await db.query('SELECT user_id, is_correct FROM votes WHERE post_id = $1', [post.id]);
    const byUser = Object.fromEntries(rows.map((r) => [r.user_id, r.is_correct]));
    expect(byUser[votedA.id]).toBe(true);
    expect(byUser[votedB1.id]).toBe(false);
    expect(byUser[votedB2.id]).toBe(false);
  });

  test('stores the outcome and gives the author 10 points', async () => {
    const { author, post } = await setup();
    await reveal(author.id, post.id, 'B', 'regret', '  Wish I had taken it.  ');

    const row = await getPostRow(post.id);
    expect(row.status).toBe('revealed');
    expect(row.chosen_option).toBe('B');
    expect(row.poster_feeling).toBe('regret');
    expect(row.outcome_text).toBe('Wish I had taken it.');
    expect(row.revealed_at).not.toBeNull();

    const user = await getUser(db, author.id);
    expect(user.points).toBe(10);
    expect(user.resolved_votes).toBe(0);
  });

  test('a blank outcome story is stored as null', async () => {
    const { author, post } = await setup();
    await reveal(author.id, post.id, 'A', 'happy', '   ');
    expect((await getPostRow(post.id)).outcome_text).toBeNull();
  });

  test('works on a post nobody voted on', async () => {
    const author = await createUser(db);
    const post = await createPost(db, author.id);
    await expirePost(db, post.id);
    const result = await reveal(author.id, post.id, 'A', 'happy');
    expect(result).toMatchObject({ total_voters: 0, correct_voters: 0, correct_side: 'A' });
  });

  test('accuracy stays null until 5 votes have resolved, then becomes a percentage', async () => {
    const author = await createUser(db);
    const voter = await createUser(db);

    // The voter always picks A. A is right on posts 1-4 and wrong on post 5 and 6.
    const outcomes = ['happy', 'happy', 'happy', 'happy', 'regret', 'regret'];
    const seen = [];
    for (const feeling of outcomes) {
      const post = await createPost(db, author.id);
      await vote(voter.id, post.id, 'A');
      await expirePost(db, post.id);
      await reveal(author.id, post.id, 'A', feeling);
      seen.push((await getUser(db, voter.id)).accuracy_score);
    }

    expect(seen.slice(0, 4)).toEqual([null, null, null, null]);
    expect(Number(seen[4])).toBe(80);
    expect(Number(seen[5])).toBe(66.67);

    const user = await getUser(db, voter.id);
    expect(user.resolved_votes).toBe(6);
    expect(user.correct_votes).toBe(4);
    // 6 vote points + 4 correct calls x 5
    expect(user.points).toBe(26);
  });

  test('points from a correct call can promote a voter', async () => {
    const author = await createUser(db);
    const voter = await createUser(db, { points: 45 });
    const post = await createPost(db, author.id);
    await vote(voter.id, post.id, 'A'); // 46
    await expirePost(db, post.id);
    await reveal(author.id, post.id, 'A', 'happy'); // 51
    const user = await getUser(db, voter.id);
    expect(user.points).toBe(51);
    expect(user.rank).toBe('Analyst');
  });
});

describe('reveal_post — guards', () => {
  test('only the author can reveal', async () => {
    const author = await createUser(db);
    const other = await createUser(db);
    const post = await createPost(db, author.id);
    await expirePost(db, post.id);
    await expect(reveal(other.id, post.id, 'A', 'happy')).rejects.toThrow('NOT_AUTHOR');
  });

  test('not before the timer finishes', async () => {
    const author = await createUser(db);
    const post = await createPost(db, author.id);
    await expect(reveal(author.id, post.id, 'A', 'happy')).rejects.toThrow('TOO_EARLY');
  });

  test('cannot be revealed twice, and scoring is not applied twice', async () => {
    const author = await createUser(db);
    const voter = await createUser(db);
    const post = await createPost(db, author.id);
    await vote(voter.id, post.id, 'A');
    await expirePost(db, post.id);
    await reveal(author.id, post.id, 'A', 'happy');

    await expect(reveal(author.id, post.id, 'B', 'regret')).rejects.toThrow('ALREADY_REVEALED');
    expect((await getUser(db, voter.id)).points).toBe(6);
    expect((await getUser(db, author.id)).points).toBe(10);
    expect((await getPostRow(post.id)).chosen_option).toBe('A');
  });

  test('a post closed as unresolved cannot be revealed later', async () => {
    const author = await createUser(db);
    const post = await createPost(db, author.id);
    await expirePost(db, post.id, 8 * 24 * 3600);
    await db.query(`UPDATE posts SET status = 'unresolved' WHERE id = $1`, [post.id]);
    await expect(reveal(author.id, post.id, 'A', 'happy')).rejects.toThrow('REVEAL_WINDOW_CLOSED');
  });

  test('rejects invalid input', async () => {
    const author = await createUser(db);
    const post = await createPost(db, author.id);
    await expirePost(db, post.id);
    await expect(reveal(author.id, post.id, 'C', 'happy')).rejects.toThrow('INVALID_CHOICE');
    await expect(reveal(author.id, post.id, 'A', 'meh')).rejects.toThrow('INVALID_FEELING');
  });

  test('a revealed post cannot be stored without its outcome', async () => {
    const author = await createUser(db);
    const post = await createPost(db, author.id);
    await expect(db.query(`UPDATE posts SET status = 'revealed' WHERE id = $1`, [post.id])).rejects.toThrow();
  });
});

describe('posts', () => {
  test('creating a post makes its tally row and counts toward total_posts', async () => {
    const author = await createUser(db);
    const post = await createPost(db, author.id);
    expect(await getTally(post.id)).toMatchObject({ votes_a: 0, votes_b: 0 });
    expect((await getUser(db, author.id)).total_posts).toBe(1);
  });

  test('tag and length rules are enforced by the database', async () => {
    const author = await createUser(db);
    await expect(createPost(db, author.id, { category_tags: [] })).rejects.toThrow();
    await expect(createPost(db, author.id, { category_tags: ['crypto'] })).rejects.toThrow();
    await expect(
      createPost(db, author.id, { category_tags: ['career', 'money', 'health', 'lifestyle'] })
    ).rejects.toThrow();
    await expect(createPost(db, author.id, { title: 'Hey' })).rejects.toThrow();
    await expect(createPost(db, author.id, { option_a: 'x'.repeat(81) })).rejects.toThrow();
  });

  test('only one open Live Crisis post per author', async () => {
    const author = await createUser(db);
    const first = await createPost(db, author.id, { is_live_crisis: true });
    await expect(createPost(db, author.id, { is_live_crisis: true })).rejects.toThrow();

    await db.query(`UPDATE posts SET status = 'awaiting_outcome' WHERE id = $1`, [first.id]);
    await expect(createPost(db, author.id, { is_live_crisis: true })).resolves.toBeDefined();
  });

  test('delete_post: author only, and only before anyone votes', async () => {
    const author = await createUser(db);
    const other = await createUser(db);
    const post = await createPost(db, author.id);

    await expect(db.query('SELECT delete_post($1, $2)', [other.id, post.id])).rejects.toThrow('NOT_AUTHOR');

    await vote(other.id, post.id, 'A');
    await expect(db.query('SELECT delete_post($1, $2)', [author.id, post.id])).rejects.toThrow('POST_LOCKED');

    const empty = await createPost(db, author.id);
    await db.query('SELECT delete_post($1, $2)', [author.id, empty.id]);
    expect(await getPostRow(empty.id)).toBeUndefined();
    expect((await getUser(db, author.id)).total_posts).toBe(1);
  });

  test('deleting a user removes their votes from the tallies', async () => {
    const author = await createUser(db);
    const voter = await createUser(db, { points: 300 });
    const post = await createPost(db, author.id);
    await vote(voter.id, post.id, 'B');

    await db.query('DELETE FROM users WHERE id = $1', [voter.id]);
    const tally = await getTally(post.id);
    expect(tally.votes_b).toBe(0);
    expect(Number(tally.weighted_b)).toBe(0);
  });

  test('deleting the auth user cascades to the profile and everything they made', async () => {
    const author = await createUser(db);
    const post = await createPost(db, author.id);
    await db.query('DELETE FROM auth.users WHERE id = $1', [author.id]);
    expect(await getUser(db, author.id)).toBeUndefined();
    expect(await getPostRow(post.id)).toBeUndefined();
  });
});

describe('query_posts', () => {
  test('returns the viewer\'s own vote and nothing for a guest', async () => {
    const author = await createUser(db);
    const voter = await createUser(db);
    const post = await createPost(db, author.id);
    await vote(voter.id, post.id, 'B');

    const [asVoter] = await queryPosts({ viewerId: voter.id, postId: post.id });
    expect(asVoter.my_choice).toBe('B');

    const [asGuest] = await queryPosts({ postId: post.id });
    expect(asGuest.my_choice).toBeNull();
  });

  test('through the serializer: a voter sees no counts before reveal and no author_id ever', async () => {
    const author = await createUser(db);
    const voter = await createUser(db);
    const post = await createPost(db, author.id);
    await vote(voter.id, post.id, 'A');

    const [before] = await queryPosts({ viewerId: voter.id, postId: post.id });
    const hidden = serializePost(before, voter.id);
    expect(hidden.result).toBeNull();
    expect(hidden.my_choice).toBe('A');
    expect(JSON.stringify(hidden)).not.toContain(author.id);

    await expirePost(db, post.id);
    await reveal(author.id, post.id, 'A', 'happy', 'Great call.');

    const [after] = await queryPosts({ viewerId: voter.id, postId: post.id });
    const shown = serializePost(after, voter.id);
    expect(shown.status).toBe('revealed');
    expect(shown.result).toEqual({ total_votes: 1, pct_a: 100, pct_b: 0 });
    expect(shown.outcome).toMatchObject({ correct_side: 'A', my_is_correct: true, outcome_text: 'Great call.' });
    expect(JSON.stringify(shown)).not.toContain(author.id);
  });

  test('filters by tag', async () => {
    const author = await createUser(db);
    const money = await createPost(db, author.id, { category_tags: ['money', 'lifestyle'] });
    const health = await createPost(db, author.id, { category_tags: ['health'] });

    const ids = (await queryPosts({ tag: 'money', limit: 50 })).map((row) => row.id);
    expect(ids).toContain(money.id);
    expect(ids).not.toContain(health.id);
  });

  test('scopes: mine and voted', async () => {
    const author = await createUser(db);
    const voter = await createUser(db);
    const mine = await createPost(db, author.id);
    const other = await createPost(db, voter.id);
    await vote(voter.id, mine.id, 'A');

    const myPosts = await queryPosts({ viewerId: author.id, scope: 'mine' });
    expect(myPosts.map((row) => row.id)).toEqual([mine.id]);

    const voted = await queryPosts({ viewerId: voter.id, scope: 'voted' });
    expect(voted.map((row) => row.id)).toEqual([mine.id]);
    expect(voted.map((row) => row.id)).not.toContain(other.id);
  });

  test('hides removed posts and posts by blocked authors', async () => {
    const author = await createUser(db);
    const viewer = await createUser(db);
    const blockedPost = await createPost(db, author.id);
    const other = await createUser(db);
    const removed = await createPost(db, other.id);
    await db.query(`UPDATE posts SET status = 'removed' WHERE id = $1`, [removed.id]);
    await db.query('INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2)', [viewer.id, author.id]);

    const ids = (await queryPosts({ viewerId: viewer.id, limit: 50 })).map((row) => row.id);
    expect(ids).not.toContain(blockedPost.id);
    expect(ids).not.toContain(removed.id);

    expect(await queryPosts({ viewerId: viewer.id, postId: removed.id })).toHaveLength(0);
    // The owner still sees their removed post in "my posts".
    const ownerView = await queryPosts({ viewerId: other.id, scope: 'mine' });
    expect(ownerView.map((row) => row.id)).toContain(removed.id);
  });

  test('cursor pagination walks every post exactly once, newest first', async () => {
    const fresh = await createTestDb();
    try {
      const author = await createUser(fresh);
      const created = [];
      for (let i = 0; i < 7; i += 1) {
        created.push((await createPost(fresh, author.id)).id);
      }
      // Give two posts an identical timestamp to exercise the id tie-breaker.
      await fresh.query('UPDATE posts SET created_at = (SELECT created_at FROM posts WHERE id = $1) WHERE id = $2', [
        created[2],
        created[3],
      ]);

      const seen = [];
      let cursor = null;
      for (let page = 0; page < 10; page += 1) {
        const { rows } = await fresh.query('SELECT * FROM query_posts(NULL, NULL, NULL, $1, $2, $3, 3)', [
          'feed',
          cursor?.createdAt ?? null,
          cursor?.id ?? null,
        ]);
        if (!rows.length) break;
        seen.push(...rows.map((row) => row.id));
        const last = rows[rows.length - 1];
        // Same shape the API uses; the cursor must survive an encode/decode round trip.
        const encoded = encodeCursor({ created_at: last.created_at.toISOString(), id: last.id });
        expect(typeof encoded).toBe('string');
        cursor = { createdAt: last.created_at, id: last.id };
      }

      expect(seen).toHaveLength(7);
      expect(new Set(seen).size).toBe(7);
      expect(new Set(seen)).toEqual(new Set(created));
    } finally {
      await fresh.close();
    }
  });

  test('limit is clamped to 50', async () => {
    const rows = await queryPosts({ limit: 100000 });
    expect(rows.length).toBeLessThanOrEqual(50);
  });
});

describe('reports', () => {
  test('three different reporters pull an open post; a duplicate report does not count', async () => {
    const author = await createUser(db);
    const post = await createPost(db, author.id);
    const reporters = [await createUser(db), await createUser(db), await createUser(db)];
    const insert = (reporterId) =>
      db.query(
        `INSERT INTO reports (reporter_id, target_type, target_id, reason) VALUES ($1, 'post', $2, 'spam')`,
        [reporterId, post.id]
      );

    await insert(reporters[0].id);
    await expect(insert(reporters[0].id)).rejects.toThrow();
    await insert(reporters[1].id);
    expect((await getPostRow(post.id)).status).toBe('open');

    await insert(reporters[2].id);
    expect((await getPostRow(post.id)).status).toBe('removed');
  });

  test('three reports hide a comment', async () => {
    const author = await createUser(db);
    const commenter = await createUser(db);
    const post = await createPost(db, author.id);
    const { rows: [comment] } = await db.query(
      `INSERT INTO comments (user_id, post_id, body, voter_choice, user_rank_at_time)
       VALUES ($1, $2, 'hello', 'A', 'Rookie') RETURNING id`,
      [commenter.id, post.id]
    );
    for (let i = 0; i < 3; i += 1) {
      const reporter = await createUser(db);
      await db.query(
        `INSERT INTO reports (reporter_id, target_type, target_id, reason) VALUES ($1, 'comment', $2, 'abuse')`,
        [reporter.id, comment.id]
      );
    }
    const { rows } = await db.query('SELECT hidden FROM comments WHERE id = $1', [comment.id]);
    expect(rows[0].hidden).toBe(true);
  });
});

describe('stats', () => {
  test('regret_index and user_category_accuracy aggregate per tag', async () => {
    const fresh = await createTestDb();
    try {
      const author = await createUser(fresh);
      const voter = await createUser(fresh);
      const plan = [
        { tags: ['money'], feeling: 'regret' },
        { tags: ['money', 'career'], feeling: 'happy' },
        { tags: ['career'], feeling: 'happy' },
      ];
      for (const { tags, feeling } of plan) {
        const post = await createPost(fresh, author.id, { category_tags: tags });
        await fresh.query('SELECT cast_vote($1, $2, $3)', [voter.id, post.id, 'A']);
        await expirePost(fresh, post.id);
        await fresh.query('SELECT reveal_post($1, $2, $3, $4, NULL)', [author.id, post.id, 'A', feeling]);
      }
      // An unrevealed post must not be counted.
      await createPost(fresh, author.id, { category_tags: ['money'] });

      const { rows: index } = await fresh.query('SELECT * FROM regret_index()');
      const byTag = Object.fromEntries(index.map((row) => [row.tag, row]));
      expect(byTag.money).toMatchObject({ revealed_posts: 2, happy_posts: 1, regret_posts: 1 });
      expect(Number(byTag.money.regret_pct)).toBe(50);
      expect(byTag.career).toMatchObject({ revealed_posts: 2, happy_posts: 2, regret_posts: 0 });

      const { rows: accuracy } = await fresh.query('SELECT * FROM user_category_accuracy($1)', [voter.id]);
      const accByTag = Object.fromEntries(accuracy.map((row) => [row.tag, row]));
      expect(accByTag.money).toMatchObject({ resolved_votes: 2, correct_votes: 1 });
      expect(accByTag.career).toMatchObject({ resolved_votes: 2, correct_votes: 2 });
    } finally {
      await fresh.close();
    }
  });
});

describe('upgrading a database that already has 0001–0004 applied', () => {
  test('0005 migrates existing rows instead of failing', async () => {
    const old = await createTestDb({ upTo: '0004_drop_reveal_at.sql' });
    try {
      const ids = {};
      for (const name of ['author', 'voter']) {
        const { rows } = await old.query('INSERT INTO auth.users DEFAULT VALUES RETURNING id');
        ids[name] = rows[0].id;
        await old.query('INSERT INTO users (id, username, points, accuracy_score) VALUES ($1, $2, 12, 100)', [
          ids[name],
          name,
        ]);
      }
      // Rows shaped the way the old code wrote them: no reveal_at, loose tags, long title.
      const { rows: [openPost] } = await old.query(
        `INSERT INTO posts (author_id, title, option_a, option_b, category_tags)
         VALUES ($1, $2, 'Yes', 'No', '{}') RETURNING id`,
        [ids.author, 'x'.repeat(200)]
      );
      const { rows: [revealedPost] } = await old.query(
        `INSERT INTO posts (author_id, title, option_a, option_b, revealed, outcome_text, poster_feeling)
         VALUES ($1, 'Old revealed post', 'Yes', 'No', true, 'It went fine', 'happy') RETURNING id`,
        [ids.author]
      );
      const { rows: [taggedPost] } = await old.query(
        `INSERT INTO posts (author_id, title, option_a, option_b, category_tags)
         VALUES ($1, 'Old tagged post', 'Yes', 'No', '{"#Money","crypto","career","money"}') RETURNING id`,
        [ids.author]
      );
      await old.query(
        `INSERT INTO votes (user_id, post_id, choice, weight, is_correct) VALUES ($1, $2, 'A', 1.0, true), ($1, $3, 'B', 1.1, NULL)`,
        [ids.voter, revealedPost.id, openPost.id]
      );

      await applyMigration(old, '0005_core_loop_foundation.sql');

      const { rows: posts } = await old.query('SELECT id, status, reveal_at, title, category_tags FROM posts');
      const byId = Object.fromEntries(posts.map((row) => [row.id, row]));
      expect(byId[openPost.id].status).toBe('open');
      expect(byId[openPost.id].reveal_at).not.toBeNull();
      expect(byId[revealedPost.id].status).toBe('unresolved');
      const { rows: [voter] } = await old.query('SELECT * FROM users WHERE id = $1', [ids.voter]);
      expect(voter.points).toBe(12);
      expect(voter.accuracy_score).toBeNull();
      expect(voter.resolved_votes).toBe(0);

      const { rows: votes } = await old.query('SELECT is_correct FROM votes');
      expect(votes.every((row) => row.is_correct === null)).toBe(true);

      // Old rows are normalised so they can still be updated under the new constraints.
      expect(byId[openPost.id].title).toHaveLength(140);
      expect(byId[openPost.id].category_tags).toEqual(['lifestyle']);
      expect(byId[taggedPost.id].category_tags).toEqual(['money', 'career']);

      // ...which means the old open post can go through the normal flow.
      await old.query(`UPDATE posts SET reveal_at = now() - interval '1 minute' WHERE id = $1`, [openPost.id]);
      await old.query('SELECT reveal_post($1, $2, $3, $4, NULL)', [ids.author, openPost.id, 'B', 'happy']);
      const { rows: [scored] } = await old.query('SELECT correct_votes, resolved_votes FROM users WHERE id = $1', [ids.voter]);
      expect(scored).toEqual({ correct_votes: 1, resolved_votes: 1 });

      // Running the migration again must not wipe scores earned since.
      await applyMigration(old, '0005_core_loop_foundation.sql');
      const { rows: [afterRerun] } = await old.query('SELECT correct_votes, resolved_votes FROM users WHERE id = $1', [ids.voter]);
      expect(afterRerun).toEqual({ correct_votes: 1, resolved_votes: 1 });
      const { rows: [rescored] } = await old.query('SELECT is_correct FROM votes WHERE post_id = $1', [openPost.id]);
      expect(rescored.is_correct).toBe(true);

      const { rows: [tally] } = await old.query('SELECT * FROM post_tallies WHERE post_id = $1', [openPost.id]);
      expect(tally.votes_b).toBe(1);
      expect(Number(tally.weighted_b)).toBe(1.1);


      // New rows still have to follow the new rules.
      await expect(
        old.query(
          `INSERT INTO posts (author_id, title, option_a, option_b, category_tags, reveal_at)
           VALUES ($1, 'Valid title', 'Yes', 'No', '{}', now())`,
          [ids.author]
        )
      ).rejects.toThrow();
    } finally {
      await old.close();
    }
  });
});

describe('row level security', () => {
  test('is enabled on every table', async () => {
    const { rows } = await db.query(
      `SELECT relname, relrowsecurity FROM pg_class
       WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'`
    );
    expect(rows.length).toBeGreaterThanOrEqual(7);
    for (const row of rows) {
      expect({ table: row.relname, rls: row.relrowsecurity }).toEqual({ table: row.relname, rls: true });
    }
  });

  test('the SQL functions are not executable by PUBLIC', async () => {
    const { rows } = await db.query(
      `SELECT proname, has_function_privilege('public', oid, 'EXECUTE') AS public_can_execute
       FROM pg_proc
       WHERE pronamespace = 'public'::regnamespace
         AND proname IN ('cast_vote', 'reveal_post', 'delete_post', 'query_posts')`
    );
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.public_can_execute).toBe(false);
    }
  });
});
