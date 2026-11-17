import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import Button from './Button';

export function LoadingState() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

type ErrorProps = { message: string; onRetry?: () => void };

export function ErrorState({ message, onRetry }: ErrorProps) {
  return (
    <View style={styles.center}>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry && <Button label="Try again" variant="secondary" onPress={onRetry} style={styles.retry} />}
    </View>
  );
}

type EmptyProps = { title: string; hint?: string };

export function EmptyState({ title, hint }: EmptyProps) {
  return (
    <View style={styles.center}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {hint && <Text style={styles.emptyHint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  errorText: { fontSize: 15, color: colors.danger, textAlign: 'center' },
  retry: { marginTop: 8, alignSelf: 'center', paddingHorizontal: 24 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.textSecondary, textAlign: 'center' },
  emptyHint: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
});
