import cron from 'node-cron';
import supabase from '../utils/supabase.js';
import { UNRESOLVED_GRACE_DAYS } from '../utils/constants.js';

// Daily: posts whose author never came back within the grace period are closed as
// 'unresolved'. The vote split becomes visible; nobody's accuracy or points change.
// Re-running is harmless — closed posts no longer match the filter.
export async function closeUnresolvedPosts(now = new Date()) {
  const cutoff = new Date(now.getTime() - UNRESOLVED_GRACE_DAYS * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from('posts')
    .update({ status: 'unresolved' })
    .in('status', ['open', 'awaiting_outcome'])
    .lte('reveal_at', cutoff.toISOString())
    .select('id');

  if (error) {
    console.error('[unresolvedCloser] failed:', error.message);
    return { closed: 0 };
  }
  if (data.length) console.log(`[unresolvedCloser] closed ${data.length} unresolved post(s)`);
  return { closed: data.length };
}

export function startUnresolvedCloser() {
  cron.schedule('0 2 * * *', async () => {
    try {
      await closeUnresolvedPosts();
    } catch (err) {
      console.error('[unresolvedCloser] unhandled error:', err.message);
    }
  });
  console.log('[unresolvedCloser] scheduled — daily at 02:00');
}
