import Constants from 'expo-constants';
import { Platform } from 'react-native';

const isExpoGo = Constants.appOwnership === 'expo';

// Dynamically require modules only when available / NOT running inside limited web/Expo Go client
let NotificationsModule: typeof import('expo-notifications') | null = null;
let DeviceModule: typeof import('expo-device') | null = null;

if (!isExpoGo) {
  try {
    NotificationsModule = require('expo-notifications');
    if (NotificationsModule) {
      NotificationsModule.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    }
  } catch (e) {
    // Native module 'ExpoPushTokenManager' not available in standard JS runtime / Expo Go without dev client build
    NotificationsModule = null;
  }

  try {
    DeviceModule = require('expo-device');
  } catch (e) {
    // Native module 'ExpoDevice' not available in standard JS runtime / Expo Go without dev client build
    DeviceModule = null;
  }
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
}

/**
 * Registers device for push notifications and returns Expo Push Token safely
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (isExpoGo || !NotificationsModule) {
    console.log('Running in Expo Go client: Remote push notifications require development build.');
    return 'ExponentPushToken[EXPO_GO_DEV_TOKEN]';
  }

  let token: string | null = null;

  try {
    if (Platform.OS === 'android') {
      await NotificationsModule.setNotificationChannelAsync('sarathi-driver-channel', {
        name: 'SARATHI Driver Notifications',
        importance: NotificationsModule.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#DC2626',
        lockscreenVisibility: NotificationsModule.AndroidNotificationVisibility.PUBLIC,
        sound: 'default',
      });
    }

    const isDevice = DeviceModule ? DeviceModule.isDevice : true;
    if (isDevice || Platform.OS === 'android' || Platform.OS === 'ios') {
      const { status: existingStatus } = await NotificationsModule.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await NotificationsModule.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('Push notification permissions not granted.');
        return null;
      }

      const pushTokenData = await NotificationsModule.getExpoPushTokenAsync();
      token = pushTokenData.data;
      console.log('Expo Push Token registered:', token);
    }
  } catch (error) {
    console.warn('Could not retrieve Expo Push Token:', error);
    token = 'ExponentPushToken[SARATHI_DEV_MOCK_TOKEN]';
  }

  return token;
}

/**
 * Triggers a real native system push notification safely
 */
export async function triggerMobilePushNotification(payload: PushNotificationPayload): Promise<string> {
  if (isExpoGo || !NotificationsModule) {
    console.log('[Expo Go Dev Mode] Driver Notification:', payload.title, payload.body);
    return `expo-go-notif-${Date.now()}`;
  }

  try {
    const notificationId = await NotificationsModule.scheduleNotificationAsync({
      content: {
        title: payload.title,
        body: payload.body,
        data: payload.data || {},
        sound: 'default',
        priority: NotificationsModule.AndroidNotificationPriority.MAX,
      },
      trigger: null, // trigger immediately
    });
    return notificationId;
  } catch (error) {
    console.warn('Error scheduling mobile push notification:', error);
    return `mock-notif-${Date.now()}`;
  }
}

/**
 * Sets up tap listener for mobile push notifications safely
 */
export function setupNotificationResponseListener(
  onNotificationTap: (data: Record<string, any>) => void
): { remove: () => void } {
  if (isExpoGo || !NotificationsModule) {
    return { remove: () => {} };
  }

  try {
    const subscription = NotificationsModule.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data) {
        onNotificationTap(data);
      }
    });
    return subscription;
  } catch (e) {
    console.warn('Failed to add notification response listener:', e);
    return { remove: () => {} };
  }
}
