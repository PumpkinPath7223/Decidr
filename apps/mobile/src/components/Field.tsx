import React from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors } from '../theme';

type Props = TextInputProps & { label: string; value: string; maxLength: number; tall?: boolean };

/** Labelled text input with a character counter. */
export default function Field({ label, value, maxLength, tall = false, style, ...input }: Props) {
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.counter}>
          {value.length}/{maxLength}
        </Text>
      </View>
      <TextInput
        accessibilityLabel={label}
        style={[styles.input, tall && styles.tall, style]}
        placeholderTextColor={colors.textMuted}
        value={value}
        maxLength={maxLength}
        multiline={tall}
        {...input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  label: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  counter: { fontSize: 11, color: colors.textMuted },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: colors.text, backgroundColor: colors.card },
  tall: { minHeight: 88, textAlignVertical: 'top' },
});
