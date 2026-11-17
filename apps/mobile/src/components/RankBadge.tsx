import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { rankColors } from '../theme';
import { type Rank } from '../types';

type Props = { rank: Rank; size?: 'small' | 'large' };

export default function RankBadge({ rank, size = 'small' }: Props) {
  const palette = rankColors[rank] ?? rankColors.Rookie;
  const large = size === 'large';
  return (
    <View style={[styles.badge, large && styles.badgeLarge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.text, large && styles.textLarge, { color: palette.text }]}>{rank}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, alignSelf: 'flex-start' },
  badgeLarge: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 },
  text: { fontSize: 11, fontWeight: '700' },
  textLarge: { fontSize: 14 },
});
