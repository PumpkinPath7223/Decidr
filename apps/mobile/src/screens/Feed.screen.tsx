import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DecisionCard from '../components/DecisionCard';
import { useFeed } from '../hooks/useFeed';
import { type Post } from '../services/api.service';

export default function FeedScreen() {
  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useFeed();

  const posts = useMemo<Post[]>(() => {
    const flat = data?.pages.flatMap((p) => p.posts) ?? [];
    console.log(`[FeedScreen] rendering ${flat.length} posts, isLoading=${isLoading}, isError=${isError}`);
    return flat;
  }, [data, isLoading, isError]);

  const renderItem = useCallback(
    ({ item, index }: { item: Post; index: number }) => (
      <DecisionCard post={item} index={index} />
    ),
    []
  );

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Couldn't load the feed. Pull to retry.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerBar}>
        <Text style={styles.wordmark}>decidr</Text>
        <Text style={styles.tagline}>What's the verdict?</Text>
      </View>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#6366F1" />
        }
        ListFooterComponent={
          isFetchingNextPage ? <ActivityIndicator style={styles.footer} color="#6366F1" /> : null
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>No decisions yet. Be the first to post.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  headerBar: { paddingHorizontal: 20, paddingBottom: 8, paddingTop: 4 },
  wordmark: { fontSize: 26, fontWeight: '800', color: '#111827', letterSpacing: -0.5 },
  tagline: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  list: { paddingBottom: 32, paddingTop: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorText: { fontSize: 15, color: '#EF4444', textAlign: 'center' },
  emptyText: { fontSize: 15, color: '#9CA3AF', textAlign: 'center' },
  footer: { paddingVertical: 20 },
});
