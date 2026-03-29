import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { revealApi } from '../services/api.service';
import { useAuthStore } from '../store/auth.store';

type Props = { postId: string; onSuccess: () => void };

export default function RevealForm({ postId, onSuccess }: Props) {
  const token = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();

  const [outcomeText, setOutcomeText] = useState('');
  const [feeling, setFeeling] = useState<'happy' | 'regret' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: () => {
      if (!token) throw new Error('Not authenticated');
      if (!feeling) throw new Error('Select how you feel about the outcome');
      if (!outcomeText.trim()) throw new Error('Please describe what happened');
      return revealApi.submit(postId, outcomeText.trim(), feeling, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      onSuccess();
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Something went wrong'),
  });

  return (
    <View style={styles.container}>
      <Text style={styles.label}>What actually happened?</Text>
      <TextInput
        style={styles.input}
        placeholder="Describe the outcome..."
        placeholderTextColor="#9CA3AF"
        value={outcomeText}
        onChangeText={(t) => { setOutcomeText(t); setError(null); }}
        multiline
        numberOfLines={3}
      />

      <Text style={styles.label}>How do you feel about it?</Text>
      <View style={styles.feelingRow}>
        {(['happy', 'regret'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.feelingBtn, feeling === f && styles.feelingBtnSelected]}
            onPress={() => { setFeeling(f); setError(null); }}
            activeOpacity={0.75}
          >
            <Text style={[styles.feelingEmoji]}>{f === 'happy' ? '😊' : '😬'}</Text>
            <Text style={[styles.feelingText, feeling === f && styles.feelingTextSelected]}>
              {f === 'happy' ? 'Happy' : 'Regret'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity
        style={[styles.submitBtn, isPending && styles.submitBtnDisabled]}
        onPress={() => mutate()}
        disabled={isPending}
        activeOpacity={0.8}
      >
        {isPending
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={styles.submitText}>Submit Outcome</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 14, padding: 14, backgroundColor: '#F9FAFB', borderRadius: 12, gap: 8 },
  label: { fontSize: 12, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, fontSize: 14, color: '#111827', backgroundColor: '#fff', minHeight: 72, textAlignVertical: 'top' },
  feelingRow: { flexDirection: 'row', gap: 10 },
  feelingBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10, borderRadius: 10, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  feelingBtnSelected: { borderColor: '#6366F1', backgroundColor: '#EEF2FF' },
  feelingEmoji: { fontSize: 18 },
  feelingText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  feelingTextSelected: { color: '#6366F1' },
  error: { fontSize: 12, color: '#EF4444' },
  submitBtn: { backgroundColor: '#6366F1', borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginTop: 2 },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
