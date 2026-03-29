import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

const RANK_COLORS: Record<string, { bg: string; text: string }> = {
  Rookie:     { bg: '#F3F4F6', text: '#6B7280' },
  Analyst:    { bg: '#DBEAFE', text: '#2563EB' },
  Strategist: { bg: '#EDE9FE', text: '#7C3AED' },
  Oracle:     { bg: '#FEF3C7', text: '#D97706' },
};

type Props = { rank: string; revealed: boolean };

export default function VoteConfirmation({ rank, revealed }: Props) {
  const colors = RANK_COLORS[rank] ?? RANK_COLORS.Rookie;
  return (
    <Animated.View entering={FadeInUp.duration(300).springify()} style={styles.row}>
      <Text style={styles.label}>
        {revealed ? 'You voted' : 'Reveal pending'}
      </Text>
      <View style={[styles.rankBadge, { backgroundColor: colors.bg }]}>
        <Text style={[styles.rankText, { color: colors.text }]}>{rank}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  label: { fontSize: 12, color: '#9CA3AF' },
  rankBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  rankText: { fontSize: 11, fontWeight: '700' },
});
