import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { type Post } from '../types';

type Props = { post: Post; compact?: boolean };

/** What the poster did, how they feel about it, and whether this viewer called it. */
export default function OutcomePanel({ post, compact = false }: Props) {
  const outcome = post.outcome;
  if (!outcome) return null;

  const happy = outcome.poster_feeling === 'happy';
  const chosenText = outcome.chosen_option === 'A' ? post.option_a : post.option_b;

  const headline = post.is_owner
    ? `You chose ${outcome.chosen_option} and ${happy ? "you're happy with it" : 'you regret it'}`
    : `They chose ${outcome.chosen_option} and ${happy ? "they're happy with it" : 'they regret it'}`;

  let verdict: { text: string; good: boolean } | null = null;
  if (outcome.my_is_correct === true) verdict = { text: 'You called it  +5', good: true };
  else if (outcome.my_is_correct === false) verdict = { text: "You didn't call this one", good: false };

  return (
    <View style={[styles.panel, happy ? styles.happy : styles.regret]}>
      <Text style={styles.headline}>
        {happy ? '😊' : '😬'} {headline}
      </Text>
      {!compact && <Text style={styles.chosen}>“{chosenText}”</Text>}
      {outcome.outcome_text ? (
        <Text style={styles.story} numberOfLines={compact ? 2 : undefined}>
          {outcome.outcome_text}
        </Text>
      ) : null}
      {verdict && (
        <Text style={[styles.verdict, { color: verdict.good ? colors.success : colors.textSecondary }]}>
          {verdict.good ? '✓ ' : ''}
          {verdict.text}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { marginTop: 14, padding: 12, borderRadius: 12, gap: 6 },
  happy: { backgroundColor: colors.successLight },
  regret: { backgroundColor: colors.warningLight },
  headline: { fontSize: 14, fontWeight: '700', color: colors.text },
  chosen: { fontSize: 13, color: colors.textSecondary, fontStyle: 'italic' },
  story: { fontSize: 14, lineHeight: 20, color: colors.text },
  verdict: { fontSize: 13, fontWeight: '700' },
});
