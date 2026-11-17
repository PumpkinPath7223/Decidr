import { z } from 'zod';
import * as safetyService from '../services/safety.service.js';
import { LIMITS } from '../utils/constants.js';
import { parse } from '../utils/validate.js';

const targetSchema = {
  target_type: z.enum(['post', 'comment']),
  target_id: z.string().uuid(),
};

const reportSchema = z.object({
  ...targetSchema,
  reason: z.string().trim().min(LIMITS.reportReason.min, 'Tell us what is wrong').max(LIMITS.reportReason.max),
});

const blockSchema = z.object(targetSchema);

export async function report(req, res, next) {
  try {
    const data = await safetyService.reportContent(req.user.id, parse(reportSchema, req.body));
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function block(req, res, next) {
  try {
    const data = await safetyService.blockAuthorOf(req.user.id, parse(blockSchema, req.body));
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function clearBlocks(req, res, next) {
  try {
    res.json({ success: true, data: await safetyService.clearBlocks(req.user.id) });
  } catch (err) {
    next(err);
  }
}
