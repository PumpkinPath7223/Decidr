import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { cardShadow, colors } from '../theme';
import { type Profile } from '../types';
import RankBadge from './RankBadge';

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/** Username, rank progress, headline stats and per-category accuracy. */
export default function ProfileHeader({ profile }: { profile: Profile }) {
  const progress = profile.rank_progress;
  const pct = Math.round(Math.min(1, Math.max(0, progress.progress)) * 100);
  const accuracy = profile.accuracy_score === null ? '—' : `${Math.round(profile.accuracy_score)}%`;
  const scored = profile.categories.filter((category) => category.accuracy !== null);

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <Text style={styles.username}>{profile.username}</Text>
        <RankBadge rank={profile.rank} size="large" />
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.progressText}>
        {progress.next_rank
          ? `${profile.points} pts · ${progress.points_to_next} to ${progress.next_rank} · votes count ${progress.weight}x`
          : `${profile.points} pts · top rank · votes count ${progress.weight}x`}
      </Text>

      <View style={styles.stats}>
        <Stat value={accuracy} label="Accuracy" />
        <Stat value={String(profile.total_votes)} label="Votes" />
        <Stat value={String(profile.resolved_votes)} label="Resolved" />
        <Stat value={String(profile.total_posts)} label="Posts" />
      </View>

      {profile.accuracy_score === null && (
        <Text style={styles.calibrating}>
          Calibrating — your accuracy shows after {profile.votes_until_accuracy} more of your votes{' '}
          {profile.votes_until_accuracy === 1 ? 'is' : 'are'} revealed.
        </Text>
      )}

      {scored.length > 0 && (
        <View style={styles.categories}>
          <Text style={styles.sectionLabel}>Accuracy by category</Text>
          {scored.map((category) => (
            <View key={category.tag} style={styles.categoryRow}>
              <Text style={styles.categoryTag}>#{category.tag}</Text>
              <View style={styles.categoryTrack}>
                <View style={[styles.categoryFill, { width: `${category.accuracy ?? 0}%` }]} />
              </View>
              <Text style={styles.categoryValue}>
                {category.accuracy}% ({category.correct_votes}/{category.resolved_votes})
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 20, padding: 18, marginHorizontal: 16, marginTop: 8, gap: 10, ...cardShadow },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  username: { fontSize: 22, fontWeight: '800', color: colors.text, flexShrink: 1 },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.track, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },
  progressText: { fontSize: 12, color: colors.textSecondary },
  stats: { flexDirection: 'row', marginTop: 6 },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 11, color: colors.textMuted },
  calibrating: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  categories: { marginTop: 6, gap: 8 },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  categoryTag: { width: 104, fontSize: 12, color: colors.primary },
  categoryTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.track, overflow: 'hidden' },
  categoryFill: { height: '100%', borderRadius: 3, backgroundColor: colors.success },
  categoryValue: { width: 84, fontSize: 11, color: colors.textSecondary, textAlign: 'right' },
});
