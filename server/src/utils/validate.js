import { z } from 'zod';
import { AppError } from './AppError.js';

export function parse(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue.path.length ? `${issue.path.join('.')}: ` : '';
    throw new AppError(400, `${field}${issue.message}`);
  }
  return result.data;
}

const uuidSchema = z.string().uuid();

export function parseId(value) {
  const result = uuidSchema.safeParse(value);
  if (!result.success) throw new AppError(404, 'Not found');
  return result.data;
}
