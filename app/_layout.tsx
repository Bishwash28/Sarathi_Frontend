import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { AppProvider } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import * as SystemUI from 'expo-system-ui';
import OfflineScreen from '../components/OfflineScreen';

export default function RootLayout() {
  const isOffline = false;

  useEffect(() => {
    if (Platform.OS === 'android') {
      SystemUI.setBackgroundColorAsync(Colors.background);
    }

    // Handle deep links (e.g. password recovery link from email)
    const subscription = Linking.addEventListener('url', async (event) => {
      const url = event.url;
      if (url && (url.includes('type=recovery') || url.includes('reset-password') || url.includes('access_token'))) {
        const hash = url.includes('#') ? url.split('#')[1] : url.split('?')[1];
        if (hash) {
          const params = new URLSearchParams(hash);
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          if (accessToken && refreshToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
          }
        }
        router.push('/(auth)/reset-password');
      }
    });

    return () => subscription.remove();
  }, []);

  return (
    <AppProvider>
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: Colors.background }}>
          {isOffline ? (
            <OfflineScreen />
          ) : (
            <Stack screenOptions={{ contentStyle: { backgroundColor: Colors.background } }}>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="kyc" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="search-ride" options={{ headerShown: false }} />
              <Stack.Screen name="ride-detail" options={{ presentation: 'modal', headerShown: false }} />
              <Stack.Screen name="booking-status" options={{ headerShown: false }} />
              <Stack.Screen name="active-trip" options={{ headerShown: false }} />
              <Stack.Screen name="chat-room" options={{ headerShown: false }} />
              <Stack.Screen name="driver-placeholder" options={{ headerShown: false }} />
              <Stack.Screen name="vehicles" options={{ headerShown: false }} />
              <Stack.Screen name="reset-password" options={{ headerShown: false }} />
            </Stack>
          )}
          <StatusBar style="dark" />
        </View>
      </SafeAreaProvider>
    </AppProvider>
  );
}
