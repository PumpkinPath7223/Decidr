import { AppError, fromDbError } from '../utils/AppError.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ success: false, error: 'Not found' });
}

// Last middleware in the chain. Known errors go to the client as-is; everything else is
// logged and answered with a generic message so database details never leak.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const known = err instanceof AppError ? err : fromDbError(err);

  if (known instanceof AppError) {
    const body = { success: false, error: known.message };
    if (known.code) body.code = known.code;
    return res.status(known.status).json(body);
  }

  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: 'Invalid JSON body' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ success: false, error: 'Request body too large' });
  }

  console.error('[error]', req.method, req.originalUrl, err);
  res.status(500).json({ success: false, error: 'Internal server error' });
}
