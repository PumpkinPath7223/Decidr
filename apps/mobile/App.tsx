import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import { ApiError } from './src/services/api.service';
import { useAuthStore } from './src/store/auth.store';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Retrying a 4xx never helps; retry network and server errors twice.
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return failureCount < 2;
      },
    },
  },
});

export default function App() {
  // Cached responses are personalised (your vote, your posts). Drop them whenever the
  // session ends so the next account starts clean.
  useEffect(() => {
    return useAuthStore.subscribe((state, previous) => {
      if (previous.token !== null && state.token === null) queryClient.clear();
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
