import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import LoginScreen from '../screens/Login.screen';
import FeedScreen from '../screens/Feed.screen';
import { usersApi } from '../services/api.service';
import { useAuthStore } from '../store/auth.store';
import { useVotesStore } from '../store/votes.store';

export type RootStackParamList = {
  Login: undefined;
  Feed: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { hydrated, hydrate, token, user } = useAuthStore();
  const votesHydrate = useVotesStore((s) => s.hydrate);
  const preloadVotes = useVotesStore((s) => s.preloadVotes);

  // Hydrate both stores in parallel on startup.
  useEffect(() => {
    hydrate();
    votesHydrate();
  }, []);

  // Once auth is known and the user is logged in, fetch their server-side votes
  // and merge them into the store so already-voted posts start locked.
  useEffect(() => {
    if (!hydrated || !token || !user) return;
    usersApi.getMyVotes(user.id, token)
      .then(preloadVotes)
      .catch(() => {}); // non-critical — AsyncStorage store is the primary source
  }, [hydrated, token, user?.id]);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' }}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {token ? (
          <Stack.Screen name="Feed" component={FeedScreen} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
