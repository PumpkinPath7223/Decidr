import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useVote } from '../hooks/usePosts';
import { errorMessage } from '../services/api.service';
import { colors } from '../theme';
import { type Choice, type Post } from '../types';
import OptionRow from './OptionRow';
import ResultBar from './ResultBar';

function noteFor(post: Post, label: Choice): string | null {
  if (!post.outcome) return null;
  const chosen = post.outcome.chosen_option === label;
  const right = post.outcome.correct_side === label;
  const who = post.is_owner ? 'You' : 'They';
  if (chosen && right) return `${who} chose this · the right call`;
  if (chosen) return `${who} chose this`;
  if (right) return 'In hindsight, the right call';
  return null;
}

function statusLine(post: Post): string | null {
  if (post.is_owner) {
    if (post.status === 'open') return 'Your post · only you can see the split until the reveal';
    return null;
  }
  if (post.status === 'open') {
    if (post.my_choice) return post.is_live_crisis ? 'Vote locked in' : 'Vote locked in · the split stays hidden until the reveal';
    if (!post.can_vote) return null;
    return post.is_live_crisis ? 'Tap an option to vote' : 'Tap an option to vote · results are hidden until the reveal';
  }
  if (post.status === 'awaiting_outcome') {
    return post.my_choice
      ? "Voting closed · you'll be notified when the outcome is in"
      : 'Voting closed · waiting for the outcome';
  }
  return null;
}

/** The two options, the vote interaction, and the split when this viewer may see it. */
export default function PostVoting({ post }: { post: Post }) {
  const { mutate: castVote, isPending } = useVote(post.id);
  const [error, setError] = useState<string | null>(null);

  const locked = !post.can_vote || isPending;
  const line = statusLine(post);

  function handleVote(choice: Choice) {
    if (locked) return;
    setError(null);
    castVote(choice, { onError: (err) => setError(errorMessage(err)) });
  }

  return (
    <View>
      {(['A', 'B'] as const).map((label) => (
        <OptionRow
          key={label}
          label={label}
          text={label === 'A' ? post.option_a : post.option_b}
          selected={post.my_choice === label}
          dimmed={post.my_choice !== null && post.my_choice !== label}
          locked={locked}
          note={noteFor(post, label)}
          onPress={() => handleVote(label)}
        />
      ))}

      {post.result && (
        <ResultBar result={post.result} myChoice={post.my_choice} live={post.is_live_crisis && post.status === 'open'} />
      )}
      {error ? <Text style={styles.error}>{error}</Text> : line ? <Text style={styles.line}>{line}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  line: { fontSize: 12, color: colors.textMuted, marginTop: 10 },
  error: { fontSize: 12, color: colors.danger, marginTop: 10 },
});
