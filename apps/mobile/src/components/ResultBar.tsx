import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors } from '../theme';
import { type Choice, type PostResult } from '../types';

function AnimatedBar({ pct, color }: { pct: number; color: string }) {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(pct, { duration: 600 });
  }, [pct, width]);

  const animatedStyle = useAnimatedStyle(() => ({ width: `${width.value}%` }));

  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, { backgroundColor: color }, animatedStyle]} />
    </View>
  );
}

type Props = { result: PostResult; myChoice: Choice | null; live?: boolean };

/** The crowd's split, weighted by voter rank, with the raw number of votes underneath. */
export default function ResultBar({ result, myChoice, live = false }: Props) {
  const votes = `${result.total_votes.toLocaleString()} vote${result.total_votes === 1 ? '' : 's'}`;

  if (result.pct_a === null || result.pct_b === null) {
    return <Text style={styles.caption}>No votes yet</Text>;
  }

  const rows: { label: Choice; pct: number; color: string }[] = [
    { label: 'A', pct: result.pct_a, color: colors.optionA },
    { label: 'B', pct: result.pct_b, color: colors.optionB },
  ];

  return (
    <View style={styles.container} accessibilityLabel={`Option A ${result.pct_a} percent, option B ${result.pct_b} percent, ${votes}`}>
      {rows.map((row) => (
        <View key={row.label} style={styles.row}>
          <Text style={[styles.label, myChoice === row.label && { color: row.color }]}>
            {row.label}
            {myChoice === row.label ? ' ✓' : ''}
          </Text>
          <AnimatedBar pct={row.pct} color={row.color} />
          <Text style={styles.pct}>{row.pct}%</Text>
        </View>
      ))}
      <Text style={styles.caption}>
        {votes} · weighted by voter rank{live ? ' · updating live' : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 14, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { width: 26, fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.track, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  pct: { width: 38, fontSize: 12, color: colors.textSecondary, textAlign: 'right' },
  caption: { fontSize: 11, color: colors.textMuted, marginTop: 6 },
});
