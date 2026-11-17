import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAddComment, useComments } from '../hooks/useComments';
import { errorMessage } from '../services/api.service';
import { colors } from '../theme';
import { type Comment, type ContentTarget, type Post } from '../types';
import { formatTimeAgo } from '../utils/time';
import Button from './Button';
import RankBadge from './RankBadge';

const MAX_COMMENT = 500;

type Props = { post: Post; signedIn: boolean; onFlag: (target: ContentTarget) => void };

function CommentItem({ comment, onFlag }: { comment: Comment; onFlag: (target: ContentTarget) => void }) {
  const accuracy = comment.accuracy === null ? 'Calibrating' : `${Math.round(comment.accuracy)}% accurate`;
  return (
    <View style={styles.comment}>
      <View style={styles.meta}>
        <Text style={styles.username}>{comment.username}</Text>
        <RankBadge rank={comment.rank} />
        <Text style={styles.metaText}>voted {comment.voter_choice}</Text>
        <Text style={styles.metaText}>· {accuracy}</Text>
      </View>
      <Text style={styles.body}>{comment.body}</Text>
      <View style={styles.meta}>
        <Text style={styles.time}>{formatTimeAgo(comment.created_at)}</Text>
        {!comment.is_mine && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Report or block this comment"
            onPress={() => onFlag({ target_type: 'comment', target_id: comment.id })}
            hitSlop={10}
          >
            <Text style={styles.flag}>Report</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function composerHint(post: Post, signedIn: boolean): string | null {
  if (!signedIn) return 'Sign in and vote to join the discussion.';
  if (post.is_owner) return 'Only voters can comment on a post.';
  if (!post.my_choice) {
    return post.status === 'open' ? 'Vote to join the discussion.' : 'Only people who voted can comment.';
  }
  return null;
}

export default function CommentsSection({ post, signedIn, onFlag }: Props) {
  const { data: comments, isLoading, isError, refetch } = useComments(post.id, post.comments_enabled);
  const { mutate: addComment, isPending } = useAddComment(post.id);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!post.comments_enabled) {
    return <Text style={styles.note}>The poster turned comments off for this decision.</Text>;
  }

  const hint = composerHint(post, signedIn);

  function submit() {
    const body = draft.trim();
    if (!body) return;
    setError(null);
    addComment(body, {
      onSuccess: () => setDraft(''),
      onError: (err) => setError(errorMessage(err)),
    });
  }

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>Discussion</Text>

      {isLoading && <ActivityIndicator color={colors.primary} style={styles.loader} />}
      {isError && (
        <TouchableOpacity onPress={() => void refetch()}>
          <Text style={styles.error}>Couldn't load comments. Tap to retry.</Text>
        </TouchableOpacity>
      )}
      {comments && comments.length === 0 && <Text style={styles.note}>No comments yet.</Text>}
      {comments?.map((comment) => <CommentItem key={comment.id} comment={comment} onFlag={onFlag} />)}

      {hint ? (
        <Text style={styles.note}>{hint}</Text>
      ) : (
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder={`Why did you pick ${post.my_choice}?`}
            placeholderTextColor={colors.textMuted}
            value={draft}
            onChangeText={setDraft}
            maxLength={MAX_COMMENT}
            multiline
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <Button label="Post comment" variant="secondary" onPress={submit} loading={isPending} disabled={!draft.trim()} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 22, gap: 10 },
  heading: { fontSize: 15, fontWeight: '700', color: colors.text },
  loader: { alignSelf: 'flex-start' },
  comment: { backgroundColor: colors.bg, borderRadius: 12, padding: 12, gap: 6 },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  username: { fontSize: 13, fontWeight: '700', color: colors.text },
  metaText: { fontSize: 12, color: colors.textSecondary },
  body: { fontSize: 14, lineHeight: 20, color: colors.text },
  time: { fontSize: 11, color: colors.textMuted, flex: 1 },
  flag: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  note: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  error: { fontSize: 13, color: colors.danger },
  composer: { gap: 8, marginTop: 4 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, fontSize: 14, color: colors.text, backgroundColor: colors.card, minHeight: 64, textAlignVertical: 'top' },
});
