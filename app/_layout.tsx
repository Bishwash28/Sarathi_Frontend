import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Platform } from 'react-native';
import { AppProvider } from '../context/AppContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import * as SystemUI from 'expo-system-ui';

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === 'android') {
      SystemUI.setBackgroundColorAsync(Colors.background);
    }
  }, []);

  return (
    <AppProvider>
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: Colors.background }}>
          <Stack screenOptions={{ contentStyle: { backgroundColor: Colors.background } }}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="role-selection" options={{ headerShown: false }} />
            <Stack.Screen name="kyc" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="ride-detail" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="booking-status" options={{ headerShown: false }} />
            <Stack.Screen name="active-trip" options={{ headerShown: false }} />
            <Stack.Screen name="chat-room" options={{ headerShown: false }} />
            <Stack.Screen name="driver-placeholder" options={{ headerShown: false }} />
          </Stack>
          <StatusBar style="dark" />
        </View>
      </SafeAreaProvider>
    </AppProvider>
  );
}
