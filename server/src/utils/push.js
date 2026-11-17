import { Expo } from 'expo-server-sdk';
import supabase from './supabase.js';

let expoClient = null;

function getExpo() {
  if (!expoClient) {
    expoClient = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN || undefined });
  }
  return expoClient;
}

// Sends one notification to many devices. Never throws: a push failure must not fail the
// request or job that triggered it. Tokens Expo reports as dead are cleared.
export async function sendPush(tokens, { title, body, data = {} }) {
  const valid = [...new Set(tokens)].filter((token) => token && Expo.isExpoPushToken(token));
  if (!valid.length) return { sent: 0 };

  const expo = getExpo();
  const messages = valid.map((to) => ({ to, sound: 'default', title, body, data }));
  const deadTokens = [];
  let sent = 0;

  for (const chunk of expo.chunkPushNotifications(messages)) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      tickets.forEach((ticket, index) => {
        if (ticket.status === 'ok') {
          sent += 1;
        } else if (ticket.details?.error === 'DeviceNotRegistered') {
          deadTokens.push(chunk[index].to);
        }
      });
    } catch (err) {
      console.error('[push] chunk failed:', err.message);
    }
  }

  if (deadTokens.length) {
    const { error } = await supabase.from('users').update({ push_token: null }).in('push_token', deadTokens);
    if (error) console.error('[push] failed to clear dead tokens:', error.message);
  }

  return { sent };
}
