import { z } from 'zod';
import { revealPost } from '../services/reveal.service.js';

const revealSchema = z.object({
  outcome_text: z.string().min(1).max(1000),
  poster_feeling: z.enum(['happy', 'regret']),
});

export async function submitReveal(req, res, next) {
  const parsed = revealSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
  }

  try {
    const result = await revealPost(req.user.id, req.params.id, parsed.data);
    return res.json({ success: true, data: result });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, error: err.message });
    }
    next(err);
  }
}
