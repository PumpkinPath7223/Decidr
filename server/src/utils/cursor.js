import { AppError } from './AppError.js';

const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The timestamp is carried as the exact string Postgres returned (microsecond precision).
// Parsing it into a JS Date would truncate to milliseconds and skip or repeat rows.
export function encodeCursor(row) {
  return Buffer.from(JSON.stringify([row.created_at, row.id])).toString('base64url');
}

export function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const [createdAt, id] = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (typeof createdAt === 'string' && TIMESTAMP.test(createdAt) && typeof id === 'string' && UUID.test(id)) {
      return { createdAt, id };
    }
  } catch {
    // fall through
  }
  throw new AppError(400, 'Invalid cursor');
}
