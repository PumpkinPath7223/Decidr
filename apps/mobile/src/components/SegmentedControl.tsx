import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme';

type Props<T extends string> = {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

export default function SegmentedControl<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            activeOpacity={0.8}
            style={[styles.segment, selected && styles.selected]}
          >
            <Text style={[styles.label, selected && styles.selectedLabel]}>{option.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', backgroundColor: colors.track, borderRadius: 12, padding: 3 },
  segment: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  selected: { backgroundColor: colors.card },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  selectedLabel: { color: colors.text },
});
