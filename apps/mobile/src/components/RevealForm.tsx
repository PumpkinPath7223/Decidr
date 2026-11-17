import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useReveal } from '../hooks/usePosts';
import { errorMessage } from '../services/api.service';
import { colors } from '../theme';
import { type Choice, type Feeling, type Post } from '../types';
import Button from './Button';

const MAX_STORY = 1000;

const FEELINGS: { value: Feeling; emoji: string; label: string }[] = [
  { value: 'happy', emoji: '😊', label: 'Happy with it' },
  { value: 'regret', emoji: '😬', label: 'Regret it' },
];

/** The author's reveal: which option they went with, how they feel, and an optional story. */
export default function RevealForm({ post }: { post: Post }) {
  const { mutate, isPending } = useReveal(post.id);
  const [chosen, setChosen] = useState<Choice | null>(null);
  const [feeling, setFeeling] = useState<Feeling | null>(null);
  const [story, setStory] = useState('');
  const [error, setError] = useState<string | null>(null);

  const ready = chosen !== null && feeling !== null;

  function submit() {
    if (!chosen || !feeling) return;
    setError(null);
    mutate(
      { chosen_option: chosen, poster_feeling: feeling, outcome_text: story.trim() || undefined },
      { onError: (err) => setError(errorMessage(err)) }
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Time's up — how did it go?</Text>
      <Text style={styles.hint}>Voters are scored on this, and it can't be changed afterwards.</Text>

      <Text style={styles.label}>Which did you go with?</Text>
      {(['A', 'B'] as const).map((option) => (
        <TouchableOpacity
          key={option}
          accessibilityRole="radio"
          accessibilityLabel={`I went with option ${option}: ${option === 'A' ? post.option_a : post.option_b}`}
          accessibilityState={{ selected: chosen === option }}
          style={[styles.choice, chosen === option && styles.choiceSelected]}
          onPress={() => setChosen(option)}
          activeOpacity={0.8}
        >
          <Text style={[styles.choiceLetter, chosen === option && styles.selectedText]}>{option}</Text>
          <Text style={[styles.choiceText, chosen === option && styles.selectedText]} numberOfLines={2}>
            {option === 'A' ? post.option_a : post.option_b}
          </Text>
        </TouchableOpacity>
      ))}

      <Text style={styles.label}>How do you feel about it?</Text>
      <View style={styles.feelingRow}>
        {FEELINGS.map((item) => (
          <TouchableOpacity
            key={item.value}
            accessibilityRole="radio"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: feeling === item.value }}
            style={[styles.feeling, feeling === item.value && styles.choiceSelected]}
            onPress={() => setFeeling(item.value)}
            activeOpacity={0.8}
          >
            <Text style={styles.emoji}>{item.emoji}</Text>
            <Text style={[styles.feelingText, feeling === item.value && styles.selectedText]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>What happened? (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="Tell the story..."
        placeholderTextColor={colors.textMuted}
        value={story}
        onChangeText={setStory}
        maxLength={MAX_STORY}
        multiline
      />

      {error && <Text style={styles.error}>{error}</Text>}
      <Button label="Reveal the outcome" onPress={submit} loading={isPending} disabled={!ready} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 16, padding: 14, backgroundColor: colors.bg, borderRadius: 14, gap: 8, borderWidth: 1, borderColor: colors.border },
  heading: { fontSize: 16, fontWeight: '700', color: colors.text },
  hint: { fontSize: 12, color: colors.textSecondary },
  label: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 6 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  choiceSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  choiceLetter: { fontSize: 14, fontWeight: '800', color: colors.textSecondary, width: 16 },
  choiceText: { flex: 1, fontSize: 14, color: colors.text },
  selectedText: { color: colors.primary, fontWeight: '600' },
  feelingRow: { flexDirection: 'row', gap: 10 },
  feeling: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 11, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  emoji: { fontSize: 18 },
  feelingText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, fontSize: 14, color: colors.text, backgroundColor: colors.card, minHeight: 80, textAlignVertical: 'top' },
  error: { fontSize: 13, color: colors.danger },
});
