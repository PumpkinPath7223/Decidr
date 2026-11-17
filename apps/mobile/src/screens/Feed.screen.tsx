import { useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DecisionCard from '../components/DecisionCard';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenState';
import TagFilter from '../components/TagFilter';
import { flattenPages } from '../hooks/postCache';
import { useFeed } from '../hooks/usePosts';
import { type RootStackParamList } from '../navigation/types';
import { errorMessage } from '../services/api.service';
import { colors } from '../theme';
import { type Category, type Post } from '../types';

export default function FeedScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [tag, setTag] = useState<Category | null>(null);
  const { data, error, isLoading, isError, isRefetching, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useFeed(tag);
  const [pulling, setPulling] = useState(false);

  const posts = useMemo(() => flattenPages(data), [data]);

  const openPost = useCallback((postId: string) => navigation.navigate('PostDetail', { postId }), [navigation]);
  const renderItem = useCallback(({ item }: { item: Post }) => <DecisionCard post={item} onOpen={openPost} />, [openPost]);

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const onRefresh = useCallback(async () => {
    setPulling(true);
    try {
      await refetch();
    } finally {
      setPulling(false);
    }
  }, [refetch]);

  let body: React.ReactNode;
  if (isLoading) {
    body = <LoadingState />;
  } else if (isError && posts.length === 0) {
    body = <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />;
  } else {
    body = (
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={pulling && isRefetching} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListFooterComponent={isFetchingNextPage ? <ActivityIndicator style={styles.footer} color={colors.primary} /> : null}
        ListEmptyComponent={
          <EmptyState
            title={tag ? `No #${tag} decisions yet` : 'No decisions yet'}
            hint="Be the first — tap Ask to post one."
          />
        }
      />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerBar}>
        <Text style={styles.wordmark}>decidr</Text>
        <Text style={styles.tagline}>What's the verdict?</Text>
      </View>
      <TagFilter value={tag} onChange={setTag} />
      {body}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  headerBar: { paddingHorizontal: 20, paddingBottom: 4, paddingTop: 4 },
  wordmark: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  tagline: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  list: { paddingBottom: 32, paddingTop: 4, flexGrow: 1 },
  footer: { paddingVertical: 20 },
});
