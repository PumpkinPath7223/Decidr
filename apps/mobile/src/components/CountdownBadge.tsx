import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = { isLiveCrisis: boolean; revealed: boolean };

export default function CountdownBadge({ isLiveCrisis, revealed }: Props) {
  if (revealed) {
    return (
      <View style={[styles.badge, styles.revealedBadge]}>
        <Text style={styles.revealedText}>✓ Revealed</Text>
      </View>
    );
  }

  if (isLiveCrisis) {
    return (
      <View style={[styles.badge, styles.liveBadge]}>
        <Text style={styles.liveText}>⚡ Live</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  liveBadge: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5' },
  revealedBadge: { backgroundColor: '#ECFDF5' },
  liveText: { fontSize: 12, color: '#EF4444', fontWeight: '600' },
  revealedText: { fontSize: 12, color: '#10B981', fontWeight: '600' },
});
