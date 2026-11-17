import { AppError, fromDbError } from '../src/utils/AppError.js';
import { decodeCursor, encodeCursor } from '../src/utils/cursor.js';
import { containsAbuse, containsCrisisLanguage } from '../src/utils/moderation.js';
import { rankForPoints, rankProgress, weightForRank } from '../src/utils/ranks.js';

describe('ranks', () => {
  test('thresholds', () => {
    expect(rankForPoints(0)).toBe('Rookie');
    expect(rankForPoints(49)).toBe('Rookie');
    expect(rankForPoints(50)).toBe('Analyst');
    expect(rankForPoints(149)).toBe('Analyst');
    expect(rankForPoints(150)).toBe('Strategist');
    expect(rankForPoints(299)).toBe('Strategist');
    expect(rankForPoints(300)).toBe('Oracle');
    expect(rankForPoints(100000)).toBe('Oracle');
  });

  test('weights', () => {
    expect(weightForRank('Rookie')).toBe(1.0);
    expect(weightForRank('Analyst')).toBe(1.1);
    expect(weightForRank('Strategist')).toBe(1.25);
    expect(weightForRank('Oracle')).toBe(1.5);
    expect(weightForRank('Nonsense')).toBe(1.0);
  });

  test('progress toward the next rank', () => {
    expect(rankProgress(0)).toMatchObject({ rank: 'Rookie', next_rank: 'Analyst', points_to_next: 50, progress: 0 });
    expect(rankProgress(100)).toMatchObject({ rank: 'Analyst', next_rank: 'Strategist', points_to_next: 50, progress: 0.5 });
    expect(rankProgress(400)).toMatchObject({ rank: 'Oracle', next_rank: null, points_to_next: 0, progress: 1 });
  });
});

describe('cursor', () => {
  const row = { created_at: '2026-03-29T20:10:52.123456+00:00', id: '33333333-3333-4333-8333-333333333333' };

  test('round-trips the timestamp string exactly, microseconds included', () => {
    expect(decodeCursor(encodeCursor(row))).toEqual({ createdAt: row.created_at, id: row.id });
  });

  test('no cursor means first page', () => {
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor('')).toBeNull();
  });

  test('rejects garbage and SQL-looking payloads', () => {
    const bad = [
      'not-a-cursor',
      Buffer.from('{"a":1}').toString('base64url'),
      Buffer.from(JSON.stringify(['2026-01-01; DROP TABLE posts', row.id])).toString('base64url'),
      Buffer.from(JSON.stringify([row.created_at, 'nope'])).toString('base64url'),
    ];
    for (const cursor of bad) {
      expect(() => decodeCursor(cursor)).toThrow(AppError);
    }
  });
});

describe('moderation', () => {
  test('flags direct abuse', () => {
    expect(containsAbuse('just kill yourself')).toBe(true);
    expect(containsAbuse('fine', null, 'KYS loser')).toBe(true);
  });

  test('leaves ordinary decisions alone', () => {
    expect(containsAbuse('Should I quit my job to start a bakery?', 'Quit', 'Stay')).toBe(false);
    expect(containsAbuse('My class assignment is killing me', 'Skip the party')).toBe(false);
    expect(containsAbuse(undefined, null, '')).toBe(false);
  });

  test('routes crisis language to support resources', () => {
    expect(containsCrisisLanguage('I have been feeling suicidal lately')).toBe(true);
    expect(containsCrisisLanguage("I don't want to live anymore")).toBe(true);
    expect(containsCrisisLanguage('Thinking about ending it all')).toBe(true);
    expect(containsCrisisLanguage('Should I end my lease early?')).toBe(false);
  });
});

describe('fromDbError', () => {
  test('maps a named SQL exception to a client-safe error', () => {
    const err = fromDbError({ message: 'ALREADY_VOTED', code: 'P0001' });
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(409);
    expect(err.code).toBe('ALREADY_VOTED');
  });

  test('leaves unknown database errors alone so they are not shown to the client', () => {
    const raw = { message: 'relation "posts" does not exist', code: '42P01' };
    expect(fromDbError(raw)).toBe(raw);
  });
});
