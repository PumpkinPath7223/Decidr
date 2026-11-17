import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

const BACKGROUND: Record<Variant, string> = {
  primary: colors.primary,
  secondary: colors.primaryLight,
  danger: colors.danger,
  ghost: 'transparent',
};

const FOREGROUND: Record<Variant, string> = {
  primary: '#fff',
  secondary: colors.primary,
  danger: '#fff',
  ghost: colors.textSecondary,
};

export default function Button({ label, onPress, variant = 'primary', loading = false, disabled = false, style }: Props) {
  const inactive = disabled || loading;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={onPress}
      disabled={inactive}
      activeOpacity={0.8}
      style={[styles.button, { backgroundColor: BACKGROUND[variant] }, inactive && styles.inactive, style]}
    >
      {loading ? (
        <ActivityIndicator color={FOREGROUND[variant]} size="small" />
      ) : (
        <Text style={[styles.label, { color: FOREGROUND[variant] }]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { borderRadius: 12, paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', minHeight: 46 },
  inactive: { opacity: 0.55 },
  label: { fontWeight: '700', fontSize: 15 },
});
