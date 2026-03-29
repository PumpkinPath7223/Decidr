import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  label: 'A' | 'B';
  text: string;
  selected: boolean;
  dimmed: boolean;
  locked: boolean;
  onPress?: () => void;
};

const COLORS = {
  A: { solid: '#3B82F6', light: '#EFF6FF' },
  B: { solid: '#8B5CF6', light: '#F5F3FF' },
};

export default function OptionRow({ label, text, selected, dimmed, locked, onPress }: Props) {
  const { solid, light } = COLORS[label];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={locked}
      activeOpacity={0.85}
      style={[
        styles.row,
        { backgroundColor: selected ? solid : light },
        dimmed && styles.dimmed,
      ]}
    >
      <View style={[styles.labelBubble, { backgroundColor: selected ? '#fff' : solid }]}>
        <Text style={[styles.bubbleText, { color: selected ? solid : '#fff' }]}>
          {selected ? '✓' : label}
        </Text>
      </View>
      <Text style={[styles.optionText, selected && styles.optionTextSelected]} numberOfLines={3}>
        {text}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    gap: 10,
    marginTop: 8,
  },
  dimmed: { opacity: 0.38 },
  labelBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bubbleText: { fontWeight: '800', fontSize: 13 },
  optionText: { flex: 1, fontSize: 14, color: '#1F2937', lineHeight: 20 },
  optionTextSelected: { color: '#fff', fontWeight: '600' },
});
