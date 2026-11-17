import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { cardShadow, colors } from '../theme';
import { type Post } from '../types';
import StatusBadge from './StatusBadge';

type Props = { post: Post; onOpen: (postId: string) => void };

function summary(post: Post): { text: string; color: string } | null {
  if (post.is_owner) {
    if (post.can_reveal) return { text: 'Tap to report the outcome', color: colors.primary };
    if (post.result) {
      const votes = post.result.total_votes;
      return { text: `${votes} vote${votes === 1 ? '' : 's'}`, color: colors.textSecondary };
    }
    return null;
  }
  if (!post.my_choice) return null;
  const correct = post.outcome?.my_is_correct;
  if (correct === true) return { text: `You voted ${post.my_choice} · called it ✓`, color: colors.success };
  if (correct === false) return { text: `You voted ${post.my_choice} · missed`, color: colors.textSecondary };
  return { text: `You voted ${post.my_choice}`, color: colors.textSecondary };
}

/** Compact post line for the profile lists. */
function PostRow({ post, onOpen }: Props) {
  const line = summary(post);
  return (
    <Pressable accessibilityRole="button" onPress={() => onOpen(post.id)} style={styles.row}>
      <StatusBadge post={post} />
      <Text style={styles.title} numberOfLines={2}>
        {post.title}
      </Text>
      {line && (
        <View>
          <Text style={[styles.summary, { color: line.color }]}>{line.text}</Text>
        </View>
      )}
    </Pressable>
  );
}

export default React.memo(PostRow);

const styles = StyleSheet.create({
  row: { backgroundColor: colors.card, borderRadius: 14, padding: 14, marginHorizontal: 16, marginVertical: 5, gap: 8, ...cardShadow },
  title: { fontSize: 15, fontWeight: '600', color: colors.text, lineHeight: 21 },
  summary: { fontSize: 12, fontWeight: '600' },
});
