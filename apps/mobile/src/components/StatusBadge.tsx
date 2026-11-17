import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTimeLeft } from '../hooks/useTimeLeft';
import { colors } from '../theme';
import { type Post } from '../types';

type Tone = { bg: string; fg: string };

const TONES: Record<'live' | 'open' | 'waiting' | 'revealed' | 'muted', Tone> = {
  live: { bg: colors.dangerLight, fg: colors.danger },
  open: { bg: colors.primaryLight, fg: colors.primary },
  waiting: { bg: colors.warningLight, fg: colors.warning },
  revealed: { bg: colors.successLight, fg: colors.success },
  muted: { bg: colors.track, fg: colors.textSecondary },
};

function describe(post: Post, timeLeft: string | null): { label: string; tone: Tone } {
  switch (post.status) {
    case 'revealed':
      return { label: '✓ Revealed', tone: TONES.revealed };
    case 'unresolved':
      return { label: 'No outcome reported', tone: TONES.muted };
    case 'removed':
      return { label: 'Removed', tone: TONES.muted };
    case 'awaiting_outcome':
      return { label: 'Voting closed · waiting on outcome', tone: TONES.waiting };
    default:
      // The timer can run out while the screen is open, before the next refetch.
      if (!timeLeft) return { label: 'Voting closed · waiting on outcome', tone: TONES.waiting };
      return post.is_live_crisis
        ? { label: `⚡ Live · ${timeLeft} left`, tone: TONES.live }
        : { label: `Reveal in ${timeLeft}`, tone: TONES.open };
  }
}

export default function StatusBadge({ post }: { post: Post }) {
  const timeLeft = useTimeLeft(post.reveal_at);
  const { label, tone } = describe(post, timeLeft);
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
      <Text style={[styles.text, { color: tone.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  text: { fontSize: 12, fontWeight: '600' },
});
