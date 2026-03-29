import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

type BarProps = { pct: number; isA: boolean };

function AnimatedBar({ pct, isA }: BarProps) {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(pct, { duration: 600 });
  }, [pct]);

  const animStyle = useAnimatedStyle(() => ({ width: `${width.value}%` as unknown as number }));

  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, isA ? styles.fillA : styles.fillB, animStyle]} />
    </View>
  );
}

type Props = {
  votesA: number | null;
  votesB: number | null;
  total: number | null;
  myChoice: 'A' | 'B' | null;
};

export default function WeightedResultBar({ votesA, votesB, total, myChoice }: Props) {
  if (votesA == null || votesB == null || total == null) return null;

  const pctA = total > 0 ? Math.round((votesA / total) * 100) : 50;
  const pctB = 100 - pctA;

  return (
    <View style={styles.container}>
      {(['A', 'B'] as const).map((label) => {
        const isA = label === 'A';
        const pct = isA ? pctA : pctB;
        const isVoted = myChoice === label;
        return (
          <View key={label} style={styles.row}>
            <Text style={[styles.label, isVoted && (isA ? styles.highlightA : styles.highlightB)]}>
              {label}{isVoted ? ' ✓' : ''}
            </Text>
            <AnimatedBar pct={pct} isA={isA} />
            <Text style={styles.pct}>{pct}%</Text>
          </View>
        );
      })}
      <Text style={styles.totalText}>{total.toLocaleString()} weighted votes</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 14, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { width: 20, fontSize: 12, fontWeight: '700', color: '#6B7280' },
  highlightA: { color: '#3B82F6' },
  highlightB: { color: '#8B5CF6' },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: '#F3F4F6', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  fillA: { backgroundColor: '#3B82F6' },
  fillB: { backgroundColor: '#8B5CF6' },
  pct: { width: 32, fontSize: 12, color: '#6B7280', textAlign: 'right' },
  totalText: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
});
