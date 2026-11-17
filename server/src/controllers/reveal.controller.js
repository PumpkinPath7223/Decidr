import { z } from 'zod';
import { revealPost } from '../services/reveal.service.js';
import { LIMITS } from '../utils/constants.js';
import { parse, parseId } from '../utils/validate.js';

const revealSchema = z.object({
  chosen_option: z.enum(['A', 'B'], { message: 'Tell us which option you went with' }),
  poster_feeling: z.enum(['happy', 'regret'], { message: 'Tell us how you feel about it' }),
  outcome_text: z
    .string()
    .trim()
    .max(LIMITS.outcome.max)
    .optional()
    .transform((value) => value || undefined),
});

export async function submitReveal(req, res, next) {
  try {
    const data = await revealPost(req.user.id, parseId(req.params.id), parse(revealSchema, req.body));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
