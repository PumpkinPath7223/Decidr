// An error that is safe to show to the client. Anything else becomes a generic 500.
export class AppError extends Error {
  constructor(status, message, code = null) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

// Names raised by the SQL functions (RAISE EXCEPTION '<NAME>').
const DB_EXCEPTIONS = {
  POST_NOT_FOUND: [404, 'Post not found'],
  USER_NOT_FOUND: [404, 'User not found'],
  OWN_POST: [403, "You can't vote on your own post"],
  VOTING_CLOSED: [409, 'Voting has closed for this post'],
  ALREADY_VOTED: [409, 'You have already voted on this post'],
  INVALID_CHOICE: [400, "Choice must be 'A' or 'B'"],
  INVALID_FEELING: [400, "Feeling must be 'happy' or 'regret'"],
  NOT_AUTHOR: [403, 'Only the author of this post can do that'],
  ALREADY_REVEALED: [409, 'The outcome has already been submitted for this post'],
  REVEAL_WINDOW_CLOSED: [409, 'This post was closed as unresolved and can no longer be revealed'],
  TOO_EARLY: [409, 'The reveal timer has not finished yet'],
  POST_LOCKED: [409, 'A post can only be deleted while it is open and has no votes'],
};

// Turns a Supabase/Postgres error into an AppError when it is one we know about.
// Unknown errors are returned untouched so the error middleware logs them and answers 500.
export function fromDbError(error) {
  if (!error) return null;
  const message = String(error.message ?? '');
  for (const [name, [status, text]] of Object.entries(DB_EXCEPTIONS)) {
    if (message.includes(name)) return new AppError(status, text, name);
  }
  if (error.code === '22P02') return new AppError(400, 'Invalid id');
  return error;
}

export function throwDbError(error) {
  if (error) throw fromDbError(error);
}
