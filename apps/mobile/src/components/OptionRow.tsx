import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme';
import { type Choice } from '../types';

type Props = {
  label: Choice;
  text: string;
  selected: boolean;
  dimmed: boolean;
  locked: boolean;
  /** Short note under the text, e.g. "They chose this". */
  note?: string | null;
  onPress?: () => void;
};

const COLORS = {
  A: { solid: colors.optionA, light: colors.optionALight },
  B: { solid: colors.optionB, light: colors.optionBLight },
};

export default function OptionRow({ label, text, selected, dimmed, locked, note, onPress }: Props) {
  const { solid, light } = COLORS[label];

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`Option ${label}: ${text}${selected ? ', your vote' : ''}`}
      accessibilityState={{ selected, disabled: locked }}
      onPress={onPress}
      disabled={locked}
      activeOpacity={0.85}
      style={[styles.row, { backgroundColor: selected ? solid : light }, dimmed && styles.dimmed]}
    >
      <View style={[styles.labelBubble, { backgroundColor: selected ? '#fff' : solid }]}>
        <Text style={[styles.bubbleText, { color: selected ? solid : '#fff' }]}>{selected ? '✓' : label}</Text>
      </View>
      <View style={styles.body}>
        <Text style={[styles.optionText, selected && styles.optionTextSelected]} numberOfLines={3}>
          {text}
        </Text>
        {note ? <Text style={[styles.note, selected && styles.noteSelected]}>{note}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 12, gap: 10, marginTop: 8 },
  dimmed: { opacity: 0.45 },
  labelBubble: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bubbleText: { fontWeight: '800', fontSize: 13 },
  body: { flex: 1, gap: 2 },
  optionText: { fontSize: 14, color: '#1F2937', lineHeight: 20 },
  optionTextSelected: { color: '#fff', fontWeight: '600' },
  note: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  noteSelected: { color: 'rgba(255,255,255,0.9)' },
});
