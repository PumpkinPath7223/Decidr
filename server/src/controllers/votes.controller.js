import { z } from 'zod';
import * as votesService from '../services/votes.service.js';
import { parse, parseId } from '../utils/validate.js';

const voteSchema = z.object({
  choice: z.enum(['A', 'B'], { message: "choice must be 'A' or 'B'" }),
});

export async function castVote(req, res, next) {
  try {
    const { choice } = parse(voteSchema, req.body);
    const data = await votesService.castVote(req.user.id, parseId(req.params.id), choice);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
