// HTTP layer with Supabase, Redis and push replaced by fakes: routing, auth, validation,
// error mapping and what actually reaches the client.
import { jest } from '@jest/globals';
import request from 'supertest';

const AUTHOR = '11111111-1111-4111-8111-111111111111';
const VOTER = '22222222-2222-4222-8222-222222222222';
const POST_ID = '33333333-3333-4333-8333-333333333333';
const TOKENS = { 'voter-token': VOTER, 'author-token': AUTHOR };

const state = {
  rpc: {}, // name -> (params) => ({ data, error })
  tables: {}, // table -> { data, error }
  inserts: [],
  redisCount: 1,
};

function tableBuilder(table) {
  const builder = {};
  const chain = ['select', 'eq', 'neq', 'in', 'is', 'not', 'gte', 'lte', 'ilike', 'order', 'limit', 'update', 'delete', 'upsert'];
  for (const method of chain) builder[method] = () => builder;
  builder.insert = (row) => {
    state.inserts.push({ table, row });
    return builder;
  };
  const resolve = () => Promise.resolve(state.tables[table] ?? { data: null, error: null });
  builder.single = resolve;
  builder.maybeSingle = resolve;
  builder.then = (onFulfilled, onRejected) => resolve().then(onFulfilled, onRejected);
  return builder;
}

const fakeSupabase = {
  auth: {
    getUser: async (token) =>
      TOKENS[token] ? { data: { user: { id: TOKENS[token] } }, error: null } : { data: { user: null }, error: { message: 'bad jwt' } },
    admin: { createUser: async () => ({ data: null, error: { message: 'unused' } }), deleteUser: async () => ({ error: null }) },
  },
  rpc: async (name, params) => {
    const handler = state.rpc[name];
    if (!handler) return { data: null, error: { message: `no fake for ${name}` } };
    return handler(params);
  },
  from: (table) => tableBuilder(table),
};

jest.unstable_mockModule('../src/utils/supabase.js', () => ({
  default: fakeSupabase,
  createAuthClient: () => fakeSupabase,
}));
jest.unstable_mockModule('../src/utils/redis.js', () => ({
  default: {
    incr: async () => state.redisCount,
    expire: async () => 1,
    ttl: async () => 120,
  },
}));
jest.unstable_mockModule('../src/utils/push.js', () => ({ sendPush: async () => ({ sent: 0 }) }));

const { createApp } = await import('../src/app.js');
const app = createApp();

function rawRow(overrides = {}) {
  return {
    id: POST_ID,
    author_id: AUTHOR,
    title: 'Should I take the new job?',
    context: null,
    option_a: 'Take it',
    option_b: 'Stay put',
    category_tags: ['career'],
    reveal_at: new Date(Date.now() + 3600_000).toISOString(),
    status: 'open',
    chosen_option: null,
    poster_feeling: null,
    outcome_text: null,
    revealed_at: null,
    is_live_crisis: false,
    comments_enabled: true,
    created_at: '2026-03-29T20:10:52.123456+00:00',
    votes_a: 7,
    votes_b: 3,
    weighted_a: 7.5,
    weighted_b: 3.1,
    my_choice: null,
    my_is_correct: null,
    comment_count: 0,
    ...overrides,
  };
}

const validPost = {
  title: 'Should I take the new job?',
  option_a: 'Take it',
  option_b: 'Stay put',
  category_tags: ['career'],
  reveal_in: '24h',
};

let errorSpy;

beforeEach(() => {
  state.rpc = {};
  state.tables = {};
  state.inserts = [];
  state.redisCount = 1;
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe('basics', () => {
  test('health check', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { status: 'ok' } });
  });

  test('unknown routes answer in the standard shape', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, error: 'Not found' });
  });

  test('malformed JSON is a 400, not a 500', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('auth is enforced on every protected route', () => {
  const protectedRoutes = [
    ['post', '/api/posts'],
    ['delete', `/api/posts/${POST_ID}`],
    ['post', `/api/posts/${POST_ID}/vote`],
    ['post', `/api/posts/${POST_ID}/reveal`],
    ['post', `/api/posts/${POST_ID}/comments`],
    ['get', '/api/users/me'],
    ['delete', '/api/users/me'],
    ['get', '/api/users/me/posts'],
    ['get', '/api/users/me/votes'],
    ['put', '/api/users/me/push-token'],
    ['delete', '/api/users/me/push-token'],
    ['post', '/api/reports'],
    ['post', '/api/blocks'],
    ['delete', '/api/blocks'],
  ];

  test.each(protectedRoutes)('%s %s without a token -> 401', async (method, path) => {
    const res = await request(app)[method](path).send({});
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test.each(protectedRoutes)('%s %s with a bad token -> 401', async (method, path) => {
    const res = await request(app)[method](path).set('Authorization', 'Bearer forged').send({});
    expect(res.status).toBe(401);
  });
});

describe('GET /api/feed', () => {
  test('never exposes author_id or pre-reveal counts', async () => {
    state.rpc.query_posts = () => ({ data: [rawRow(), rawRow({ id: '44444444-4444-4444-8444-444444444444' })], error: null });

    for (const auth of [null, 'voter-token']) {
      const req = request(app).get('/api/feed');
      if (auth) req.set('Authorization', `Bearer ${auth}`);
      const res = await req;

      expect(res.status).toBe(200);
      expect(res.body.data.posts).toHaveLength(2);
      const text = JSON.stringify(res.body);
      expect(text).not.toContain(AUTHOR);
      expect(text).not.toContain('author_id');
      expect(text).not.toContain('votes_a');
      expect(text).not.toContain('weighted');
      expect(res.body.data.posts[0].result).toBeNull();
    }
  });

  test('passes the viewer and tag to the query and returns a cursor when there is another page', async () => {
    let received;
    state.rpc.query_posts = (params) => {
      received = params;
      const rows = Array.from({ length: 21 }, (_, i) =>
        rawRow({ id: `44444444-4444-4444-8444-${String(i).padStart(12, '0')}` })
      );
      return { data: rows, error: null };
    };

    const res = await request(app).get('/api/feed?tag=career').set('Authorization', 'Bearer voter-token');
    expect(received).toMatchObject({ p_viewer_id: VOTER, p_tag: 'career', p_scope: 'feed', p_limit: 21 });
    expect(res.body.data.posts).toHaveLength(20);
    expect(typeof res.body.data.next_cursor).toBe('string');

    // The cursor is accepted back and reaches the query with the timestamp string untouched.
    await request(app).get(`/api/feed?cursor=${res.body.data.next_cursor}`);
    expect(received.p_cursor_created_at).toBe('2026-03-29T20:10:52.123456+00:00');
    expect(received.p_cursor_id).toBe('44444444-4444-4444-8444-000000000019');
  });

  test('last page has no cursor', async () => {
    state.rpc.query_posts = () => ({ data: [rawRow()], error: null });
    const res = await request(app).get('/api/feed');
    expect(res.body.data.next_cursor).toBeNull();
  });

  test('rejects unknown tags and bad cursors', async () => {
    expect((await request(app).get('/api/feed?tag=crypto')).status).toBe(400);
    expect((await request(app).get('/api/feed?cursor=garbage')).status).toBe(400);
  });

  test('a database failure is a generic 500 with no internals', async () => {
    state.rpc.query_posts = () => ({ data: null, error: { message: 'relation "posts" does not exist', code: '42P01' } });
    const res = await request(app).get('/api/feed');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, error: 'Internal server error' });
  });
});

describe('GET /api/posts/:id', () => {
  test('404 for a missing post or a malformed id', async () => {
    state.rpc.query_posts = () => ({ data: [], error: null });
    expect((await request(app).get(`/api/posts/${POST_ID}`)).status).toBe(404);
    expect((await request(app).get('/api/posts/not-a-uuid')).status).toBe(404);
  });

  test('the author sees is_owner and the split; a voter does not', async () => {
    state.rpc.query_posts = () => ({ data: [rawRow()], error: null });

    const asAuthor = await request(app).get(`/api/posts/${POST_ID}`).set('Authorization', 'Bearer author-token');
    expect(asAuthor.body.data.is_owner).toBe(true);
    expect(asAuthor.body.data.result).toEqual({ total_votes: 10, pct_a: 71, pct_b: 29 });
    expect(JSON.stringify(asAuthor.body)).not.toContain('author_id');

    const asVoter = await request(app).get(`/api/posts/${POST_ID}`).set('Authorization', 'Bearer voter-token');
    expect(asVoter.body.data.is_owner).toBe(false);
    expect(asVoter.body.data.result).toBeNull();
  });
});

describe('POST /api/posts', () => {
  const post = (body) => request(app).post('/api/posts').set('Authorization', 'Bearer author-token').send(body);

  test('creates a post with the timer converted to reveal_at', async () => {
    state.tables.posts = { data: { id: POST_ID }, error: null };
    state.rpc.query_posts = () => ({ data: [rawRow()], error: null });

    const before = Date.now();
    const res = await post(validPost);
    expect(res.status).toBe(201);
    expect(res.body.data.is_owner).toBe(true);

    const inserted = state.inserts.find((entry) => entry.table === 'posts').row;
    expect(inserted.author_id).toBe(AUTHOR);
    const revealIn = new Date(inserted.reveal_at).getTime() - before;
    expect(revealIn).toBeGreaterThanOrEqual(24 * 3600_000 - 1000);
    expect(revealIn).toBeLessThanOrEqual(24 * 3600_000 + 5000);
  });

  test('a Live Crisis post gets a 2 hour timer regardless of reveal_in', async () => {
    state.tables.posts = { data: { id: POST_ID }, error: null };
    state.rpc.query_posts = () => ({ data: [rawRow({ is_live_crisis: true })], error: null });

    const before = Date.now();
    const res = await post({ ...validPost, reveal_in: '30d', is_live_crisis: true });
    expect(res.status).toBe(201);
    const inserted = state.inserts.find((entry) => entry.table === 'posts').row;
    const revealIn = new Date(inserted.reveal_at).getTime() - before;
    expect(Math.round(revealIn / 3600_000)).toBe(2);
  });

  test.each([
    ['no timer', { ...validPost, reveal_in: undefined }],
    ['unknown timer', { ...validPost, reveal_in: '5m' }],
    ['identical options', { ...validPost, option_b: 'take it' }],
    ['no category', { ...validPost, category_tags: [] }],
    ['unknown category', { ...validPost, category_tags: ['crypto'] }],
    ['four categories', { ...validPost, category_tags: ['career', 'money', 'health', 'lifestyle'] }],
    ['duplicate categories', { ...validPost, category_tags: ['career', 'career'] }],
    ['title too short', { ...validPost, title: 'Hm?' }],
    ['title too long', { ...validPost, title: 'x'.repeat(141) }],
    ['option too long', { ...validPost, option_a: 'x'.repeat(81) }],
    ['whitespace-only option', { ...validPost, option_a: '   ' }],
  ])('rejects %s', async (_label, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(state.inserts).toHaveLength(0);
  });

  test('crisis language gets support resources instead of a post', async () => {
    const res = await post({ ...validPost, context: 'Honestly I have been feeling suicidal.' });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('CRISIS_RESOURCES');
    expect(res.body.error).toContain('988');
    expect(state.inserts).toHaveLength(0);
  });

  test('abusive language is rejected', async () => {
    const res = await post({ ...validPost, option_b: 'tell him to kys' });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('CONTENT_REJECTED');
  });

  test('a second open Live Crisis post is a 409', async () => {
    state.tables.posts = { data: null, error: { code: '23505', message: 'duplicate key' } };
    const res = await post({ ...validPost, is_live_crisis: true });
    expect(res.status).toBe(409);
  });

  test('the daily limit applies, but only to valid submissions', async () => {
    state.redisCount = 6;
    expect((await post(validPost)).status).toBe(429);
    // An invalid form is rejected for its content, not counted against the limit.
    expect((await post({ ...validPost, title: '' })).status).toBe(400);
  });
});

describe('POST /api/posts/:id/vote', () => {
  const vote = (body, token = 'voter-token') =>
    request(app).post(`/api/posts/${POST_ID}/vote`).set('Authorization', `Bearer ${token}`).send(body);

  test('casts a vote for the signed-in user', async () => {
    let received;
    state.rpc.cast_vote = (params) => {
      received = params;
      return {
        data: {
          vote: { id: 'x', post_id: POST_ID, choice: 'B', weight: 1.1, created_at: 'now' },
          voter_stats: { points: 51, points_awarded: 1, total_votes: 9, rank: 'Analyst' },
        },
        error: null,
      };
    };
    const res = await vote({ choice: 'B', user_id: AUTHOR });
    expect(res.status).toBe(201);
    // The user comes from the token, never from the body.
    expect(received).toEqual({ p_user_id: VOTER, p_post_id: POST_ID, p_choice: 'B' });
    expect(res.body.data.voter_stats.rank).toBe('Analyst');
    expect(JSON.stringify(res.body)).not.toContain('votes_a');
  });

  test.each([
    ['ALREADY_VOTED', 409],
    ['VOTING_CLOSED', 409],
    ['OWN_POST', 403],
    ['POST_NOT_FOUND', 404],
  ])('%s -> %i', async (name, status) => {
    state.rpc.cast_vote = () => ({ data: null, error: { message: name, code: 'P0001' } });
    const res = await vote({ choice: 'A' });
    expect(res.status).toBe(status);
    expect(res.body.code).toBe(name);
  });

  test('rejects an invalid choice', async () => {
    expect((await vote({ choice: 'C' })).status).toBe(400);
    expect((await vote({})).status).toBe(400);
  });

  test('is rate limited', async () => {
    state.redisCount = 61;
    const res = await vote({ choice: 'A' });
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('RATE_LIMITED');
  });
});

describe('POST /api/posts/:id/reveal', () => {
  const reveal = (body) =>
    request(app).post(`/api/posts/${POST_ID}/reveal`).set('Authorization', 'Bearer author-token').send(body);

  test('needs both the chosen option and the feeling', async () => {
    expect((await reveal({ poster_feeling: 'happy' })).status).toBe(400);
    expect((await reveal({ chosen_option: 'A' })).status).toBe(400);
    expect((await reveal({ chosen_option: 'A', poster_feeling: 'fine' })).status).toBe(400);
  });

  test('submits the outcome; the story is optional', async () => {
    let received;
    state.rpc.reveal_post = (params) => {
      received = params;
      return { data: { correct_side: 'B', total_voters: 10, correct_voters: 3 }, error: null };
    };
    state.rpc.query_posts = () => ({
      data: [rawRow({ status: 'revealed', chosen_option: 'A', poster_feeling: 'regret' })],
      error: null,
    });
    state.tables.votes = { data: [], error: null };

    const res = await reveal({ chosen_option: 'A', poster_feeling: 'regret' });
    expect(res.status).toBe(200);
    expect(received).toEqual({
      p_author_id: AUTHOR,
      p_post_id: POST_ID,
      p_chosen_option: 'A',
      p_poster_feeling: 'regret',
      p_outcome_text: null,
    });
    expect(res.body.data.correct_side).toBe('B');
    expect(res.body.data.post.outcome.correct_side).toBe('B');
  });

  test.each([
    ['NOT_AUTHOR', 403],
    ['TOO_EARLY', 409],
    ['ALREADY_REVEALED', 409],
  ])('%s -> %i', async (name, status) => {
    state.rpc.reveal_post = () => ({ data: null, error: { message: name, code: 'P0001' } });
    const res = await reveal({ chosen_option: 'A', poster_feeling: 'happy' });
    expect(res.status).toBe(status);
  });
});

describe('comments', () => {
  test('commenting requires having voted', async () => {
    state.tables.posts = { data: { id: POST_ID, status: 'open', comments_enabled: true }, error: null };
    state.tables.votes = { data: null, error: null };
    state.tables.users = { data: { rank: 'Rookie', accuracy_score: null }, error: null };

    const res = await request(app)
      .post(`/api/posts/${POST_ID}/comments`)
      .set('Authorization', 'Bearer voter-token')
      .send({ body: 'Take the job.' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('VOTE_REQUIRED');
    expect(state.inserts).toHaveLength(0);
  });

  test('a comment response carries the username but not the user id', async () => {
    state.tables.posts = { data: { id: POST_ID, status: 'open', comments_enabled: true }, error: null };
    state.tables.blocks = { data: [], error: null };
    state.tables.comments = {
      data: [
        {
          id: 'c1',
          user_id: VOTER,
          body: 'Take it.',
          voter_choice: 'A',
          user_rank_at_time: 'Analyst',
          user_accuracy_at_time: '72.50',
          created_at: 'now',
          users: { username: 'casey' },
        },
      ],
      error: null,
    };
    const res = await request(app).get(`/api/posts/${POST_ID}/comments`);
    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({ username: 'casey', voter_choice: 'A', rank: 'Analyst', accuracy: 72.5, is_mine: false });
    expect(JSON.stringify(res.body)).not.toContain(VOTER);
  });
});

describe('users', () => {
  test('/me is not mistaken for a user id', async () => {
    state.rpc.query_posts = () => ({ data: [rawRow()], error: null });
    const res = await request(app).get('/api/users/me/posts').set('Authorization', 'Bearer author-token');
    expect(res.status).toBe(200);
    expect(res.body.data.posts[0].is_owner).toBe(true);
  });

  test('a public profile has stats but no post count', async () => {
    state.tables.users = {
      data: {
        id: VOTER,
        username: 'casey',
        avatar_url: null,
        rank: 'Analyst',
        points: 100,
        accuracy_score: '72.50',
        resolved_votes: 8,
        correct_votes: 6,
        total_votes: 30,
        total_posts: 4,
        created_at: 'then',
      },
      error: null,
    };
    state.rpc.user_category_accuracy = () => ({ data: [{ tag: 'career', resolved_votes: 4, correct_votes: 3 }], error: null });

    const res = await request(app).get(`/api/users/${VOTER}/profile`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ username: 'casey', rank: 'Analyst', accuracy_score: 72.5 });
    expect(res.body.data).not.toHaveProperty('total_posts');
    expect(res.body.data.rank_progress).toMatchObject({ next_rank: 'Strategist', points_to_next: 50 });
    expect(res.body.data.categories.find((c) => c.tag === 'career').accuracy).toBe(75);
    expect(res.body.data.categories).toHaveLength(6);
  });
});

describe('safety', () => {
  test('blocking through a post does not reveal who wrote it', async () => {
    state.tables.posts = { data: { author_id: AUTHOR, status: 'open' }, error: null };
    state.tables.blocks = { data: null, error: null };
    const res = await request(app)
      .post('/api/blocks')
      .set('Authorization', 'Bearer voter-token')
      .send({ target_type: 'post', target_id: POST_ID });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true, data: { blocked: true } });
  });

  test("you can't report your own post", async () => {
    state.tables.posts = { data: { author_id: AUTHOR, status: 'open' }, error: null };
    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', 'Bearer author-token')
      .send({ target_type: 'post', target_id: POST_ID, reason: 'spam' });
    expect(res.status).toBe(400);
  });

  test('reporting the same thing twice is not an error', async () => {
    state.tables.posts = { data: { author_id: AUTHOR, status: 'open' }, error: null };
    state.tables.reports = { data: null, error: { code: '23505', message: 'duplicate' } };
    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', 'Bearer voter-token')
      .send({ target_type: 'post', target_id: POST_ID, reason: 'spam' });
    expect(res.status).toBe(201);
  });
});

describe('stats', () => {
  test('regret index withholds percentages until a category has enough revealed posts', async () => {
    state.rpc.regret_index = () => ({
      data: [
        { tag: 'money', revealed_posts: 25, happy_posts: 10, regret_posts: 15, regret_pct: 60 },
        { tag: 'career', revealed_posts: 3, happy_posts: 3, regret_posts: 0, regret_pct: 0 },
      ],
      error: null,
    });
    const res = await request(app).get('/api/regret-index');
    const byTag = Object.fromEntries(res.body.data.map((entry) => [entry.tag, entry]));
    expect(res.body.data).toHaveLength(6);
    expect(byTag.money).toMatchObject({ enough_data: true, regret_pct: 60, happy_pct: 40 });
    expect(byTag.career).toMatchObject({ enough_data: false, regret_pct: null, posts_needed: 17 });
    expect(byTag.health).toMatchObject({ enough_data: false, revealed_posts: 0 });

    expect((await request(app).get('/api/regret-index/money')).body.data.regret_pct).toBe(60);
    expect((await request(app).get('/api/regret-index/crypto')).status).toBe(404);
  });
});
