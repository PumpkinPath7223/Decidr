import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect, useRef } from 'react';
import { Text } from 'react-native';
import { LoadingState } from '../components/ScreenState';
import CreatePostScreen from '../screens/CreatePost.screen';
import FeedScreen from '../screens/Feed.screen';
import LoginScreen from '../screens/Login.screen';
import PostDetailScreen from '../screens/PostDetail.screen';
import ProfileScreen from '../screens/Profile.screen';
import RanksScreen from '../screens/Ranks.screen';
import { onNotificationOpened, registerForPush } from '../services/notifications.service';
import { useAuthStore } from '../store/auth.store';
import { colors } from '../theme';
import { type RootStackParamList, type TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

const TAB_ICONS: Record<keyof TabParamList, string> = {
  Feed: '🗳️',
  Create: '➕',
  Ranks: '🏆',
  Profile: '👤',
};

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ focused }) => (
          <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.55 }}>{TAB_ICONS[route.name]}</Text>
        ),
      })}
    >
      <Tab.Screen name="Feed" component={FeedScreen} />
      <Tab.Screen name="Create" component={CreatePostScreen} options={{ title: 'Ask' }} />
      <Tab.Screen name="Ranks" component={RanksScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const hydrate = useAuthStore((s) => s.hydrate);
  const signedIn = useAuthStore((s) => s.token !== null);
  const pendingPostId = useRef<string | null>(null);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // Once signed in: register this device for reveal notifications and open the post
  // when one is tapped.
  useEffect(() => {
    if (!hydrated || !signedIn) return;
    void registerForPush();
    return onNotificationOpened((postId) => {
      if (navigationRef.isReady()) navigationRef.navigate('PostDetail', { postId });
      // Launched from the notification: the navigator is not mounted yet.
      else pendingPostId.current = postId;
    });
  }, [hydrated, signedIn]);

  function openPendingPost() {
    const postId = pendingPostId.current;
    pendingPostId.current = null;
    if (postId && useAuthStore.getState().token !== null) {
      navigationRef.navigate('PostDetail', { postId });
    }
  }

  if (!hydrated) return <LoadingState />;

  // Which screens exist depends on the session, so signing in or out switches stacks
  // automatically — screens never navigate to "Login" or "Tabs" by hand.
  return (
    <NavigationContainer ref={navigationRef} onReady={openPendingPost}>
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        {signedIn ? (
          <>
            <Stack.Screen name="Tabs" component={Tabs} />
            <Stack.Screen name="PostDetail" component={PostDetailScreen} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
