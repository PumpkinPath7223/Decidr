import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import Button from './Button';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  loading?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

// Used instead of Alert.alert so confirmations behave the same on iOS, Android and web.
export default function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel,
  destructive = false,
  loading = false,
  error = null,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={loading ? undefined : onCancel}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          {error && <Text style={styles.error}>{error}</Text>}
          <View style={styles.actions}>
            <Button label="Cancel" variant="ghost" onPress={onCancel} disabled={loading} style={styles.action} />
            <Button
              label={confirmLabel}
              variant={destructive ? 'danger' : 'primary'}
              onPress={onConfirm}
              loading={loading}
              style={styles.action}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(17,24,39,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: { width: '100%', maxWidth: 400, backgroundColor: colors.card, borderRadius: 18, padding: 20, gap: 10 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  message: { fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  error: { fontSize: 13, color: colors.danger },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  action: { flex: 1 },
});
