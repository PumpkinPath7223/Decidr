import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import RankBadge from '../components/RankBadge';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenState';
import SegmentedControl from '../components/SegmentedControl';
import { useLeaderboard, useRegretIndex } from '../hooks/useProfile';
import { errorMessage } from '../services/api.service';
import { useAuthStore } from '../store/auth.store';
import { cardShadow, colors } from '../theme';
import { type LeaderboardEntry, type RegretEntry } from '../types';

type Section = 'leaderboard' | 'regret';

const SECTIONS = [
  { value: 'leaderboard', label: 'Leaderboard' },
  { value: 'regret', label: 'Regret Index' },
] as const;

function LeaderRow({ entry, isMe }: { entry: LeaderboardEntry; isMe: boolean }) {
  return (
    <View style={[styles.row, isMe && styles.meRow]}>
      <Text style={styles.position}>{entry.position}</Text>
      <View style={styles.rowBody}>
        <Text style={styles.name} numberOfLines={1}>
          {entry.username}
          {isMe ? ' (you)' : ''}
        </Text>
        <RankBadge rank={entry.rank} />
      </View>
      <View style={styles.rowEnd}>
        <Text style={styles.accuracy}>{Math.round(entry.accuracy_score)}%</Text>
        <Text style={styles.sub}>{entry.resolved_votes} resolved</Text>
      </View>
    </View>
  );
}

function RegretRow({ entry }: { entry: RegretEntry }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowBody}>
        <Text style={styles.tag}>#{entry.tag}</Text>
        {entry.enough_data && entry.regret_pct !== null ? (
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${entry.regret_pct}%` }]} />
          </View>
        ) : (
          <Text style={styles.sub}>
            Needs {entry.posts_needed} more revealed post{entry.posts_needed === 1 ? '' : 's'}
          </Text>
        )}
      </View>
      <View style={styles.rowEnd}>
        <Text style={styles.accuracy}>{entry.regret_pct === null ? '—' : `${Math.round(entry.regret_pct)}%`}</Text>
        <Text style={styles.sub}>{entry.regret_pct === null ? `${entry.revealed_posts} so far` : 'regret'}</Text>
      </View>
    </View>
  );
}

export default function RanksScreen() {
  const [section, setSection] = useState<Section>('leaderboard');
  const myId = useAuthStore((s) => s.user?.id ?? null);
  const leaderboard = useLeaderboard();
  const regret = useRegretIndex();
  const active = section === 'leaderboard' ? leaderboard : regret;

  let body: React.ReactNode;
  if (active.isLoading) {
    body = <LoadingState />;
  } else if (active.isError && !active.data) {
    body = <ErrorState message={errorMessage(active.error)} onRetry={() => void active.refetch()} />;
  } else if (section === 'leaderboard') {
    const entries = leaderboard.data ?? [];
    body =
      entries.length === 0 ? (
        <EmptyState title="No one is ranked yet" hint="You appear here once 5 of your votes have been revealed." />
      ) : (
        entries.map((entry) => <LeaderRow key={entry.id} entry={entry} isMe={entry.id === myId} />)
      );
  } else {
    body = (regret.data ?? []).map((entry) => <RegretRow key={entry.tag} entry={entry} />);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.heading}>Ranks</Text>
        <Text style={styles.caption}>
          {section === 'leaderboard'
            ? 'Who calls it right most often.'
            : 'How often posters end up regretting their choice, by category.'}
        </Text>
        <SegmentedControl options={SECTIONS} value={section} onChange={setSection} />
      </View>
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={active.isRefetching} onRefresh={() => void active.refetch()} tintColor={colors.primary} />
        }
      >
        {body}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 4, gap: 8, paddingBottom: 8 },
  heading: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  caption: { fontSize: 13, color: colors.textMuted },
  list: { paddingBottom: 40, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 14, padding: 14, marginHorizontal: 16, marginVertical: 5, ...cardShadow },
  meRow: { borderWidth: 1.5, borderColor: colors.primary },
  position: { width: 26, fontSize: 16, fontWeight: '800', color: colors.textSecondary, textAlign: 'center' },
  rowBody: { flex: 1, gap: 6 },
  rowEnd: { alignItems: 'flex-end', gap: 2 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  accuracy: { fontSize: 18, fontWeight: '800', color: colors.text },
  sub: { fontSize: 11, color: colors.textMuted },
  tag: { fontSize: 15, fontWeight: '700', color: colors.primary },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.track, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: colors.warning },
});
