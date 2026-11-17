import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors } from '../theme';

type Props = { label: string; selected: boolean; onPress: () => void; disabled?: boolean };

export default function Chip({ label, selected, onPress, disabled = false }: Props) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
      style={[styles.chip, selected && styles.selected, disabled && styles.disabled]}
    >
      <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  disabled: { opacity: 0.4 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  selectedLabel: { color: '#fff' },
});
