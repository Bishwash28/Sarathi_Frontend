import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

// Check if app is running in Expo Go sandbox (SDK 53+ removed remote push from Expo Go)
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let Notifications: typeof import('expo-notifications') | null = null;
let Device: typeof import('expo-device') | null = null;

if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
    Device = require('expo-device');
    if (Notifications && typeof Notifications.setNotificationHandler === 'function') {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    }
  } catch (err) {
    console.warn('[PushNotifications] Safe dynamic load notice:', err);
  }
}

/**
 * Register device for Push Notifications (FCM for Android / APNs for iOS)
 * Bypassed safely in Expo Go (SDK 53+ requirement), active in Dev Builds & Production.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (isExpoGo || !Notifications) {
    console.log('[PushNotification] Push registration safely bypassed in Expo Go sandbox.');
    return null;
  }

  let token: string | null = null;

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('sarathi_rides', {
        name: 'Sarathi Ride & Trip Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#DC2626',
        sound: 'default',
      }).catch(err => console.warn('[PushNotification] Android Channel error:', err));
    }

    if (Device && Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('[PushNotification] Permission not granted for Push Notifications');
        return null;
      }

      const tokenRes = await Notifications.getExpoPushTokenAsync().catch(() => null);
      if (tokenRes?.data) {
        token = tokenRes.data;
        console.log('[PushNotification] FCM/APNs Push Token generated:', token);
      }
    } else {
      console.log('[PushNotification] Running on simulator - system push banners fallback to local scheduling');
    }
  } catch (error) {
    console.warn('[PushNotification] Error in registration:', error);
  }

  return token;
}

/**
 * Triggers an immediate local Push Notification (FCM / APNs behavior)
 * Displays native system banner, plays sound, and vibrates.
 */
export async function sendLocalPushNotification({
  title,
  body,
  data = {},
}: {
  title: string;
  body: string;
  data?: Record<string, any>;
}): Promise<void> {
  if (isExpoGo || !Notifications) {
    console.log(`[Notification Alert] ${title}: ${body}`);
    return;
  }

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: 'default',
      },
      trigger: null, // deliver immediately
    });
  } catch (error) {
    console.warn('[PushNotification] Error scheduling push notification:', error);
  }
}
