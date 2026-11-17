import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CommentsSection from '../components/CommentsSection';
import ConfirmModal from '../components/ConfirmModal';
import FlagSheet from '../components/FlagSheet';
import HashtagRow from '../components/HashtagRow';
import OutcomePanel from '../components/OutcomePanel';
import PostVoting from '../components/PostVoting';
import RevealForm from '../components/RevealForm';
import { ErrorState, LoadingState } from '../components/ScreenState';
import StatusBadge from '../components/StatusBadge';
import { useDeletePost, usePost } from '../hooks/usePosts';
import { type RootStackParamList } from '../navigation/types';
import { errorMessage } from '../services/api.service';
import { useAuthStore } from '../store/auth.store';
import { cardShadow, colors } from '../theme';
import { type ContentTarget, type Post } from '../types';
import { formatTimeAgo } from '../utils/time';

type Props = NativeStackScreenProps<RootStackParamList, 'PostDetail'>;

function ownerNote(post: Post): string | null {
  if (!post.is_owner) return null;
  if (post.status === 'open') return "When the timer runs out you'll be asked what you chose and how it went.";
  if (post.status === 'unresolved') return 'This post closed without an outcome, so nobody was scored on it.';
  if (post.status === 'removed') return 'This post was removed after being reported.';
  return null;
}

export default function PostDetailScreen({ route, navigation }: Props) {
  const { postId } = route.params;
  const signedIn = useAuthStore((s) => s.token !== null);
  const { data: post, error, isLoading, isError, isRefetching, refetch } = usePost(postId);
  const deletePost = useDeletePost(postId);

  const [flagTarget, setFlagTarget] = useState<ContentTarget | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function goBack() {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Tabs');
  }

  function handleDelete() {
    deletePost.mutate(undefined, {
      onSuccess: () => {
        setConfirmingDelete(false);
        goBack();
      },
    });
  }

  // A post can only be deleted before anyone has voted on it.
  const canDelete = post?.is_owner === true && post.status === 'open' && post.result?.total_votes === 0;
  const note = post ? ownerNote(post) : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.bar}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back" onPress={goBack} hitSlop={12}>
          <Text style={styles.barAction}>‹ Back</Text>
        </TouchableOpacity>
        {post && !post.is_owner && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Report or block"
            onPress={() => setFlagTarget({ target_type: 'post', target_id: post.id })}
            hitSlop={12}
          >
            <Text style={styles.barMuted}>Report</Text>
          </TouchableOpacity>
        )}
        {canDelete && (
          <TouchableOpacity accessibilityRole="button" onPress={() => setConfirmingDelete(true)} hitSlop={12}>
            <Text style={styles.barDanger}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading && <LoadingState />}
      {isError && !post && <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />}

      {post && (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={colors.primary} />}
          >
            <View style={styles.card}>
              <StatusBadge post={post} />
              <Text style={styles.title}>{post.title}</Text>
              {post.context ? <Text style={styles.context}>{post.context}</Text> : null}
              <HashtagRow tags={post.category_tags} />
              <Text style={styles.posted}>
                Posted anonymously {formatTimeAgo(post.created_at)}
                {post.is_owner ? ' · by you' : ''}
              </Text>

              <PostVoting post={post} />
              <OutcomePanel post={post} />
              {note && <Text style={styles.note}>{note}</Text>}
              {post.can_reveal && <RevealForm post={post} />}

              <CommentsSection post={post} signedIn={signedIn} onFlag={setFlagTarget} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      <FlagSheet
        target={flagTarget}
        onClose={() => setFlagTarget(null)}
        onBlocked={(target) => {
          if (target.target_type === 'post') goBack();
        }}
      />
      <ConfirmModal
        visible={confirmingDelete}
        title="Delete this post?"
        message="Nobody has voted yet, so it can be removed completely. This can't be undone."
        confirmLabel="Delete"
        destructive
        loading={deletePost.isPending}
        error={deletePost.isError ? errorMessage(deletePost.error) : null}
        onConfirm={handleDelete}
        onCancel={() => {
          deletePost.reset();
          setConfirmingDelete(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10 },
  barAction: { fontSize: 16, fontWeight: '600', color: colors.primary },
  barMuted: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  barDanger: { fontSize: 14, fontWeight: '600', color: colors.danger },
  content: { paddingBottom: 40 },
  card: { backgroundColor: colors.card, borderRadius: 20, padding: 18, marginHorizontal: 16, marginTop: 4, ...cardShadow },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, lineHeight: 27, marginTop: 12 },
  context: { fontSize: 15, color: colors.textSecondary, lineHeight: 22, marginTop: 8 },
  posted: { fontSize: 12, color: colors.textMuted, marginTop: 10, marginBottom: 6 },
  note: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginTop: 14 },
});
