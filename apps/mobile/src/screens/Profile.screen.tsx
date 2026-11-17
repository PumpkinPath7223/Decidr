import { useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AccountActions from '../components/AccountActions';
import PostRow from '../components/PostRow';
import ProfileHeader from '../components/ProfileHeader';
import { EmptyState, ErrorState, LoadingState } from '../components/ScreenState';
import SegmentedControl from '../components/SegmentedControl';
import { flattenPages } from '../hooks/postCache';
import { useMyPosts, useMyVotes } from '../hooks/usePosts';
import { useProfile } from '../hooks/useProfile';
import { type RootStackParamList } from '../navigation/types';
import { errorMessage } from '../services/api.service';
import { colors } from '../theme';
import { type Post } from '../types';

type Section = 'votes' | 'posts';

const SECTIONS = [
  { value: 'votes', label: 'My votes' },
  { value: 'posts', label: 'My posts' },
] as const;

export default function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [section, setSection] = useState<Section>('votes');
  const [pulling, setPulling] = useState(false);

  const profile = useProfile();
  const votes = useMyVotes();
  const posts = useMyPosts();
  const list = section === 'votes' ? votes : posts;

  const items = useMemo(() => flattenPages(list.data), [list.data]);
  const openPost = useCallback((postId: string) => navigation.navigate('PostDetail', { postId }), [navigation]);
  const renderItem = useCallback(({ item }: { item: Post }) => <PostRow post={item} onOpen={openPost} />, [openPost]);

  const { refetch: refetchProfile } = profile;
  const { refetch: refetchList, hasNextPage, isFetchingNextPage, fetchNextPage } = list;

  const onRefresh = useCallback(async () => {
    setPulling(true);
    try {
      await Promise.all([refetchProfile(), refetchList()]);
    } finally {
      setPulling(false);
    }
  }, [refetchProfile, refetchList]);

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (profile.isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <LoadingState />
      </SafeAreaView>
    );
  }
  if (!profile.data) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ErrorState message={errorMessage(profile.error)} onRetry={() => void profile.refetch()} />
        <AccountActions />
      </SafeAreaView>
    );
  }

  let empty: React.ReactNode;
  if (list.isLoading) empty = <ActivityIndicator color={colors.primary} style={styles.loader} />;
  else if (list.isError) empty = <ErrorState message={errorMessage(list.error)} onRetry={() => void list.refetch()} />;
  else if (section === 'votes') empty = <EmptyState title="No votes yet" hint="Vote on a decision in the feed to start building your accuracy." />;
  else empty = <EmptyState title="No posts yet" hint="Stuck on something? Tap Ask and let the crowd weigh in." />;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View>
            <ProfileHeader profile={profile.data} />
            <View style={styles.segments}>
              <SegmentedControl options={SECTIONS} value={section} onChange={setSection} />
            </View>
          </View>
        }
        ListEmptyComponent={<View style={styles.empty}>{empty}</View>}
        ListFooterComponent={
          <View>
            {isFetchingNextPage && <ActivityIndicator color={colors.primary} style={styles.loader} />}
            <AccountActions />
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list: { paddingBottom: 40 },
  segments: { marginHorizontal: 16, marginTop: 16, marginBottom: 8 },
  empty: { minHeight: 140 },
  loader: { paddingVertical: 20 },
});
