import * as statsService from '../services/stats.service.js';

export async function getLeaderboard(req, res, next) {
  try {
    res.json({ success: true, data: await statsService.getLeaderboard() });
  } catch (err) {
    next(err);
  }
}

export async function getRegretIndex(req, res, next) {
  try {
    res.json({ success: true, data: await statsService.getRegretIndex() });
  } catch (err) {
    next(err);
  }
}

export async function getRegretIndexForTag(req, res, next) {
  try {
    res.json({ success: true, data: await statsService.getRegretIndexForTag(String(req.params.tag).toLowerCase()) });
  } catch (err) {
    next(err);
  }
}
