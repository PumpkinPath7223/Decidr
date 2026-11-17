import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useBlock, useReport } from '../hooks/useSafety';
import { errorMessage } from '../services/api.service';
import { colors } from '../theme';
import { type ContentTarget } from '../types';
import Button from './Button';

const REASONS = ['Harassment or hate', 'Spam or scam', 'Sexual content', 'Self-harm or danger', 'Something else'];

type Props = {
  /** The post or comment being flagged; null hides the sheet. */
  target: ContentTarget | null;
  onClose: () => void;
  /** Called after the author has been blocked, so the screen can leave a now-hidden post. */
  onBlocked?: (target: ContentTarget) => void;
};

/** Report a post or comment, or block whoever wrote it. */
export default function FlagSheet({ target, onClose, onBlocked }: Props) {
  const report = useReport();
  const block = useBlock();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (target) {
      setMessage(null);
      setError(null);
    }
  }, [target]);

  const busy = report.isPending || block.isPending;
  const noun = target?.target_type === 'comment' ? 'comment' : 'post';

  function sendReport(reason: string) {
    if (!target) return;
    setError(null);
    report.mutate(
      { target, reason },
      {
        onSuccess: () => setMessage("Thanks — we'll take a look. You can also block this person below."),
        onError: (err) => setError(errorMessage(err)),
      }
    );
  }

  function blockAuthor() {
    if (!target) return;
    setError(null);
    block.mutate(target, {
      onSuccess: () => {
        onClose();
        onBlocked?.(target);
      },
      onError: (err) => setError(errorMessage(err)),
    });
  }

  return (
    <Modal visible={target !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={busy ? undefined : onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>Report this {noun}</Text>
          {message ? (
            <Text style={styles.message}>{message}</Text>
          ) : (
            REASONS.map((reason) => (
              <TouchableOpacity
                key={reason}
                accessibilityRole="button"
                style={styles.reason}
                onPress={() => sendReport(reason)}
                disabled={busy}
                activeOpacity={0.7}
              >
                <Text style={styles.reasonText}>{reason}</Text>
              </TouchableOpacity>
            ))
          )}
          {error && <Text style={styles.error}>{error}</Text>}
          <Button
            label={`Block whoever wrote this ${noun}`}
            variant="danger"
            onPress={blockAuthor}
            loading={block.isPending}
            disabled={report.isPending}
            style={styles.block}
          />
          <Text style={styles.hint}>Blocking hides everything they post from you. They are not told.</Text>
          <Button label="Close" variant="ghost" onPress={onClose} disabled={busy} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(17,24,39,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 28, gap: 8 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 4 },
  message: { fontSize: 14, lineHeight: 20, color: colors.textSecondary, paddingVertical: 8 },
  reason: { paddingVertical: 13, paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.bg },
  reasonText: { fontSize: 15, color: colors.text },
  error: { fontSize: 13, color: colors.danger },
  block: { marginTop: 8 },
  hint: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
});
