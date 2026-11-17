import cron from 'node-cron';
import supabase from '../utils/supabase.js';
import { sendPush } from '../utils/push.js';

// Every 5 minutes: close voting on posts whose timer has run out and ask the author
// what they chose.
//
// The UPDATE is the claim. A post leaves 'open' in the same statement that returns it,
// so running the job twice (or on two servers) can never notify the same post twice.
export async function closeExpiredPosts(now = new Date()) {
  const { data: posts, error } = await supabase
    .from('posts')
    .update({ status: 'awaiting_outcome', reveal_notified_at: now.toISOString() })
    .eq('status', 'open')
    .lte('reveal_at', now.toISOString())
    .select('id, title, author_id');

  if (error) {
    console.error('[revealNotifier] failed to close expired posts:', error.message);
    return { closed: 0 };
  }
  if (!posts.length) return { closed: 0 };

  const authorIds = [...new Set(posts.map((post) => post.author_id))];
  const { data: authors, error: authorsError } = await supabase
    .from('users')
    .select('id, push_token')
    .in('id', authorIds);

  if (authorsError) {
    console.error('[revealNotifier] failed to load authors:', authorsError.message);
    return { closed: posts.length };
  }

  const tokenByAuthor = new Map(authors.map((author) => [author.id, author.push_token]));
  for (const post of posts) {
    await sendPush([tokenByAuthor.get(post.author_id)], {
      title: "Time's up — what did you choose?",
      body: `Voting has closed on "${post.title}". Tell everyone how it went.`,
      data: { postId: post.id, type: 'awaiting_outcome' },
    });
  }

  console.log(`[revealNotifier] closed voting on ${posts.length} post(s)`);
  return { closed: posts.length };
}

export function startRevealNotifier() {
  cron.schedule('*/5 * * * *', async () => {
    try {
      await closeExpiredPosts();
    } catch (err) {
      console.error('[revealNotifier] unhandled error:', err.message);
    }
  });
  console.log('[revealNotifier] scheduled — every 5 minutes');
}
