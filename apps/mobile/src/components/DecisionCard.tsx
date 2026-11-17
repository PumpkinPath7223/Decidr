import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { cardShadow, colors } from '../theme';
import { type Post } from '../types';
import HashtagRow from './HashtagRow';
import OutcomePanel from './OutcomePanel';
import PostVoting from './PostVoting';
import StatusBadge from './StatusBadge';

type Props = { post: Post; onOpen: (postId: string) => void };

function footerLabel(post: Post): string {
  if (post.can_reveal) return 'Tell everyone how it went →';
  if (!post.comments_enabled) return 'Open →';
  if (post.comment_count === 0) return 'Discuss →';
  return `${post.comment_count} comment${post.comment_count === 1 ? '' : 's'} →`;
}

function DecisionCard({ post, onOpen }: Props) {
  return (
    <View style={styles.card}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open post: ${post.title}`} onPress={() => onOpen(post.id)}>
        <StatusBadge post={post} />
        <Text style={styles.title} numberOfLines={4}>
          {post.title}
        </Text>
        {post.context ? (
          <Text style={styles.context} numberOfLines={3}>
            {post.context}
          </Text>
        ) : null}
        <HashtagRow tags={post.category_tags} />
      </Pressable>

      <View style={styles.options}>
        <PostVoting post={post} />
      </View>
      <OutcomePanel post={post} compact />

      <Pressable accessibilityRole="button" onPress={() => onOpen(post.id)} style={styles.footer} hitSlop={8}>
        <Text style={[styles.footerText, post.can_reveal && styles.footerCta]}>{footerLabel(post)}</Text>
      </Pressable>
    </View>
  );
}

export default React.memo(DecisionCard);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 18,
    marginHorizontal: 16,
    marginVertical: 8,
    ...cardShadow,
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.text, lineHeight: 24, marginTop: 10 },
  context: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginTop: 6 },
  options: { marginTop: 4 },
  footer: { marginTop: 14, alignSelf: 'flex-start' },
  footerText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  footerCta: { color: colors.primary },
});
