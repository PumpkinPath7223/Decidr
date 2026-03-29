import cron from 'node-cron';
import Expo from 'expo-server-sdk';
import supabase from '../utils/supabase.js';

const expo = new Expo();

async function sendRevealNotifications() {
  // Find posts whose reveal window has passed but haven't been revealed yet
  const { data: posts, error: postsError } = await supabase
    .from('posts')
    .select('id, title')
    .lt('reveal_at', new Date().toISOString())
    .eq('revealed', false);

  if (postsError) {
    console.error('[revealNotifier] failed to query posts:', postsError.message);
    return;
  }

  if (!posts.length) return;

  console.log(`[revealNotifier] ${posts.length} post(s) ready to notify`);

  for (const post of posts) {
    // Fetch push tokens for all users who voted on this post
    const { data: votes, error: votesError } = await supabase
      .from('votes')
      .select('users(push_token)')
      .eq('post_id', post.id);

    if (votesError) {
      console.error(`[revealNotifier] failed to fetch votes for post ${post.id}:`, votesError.message);
      continue;
    }

    const tokens = votes
      .map((v) => v.users?.push_token)
      .filter((t) => t && Expo.isExpoPushToken(t));

    if (!tokens.length) continue;

    const messages = tokens.map((to) => ({
      to,
      sound: 'default',
      title: "Time's up — what happened?",
      body: "A decision you voted on is ready to reveal — tap to see the outcome.",
      data: { postId: post.id },
    }));

    // Expo recommends chunking in batches of 100
    const chunks = expo.chunkPushNotifications(messages);

    for (const chunk of chunks) {
      try {
        const tickets = await expo.sendPushNotificationsAsync(chunk);
        const failed = tickets.filter((t) => t.status === 'error');
        if (failed.length) {
          console.warn(`[revealNotifier] ${failed.length} ticket(s) errored for post ${post.id}`);
        }
      } catch (err) {
        console.error(`[revealNotifier] chunk send failed for post ${post.id}:`, err.message);
      }
    }

    console.log(`[revealNotifier] notified ${tokens.length} voter(s) for post ${post.id}`);
  }
}

export function startRevealNotifier() {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    sendRevealNotifications().catch((err) =>
      console.error('[revealNotifier] unhandled error:', err.message)
    );
  });

  console.log('[revealNotifier] cron started — runs every 5 minutes');
}
