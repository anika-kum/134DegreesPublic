// Root layout: initializes the Zustand store from AsyncStorage on mount,
// then guards routing — unauthenticated users are always redirected to the
// welcome screen; authenticated users are sent to the tabs.
// Uses React Native's built-in StatusBar instead of expo-status-bar to avoid
// config plugin errors with Expo SDK 54.

import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'react-native';
import { useUserStore } from '../store/userStore';

export default function RootLayout() {
  const { user, isLoading, loadFromStorage } = useUserStore();
  const segments = useSegments();
  const router = useRouter();

  // Restore session from AsyncStorage once on mount
  useEffect(() => {
    loadFromStorage();
  }, []);

  // Re-evaluate redirect whenever auth state or route segment changes.
  // isLoading guard prevents a premature redirect before storage resolves.
  useEffect(() => {
    if (isLoading) return;
    const inAuth = segments[0] === '(auth)';
    if (!user && !inAuth) {
      router.replace('/(auth)/welcome');
    } else if (user && inAuth) {
      // `as any` required — expo-router's static type generation doesn't cover
      // the catch-all index route at build time
      router.replace('/(tabs)/' as any);
    }
  }, [user, isLoading, segments]);

  return (
    <>
      <StatusBar barStyle="light-content" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="project/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="bill/[id]" options={{ presentation: 'card' }} />
      </Stack>
    </>
  );
}
