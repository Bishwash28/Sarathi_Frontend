import { Alert, Linking, Platform } from 'react-native';

/**
 * Clean and format phone numbers for tel: URL scheme
 */
const formatPhoneNumber = (phone: string): string => {
  // Retain leading '+' if present, remove all non-digits
  const hasPlus = phone.startsWith('+');
  const cleaned = phone.replace(/\D/g, '');
  return hasPlus ? `+${cleaned}` : cleaned;
};

/**
 * Opens the native device phone dialer with the phone number pre-filled.
 * Does NOT place the call automatically; user manually presses the dial button.
 *
 * @param rawPhoneNumber - The phone number string to populate into dialer
 */
export const makePhoneCall = async (rawPhoneNumber?: string | null): Promise<void> => {
  console.log('[makePhoneCall] Received rawPhoneNumber:', rawPhoneNumber);

  if (!rawPhoneNumber || !rawPhoneNumber.trim()) {
    Alert.alert('Phone Call Error', 'No phone number parameter passed to makePhoneCall.');
    return;
  }

  const cleanedNumber = formatPhoneNumber(rawPhoneNumber);
  if (!cleanedNumber) {
    Alert.alert('Phone Call Error', `Invalid number format: "${rawPhoneNumber}"`);
    return;
  }

  const telUrl = `tel:${cleanedNumber}`;
  console.log('[makePhoneCall] Opening URL:', telUrl);

  try {
    if (Platform.OS === 'web') {
      window.location.href = telUrl;
    } else {
      await Linking.openURL(telUrl);
    }
  } catch (error: any) {
    console.warn('[makePhoneCall] Failed to open URL:', error);
    Alert.alert(
      'Dialer Launch Failed',
      `Error opening dialer for ${cleanedNumber}: ${error?.message || error}`
    );
  }
};

