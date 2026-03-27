import { z } from 'zod';
import * as votesService from '../services/votes.service.js';

const voteSchema = z.object({
  choice: z.enum(['A', 'B'], { message: "choice must be 'A' or 'B'" }),
});

export async function castVote(req, res, next) {
  const parsed = voteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
  }

  try {
    const result = await votesService.castVote(req.user.id, req.params.id, parsed.data.choice);
    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, error: err.message });
    }
    next(err);
  }
}
