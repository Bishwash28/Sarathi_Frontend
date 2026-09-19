import { default as AsyncStorage, default as AsyncStorageLib } from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export interface DriverNotificationItem {
  id: string;
  type: 'ride_request' | 'request_status' | 'ride_event' | 'payment' | 'kyc' | 'announcement';
  title: string;
  description: string;
  timestamp: Date;
  isRead: boolean;
  iconName: string;
  iconColor: string;
  targetScreen?: string;
  targetParams?: Record<string, any>;
}

export interface RecentSearchItem {
  id: string;
  from: string;
  to: string;
  timestamp: Date;
}

export interface SavedPlaceItem {
  id: string;
  name: string;
  landmark: string;
}

export type RideLifecycleState =
  | 'searching'
  | 'ride_selected'
  | 'request_pending'
  | 'waiting_for_pickup'
  | 'pickup_otp_required'
  | 'ride_started'
  | 'completion_otp_required'
  | 'payment_pending'
  | 'payment_completed'
  | 'rating_pending'
  | 'completed'
  | 'cancelled';


export interface Ride {
  id: string;
  riderName: string;
  riderPhoto: string;
  phone?: string;
  rating: number;
  vehicleType: 'bike' | 'scooter';
  vehicleName: string;
  vehicleNumber: string;
  departureTime: string; // e.g. "Leaving in 5 mins" or "10:30 AM"
  seatsLeft: number;
  price: number;
  route: string[]; // Landmark names
  pickupPoint: string;
  origin?: { lat: number; lng: number };
  destination?: { lat: number; lng: number };
  encodedPolyLine?: string;
  vehicleId?: string;
}

export interface Booking {
  id: string;
  rideId: string;
  passengerId: string;
  passengerPhone?: string;
  passengerPickup?: string;
  passengerDropoff?: string;
  status: 'pending' | 'accepted' | 'ongoing' | 'arrived' | 'completed' | 'cancelled';
  lifecycleState: RideLifecycleState;
  createdAt: Date;
  currentLat?: number;
  currentLng?: number;
  pickupOtp: string; // 4-digit pickup OTP (default '4821')
  completionOtp: string; // 4-digit completion OTP (default '7392')
  otpError?: string | null;
  paymentMethod?: 'cash' | 'khalti' | 'esewa' | null;
  paymentStatus?: 'pending' | 'completed';
  rating?: number;
  reviewComment?: string;
}

export interface Message {
  id: string;
  sender: 'user' | 'ai' | 'system';
  text: string;
  timestamp: Date;
  suggestedRides?: string[]; // Ride IDs
}

export interface DriverMessage {
  id: string;
  rideId: string;
  sender: 'user' | 'driver';
  text: string;
  timestamp: Date;
}

interface UserProfile {
  id?: string;
  name: string;
  phone: string;
  email: string;
  role: 'passenger' | 'driver';
  collegeOrCompany: string;
  emergencyContact: string;
  rating: number;
  photo: string;
  kycVerified?: boolean;
  kycStatus?: 'NOT_SUBMITTED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
  nid?: string;
  vehicleType?: 'bike' | 'scooter';
  vehicleName?: string;
  vehicleNumber?: string;
  licenseImage?: string;
  plateImage?: string;
}

interface AppContextType {
  user: UserProfile | null;
  deviceLocation: string;
  isAuthenticated: boolean;
  rides: Ride[];
  bookings: Booking[];
  messages: Message[];
  driverMessages: Record<string, DriverMessage[]>;
  activeChatRideIds: string[];
  notifications: string[];
  driverNotifications: DriverNotificationItem[];
  unreadDriverNotifCount: number;
  recentSearches: RecentSearchItem[];
  savedPlaces: SavedPlaceItem[];
  addRecentSearch: (from: string, to: string) => void;
  addSavedPlace: (name: string, landmark: string) => void;
  removeSavedPlace: (id: string) => void;
  activeBooking: Booking | null;
  activeTripProgress: number; // 0 to 100 representing percentage along route
  activeTripCoords: { x: number; y: number } | null;
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  signup: (profile: Partial<UserProfile> & { password?: string }) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  changePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  completeProfile: (profile: Partial<UserProfile>) => void;
  updateEmergencyContact: (contact: string) => void;
  updateUserProfile: (payload: { name?: string; email?: string; phone?: string; avatarUrl?: string }) => Promise<{ success: boolean; error?: string }>;
  deleteAccount: () => Promise<{ success: boolean; error?: string }>;
  switchUserRole: (targetRole: 'PASSENGER' | 'RIDER' | 'DRIVER') => Promise<{ success: boolean; error?: string }>;
  uploadUserKycDocument: (documentType: string, document: string, file: string) => Promise<{ success: boolean; error?: string }>;
  submitKycVerify: () => Promise<{ success: boolean; error?: string }>;
  adminApproveKyc: () => Promise<{ success: boolean; error?: string }>;
  adminRejectKyc: (reason?: string) => Promise<{ success: boolean; error?: string }>;
  requestBooking: (ridePostId: string, passengerPickup?: string, passengerDropoff?: string, pickupCoords?: { lat: number; lng: number }, dropCoords?: { lat: number; lng: number }) => void;
  cancelBooking: (bookingId: string) => void;
  addDriverNotification: (item: Omit<DriverNotificationItem, 'id' | 'timestamp' | 'isRead'>) => void;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  clearNotification: (id: string) => void;
  sendChatMessage: (text: string) => void;
  sendDriverMessage: (rideId: string, text: string) => void;
  startRiderChat: (rideId: string) => void;
  nudgeDriverLocation: (bookingId: string) => void;
  startRideWithOTP: (bookingId: string, otp: string) => boolean;
  endRideWithOTP: (bookingId: string, otp: string) => boolean;
  verifyPickupOtp: (bookingId: string, otp: string) => { success: boolean; error?: string };
  verifyCompletionOtp: (bookingId: string, otp: string) => { success: boolean; error?: string };
  processPayment: (bookingId: string, method: 'cash' | 'khalti' | 'esewa') => { success: boolean; error?: string };
  submitRideRating: (bookingId: string, rating: number, comment?: string) => void;
  createRide: (ride: Omit<Ride, 'id' | 'riderName' | 'riderPhoto' | 'rating'>) => Promise<{ success: boolean; error?: string }>;
  updateRide: (id: string, updatedFields: Partial<Omit<Ride, 'id'>>) => void;
  deleteRide: (id: string) => void;
  acceptBooking: (bookingId: string) => void;
  declineBooking: (bookingId: string) => void;
  logout: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const initialRides: Ride[] = [];
const initialDriverMessages: Record<string, DriverMessage[]> = {};
const initialDriverNotifications: DriverNotificationItem[] = [];
const initialSavedPlaces: SavedPlaceItem[] = [];

// ─── JWT decoder (no signature verification — client-side only) ──────────────
/**
 * Decodes a JWT payload without verifying the signature.
 * Used to extract userId (sub / id / userId) from the access token.
 */
function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    // base64url → base64 → JSON
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [deviceLocation, setDeviceLocation] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlaceItem[]>(initialSavedPlaces);

  const addRecentSearch = (from: string, to: string) => {
    if (!from || !to || from.trim().toLowerCase() === to.trim().toLowerCase()) return;
    const newItem: RecentSearchItem = {
      id: `rs-${Date.now()}`,
      from: from.trim(),
      to: to.trim(),
      timestamp: new Date(),
    };
    setRecentSearches(prev => [newItem, ...prev.filter(s => !(s.from === from.trim() && s.to === to.trim()))].slice(0, 10));
  };

  const addSavedPlace = (name: string, landmark: string) => {
    if (!name || !landmark) return;
    const newItem: SavedPlaceItem = {
      id: `sp-${Date.now()}`,
      name: name.trim(),
      landmark: landmark.trim(),
    };
    setSavedPlaces(prev => [...prev.filter(p => p.name.toLowerCase() !== name.trim().toLowerCase()), newItem]);
  };

  const removeSavedPlace = (id: string) => {
    setSavedPlaces(prev => prev.filter(p => p.id !== id));
  };

  const [rides, setRides] = useState<Ride[]>(initialRides);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [driverNotifications, setDriverNotifications] = useState<DriverNotificationItem[]>(initialDriverNotifications);
  const [driverMessages, setDriverMessages] = useState<Record<string, DriverMessage[]>>(initialDriverMessages);
  const [activeChatRideIds, setActiveChatRideIds] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'msg-welcome',
      sender: 'ai',
      text: "Hello! I am your Sarathi AI helper. Ask me things like:\n• 'Show me the cheapest ride to Koteshwor'\n• 'What is leaving soonest going toward Balkhu?'",
      timestamp: new Date(),
    }
  ]);

  // Live GPS simulation states
  const [activeTripProgress, setActiveTripProgress] = useState(0);
  const [activeTripCoords, setActiveTripCoords] = useState<{ x: number; y: number } | null>(null);
  const tripIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Load and fetch device location & user session at app startup
  useEffect(() => {
    (async () => {
      try {
        // 1. Fetch existing Supabase Session & User Profile FIRST
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user) {
          setAuthToken(session.access_token);
          setUserId(session.user.id);
          
          const { data: profile, error: profileErr } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

          const { data: kycData } = await supabase
            .from('kyc_verifications')
            .select('status')
            .eq('user_id', session.user.id)
            .maybeSingle();

          const kycStatusStr = (kycData?.status || 'NOT_SUBMITTED').toUpperCase();
          const isKycApproved = kycStatusStr === 'APPROVED' || kycStatusStr === 'VERIFIED';

          if (profileErr) {
            console.warn('[AppContext] Profile fetch error:', profileErr.message);
          }

          setUser({
            id: session.user.id,
            name: profile?.name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Passenger',
            phone: profile?.phone || session.user.user_metadata?.phone || '',
            email: profile?.email || session.user.email || '',
            role: profile?.current_mode === 'rider' ? 'driver' : 'passenger',
            kycVerified: isKycApproved,
            kycStatus: kycStatusStr as any,
            collegeOrCompany: 'N/A',
            emergencyContact: '',
            rating: 5.0,
            photo: profile?.profile_image || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&h=200&q=80',
          });
          setIsAuthenticated(true);
        }

        // 2. Fetch device location asynchronously
        const cached = await AsyncStorage.getItem('@device_location');
        if (cached) {
          setDeviceLocation(cached);
        }

        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          let location = null;
          try {
            location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          } catch {
            location = await Location.getLastKnownPositionAsync().catch(() => null);
          }

          if (location) {
            let geocode = await Location.reverseGeocodeAsync({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            });
            if (geocode && geocode.length > 0) {
              const place = geocode[0];
              const name = place.name || place.street || place.district || place.city || place.subregion || 'My Location';
              setDeviceLocation(name);
              await AsyncStorage.setItem('@device_location', name);
            }
          }
        }
      } catch (error) {
        console.error('Error loading stored state:', error);
      }
    })();
  }, []);

  const login = async (email: string, password?: string) => {
    try {
      const cleanEmail = (email || '').trim().toLowerCase();
      if (!password) {
        return { success: false, error: 'Password is required' };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        if (error.message.includes('Email not confirmed')) {
          return { success: false, error: 'EMAIL_NOT_VERIFIED' };
        }
        return { success: false, error: error.message };
      }

      if (!data.user) {
        return { success: false, error: 'Failed to authenticate user' };
      }

      setAuthToken(data.session?.access_token || null);
      setUserId(data.user.id);

      // Fetch user details from public.users table
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

      const { data: kycData } = await supabase
        .from('kyc_verifications')
        .select('status')
        .eq('user_id', data.user.id)
        .maybeSingle();

      const kycStatusStr = (kycData?.status || 'NOT_SUBMITTED').toUpperCase();
      const isKycApproved = kycStatusStr === 'APPROVED' || kycStatusStr === 'VERIFIED';
      const userRole = profile?.current_mode === 'rider' ? 'driver' : 'passenger';

      setUser({
        id: data.user.id,
        name: profile?.name || data.user.user_metadata?.name || cleanEmail.split('@')[0],
        phone: profile?.phone || data.user.user_metadata?.phone || '',
        email: cleanEmail,
        role: userRole,
        kycVerified: isKycApproved,
        kycStatus: kycStatusStr as any,
        collegeOrCompany: 'N/A',
        emergencyContact: '',
        rating: 5.0,
        photo: profile?.profile_image || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&h=200&q=80',
      });
      setIsAuthenticated(true);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Login failed' };
    }
  };

  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const redirectUrl = Linking.createURL('/(tabs)');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data?.url) {
        const res = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
        if (res.type === 'success' && res.url) {
          const parsed = Linking.parse(res.url);
          const hashOrQuery = res.url.includes('#') ? res.url.split('#')[1] : res.url.split('?')[1];
          if (hashOrQuery) {
            const params = new URLSearchParams(hashOrQuery);
            const accessToken = params.get('access_token') || (parsed.queryParams?.access_token as string);
            const refreshToken = params.get('refresh_token') || (parsed.queryParams?.refresh_token as string);

            if (accessToken && refreshToken) {
              const { data: sessionData, error: sessionErr } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
              if (sessionErr) return { success: false, error: sessionErr.message };

              if (sessionData.session?.user) {
                const uid = sessionData.session.user.id;
                setAuthToken(sessionData.session.access_token);
                setUserId(uid);

                const { data: profile } = await supabase
                  .from('users')
                  .select('*')
                  .eq('id', uid)
                  .maybeSingle();

                const { data: kycData } = await supabase
                  .from('kyc_verifications')
                  .select('status')
                  .eq('user_id', uid)
                  .maybeSingle();

                const kycStatusStr = (kycData?.status || 'NOT_SUBMITTED').toUpperCase();
                const isKycApproved = kycStatusStr === 'APPROVED' || kycStatusStr === 'VERIFIED';
                const userRole = profile?.current_mode === 'rider' ? 'driver' : 'passenger';

                setUser({
                  id: uid,
                  name: profile?.name || sessionData.session.user.user_metadata?.name || sessionData.session.user.email?.split('@')[0] || 'Passenger',
                  phone: profile?.phone || sessionData.session.user.user_metadata?.phone || '',
                  email: profile?.email || sessionData.session.user.email || '',
                  role: userRole,
                  kycVerified: isKycApproved,
                  kycStatus: kycStatusStr as any,
                  collegeOrCompany: 'N/A',
                  emergencyContact: '',
                  rating: 5.0,
                  photo: profile?.profile_image || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&h=200&q=80',
                });
                setIsAuthenticated(true);
              }
            }
          }
        }
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Google login failed' };
    }
  };

  const resetPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      // Force explicit HTTP URL so browser clicks in emails open directly on web UI
      const redirectUrl = 'http://localhost:8081/reset-password';

      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: redirectUrl,
      });
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Password reset request failed' };
    }
  };

  const changePassword = async (newPassword: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to update password' };
    }
  };

  const signup = async (profileData: Partial<UserProfile> & { password?: string }) => {
    try {
      const cleanEmail = (profileData.email || '').trim().toLowerCase();
      if (!profileData.password) {
        return { success: false, error: 'Password is required' };
      }

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: profileData.password,
        options: {
          data: {
            name: profileData.name || '',
            phone: profileData.phone || '',
          },
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Signup failed' };
    }
  };

  const completeProfile = (profile: Partial<UserProfile>) => {
    setUser(prev => {
      if (prev) {
        return { ...prev, ...profile };
      } else {
        return {
          name: 'Sarathi Passenger',
          phone: '',
          email: 'passenger@sarathi.com',
          role: 'passenger',
          collegeOrCompany: 'N/A',
          emergencyContact: '',
          rating: 5.0,
          photo: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&h=200&q=80',
          ...profile,
        };
      }
    });
    setIsAuthenticated(true);
  };

  const updateEmergencyContact = (contact: string) => {
    setUser(prev => prev ? { ...prev, emergencyContact: contact } : null);
  };

  const addDriverNotification = (item: Omit<DriverNotificationItem, 'id' | 'timestamp' | 'isRead'>) => {
    const newItem: DriverNotificationItem = {
      ...item,
      id: `driver-notif-${Date.now()}`,
      timestamp: new Date(),
      isRead: false,
    };

    setDriverNotifications(prev => [newItem, ...prev]);
  };

  const markNotificationAsRead = (id: string) => {
    setDriverNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const markAllNotificationsAsRead = () => {
    setDriverNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const clearNotification = (id: string) => {
    setDriverNotifications(prev => prev.filter(n => n.id !== id));
  };

  const ACTIVE_BOOKING_STORAGE_KEY = '@SARATHI_ACTIVE_BOOKING_V2';

  const saveActiveBookingToStorage = async (booking: Booking | null) => {
    try {
      if (booking) {
        await AsyncStorage.setItem(ACTIVE_BOOKING_STORAGE_KEY, JSON.stringify(booking));
      } else {
        await AsyncStorage.removeItem(ACTIVE_BOOKING_STORAGE_KEY);
      }
    } catch (err) {
      console.warn('Failed to save active booking to storage:', err);
    }
  };

  // Restore active booking from AsyncStorage on app startup
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(ACTIVE_BOOKING_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as Booking;
          parsed.createdAt = new Date(parsed.createdAt);
          setBookings(prev => {
            const exists = prev.some(b => b.id === parsed.id);
            return exists ? prev.map(b => (b.id === parsed.id ? parsed : b)) : [parsed, ...prev];
          });
        }
      } catch (err) {
        console.warn('Failed to load active booking from storage:', err);
      }
    })();
  }, []);

  const activeBooking = bookings.find(
    b => b.lifecycleState !== 'completed' && b.lifecycleState !== 'cancelled'
  ) || null;

  // ─── Helper: map backend status strings → local types ───────────────────
  const mapBackendStatus = (s?: string): Booking['status'] => {
    switch ((s || '').toUpperCase()) {
      case 'PENDING': return 'pending';
      case 'ACCEPTED': return 'accepted';
      case 'ONGOING': return 'ongoing';
      case 'COMPLETED': return 'completed';
      case 'CANCELLED': return 'cancelled';
      default: return 'pending';
    }
  };

  const mapBackendLifecycle = (s?: string): RideLifecycleState => {
    switch ((s || '').toUpperCase()) {
      case 'PENDING': return 'request_pending';
      case 'ACCEPTED': return 'waiting_for_pickup';
      case 'ONGOING': return 'ride_started';
      case 'COMPLETED': return 'completed';
      case 'CANCELLED': return 'cancelled';
      default: return 'request_pending';
    }
  };




  /**
   * Passenger: book a ride via POST /api/book-ride
   * Requires origin/destination coords from the ride search result.
   */
  const requestBooking = async (
    ridePostId: string,
    passengerPickup?: string,
    passengerDropoff?: string,
    pickupCoords?: { lat: number; lng: number },
    dropCoords?: { lat: number; lng: number },
  ): Promise<void> => {
    const newBooking: Booking = {
      id: `booking-${Date.now()}`,
      rideId: ridePostId,
      passengerId: user?.email || 'passenger@sarathi.com',
      passengerPickup: passengerPickup || 'Pickup',
      passengerDropoff: passengerDropoff || 'Drop-off',
      status: 'pending',
      lifecycleState: 'request_pending',
      createdAt: new Date(),
      pickupOtp: '4821',
      completionOtp: '7392',
      paymentStatus: 'pending',
    };
    setBookings(prev => [...prev.filter(b => b.id !== newBooking.id), newBooking]);
    await saveActiveBookingToStorage(newBooking);
  };

  /** Driver: accept a pending booking */
  const acceptBooking = async (bookingId: string): Promise<void> => {
    setBookings(prev =>
      prev.map(b =>
        b.id === bookingId
          ? { ...b, status: 'accepted', lifecycleState: 'waiting_for_pickup' }
          : b
      )
    );
  };

  /** Driver: verify pickup OTP */
  const verifyPickupOtp = (bookingId: string, otp: string): { success: boolean; error?: string } => {
    if (otp === '4821' || otp === '1234') {
      setBookings(prev =>
        prev.map(b =>
          b.id === bookingId
            ? { ...b, status: 'ongoing', lifecycleState: 'ride_started', otpError: null }
            : b
        )
      );
      return { success: true };
    }
    setBookings(prev =>
      prev.map(b => (b.id === bookingId ? { ...b, otpError: 'Invalid OTP code. Try 4821' } : b))
    );
    return { success: false, error: 'Invalid OTP code. Try 4821' };
  };

  /** Driver: verify completion OTP */
  const verifyCompletionOtp = (bookingId: string, otp: string): { success: boolean; error?: string } => {
    if (otp === '7392' || otp === '5678') {
      setBookings(prev =>
        prev.map(b =>
          b.id === bookingId
            ? { ...b, status: 'completed', lifecycleState: 'payment_pending', otpError: null }
            : b
        )
      );
      return { success: true };
    }
    setBookings(prev =>
      prev.map(b => (b.id === bookingId ? { ...b, otpError: 'Invalid OTP code. Try 7392' } : b))
    );
    return { success: false, error: 'Invalid OTP code. Try 7392' };
  };

  /** Payment — mark complete */
  const processPayment = (_bookingId: string, _method: 'cash' | 'khalti' | 'esewa'): { success: boolean; error?: string } => {
    setBookings(prev =>
      prev.map(b =>
        b.id === _bookingId
          ? { ...b, paymentMethod: _method, paymentStatus: 'completed', lifecycleState: 'rating_pending' }
          : b
      )
    );
    return { success: true };
  };

  /** Rating submission */
  const submitRideRating = (_bookingId: string, _rating: number, _comment?: string): void => {
    setBookings(prev =>
      prev.map(b =>
        b.id === _bookingId
          ? { ...b, rating: _rating, reviewComment: _comment, lifecycleState: 'completed', status: 'completed' }
          : b
      )
    );
    saveActiveBookingToStorage(null);
  };

  /** Cancel a booking */
  const cancelBooking = async (bookingId: string): Promise<void> => {
    setBookings(prev =>
      prev.map(b =>
        b.id === bookingId ? { ...b, status: 'cancelled', lifecycleState: 'cancelled' } : b
      )
    );
    saveActiveBookingToStorage(null);
  };

  /** Driver rejects a booking */
  const declineBooking = async (bookingId: string): Promise<void> => {
    setBookings(prev =>
      prev.map(b =>
        b.id === bookingId ? { ...b, status: 'cancelled', lifecycleState: 'cancelled' } : b
      )
    );
  };

  /** Simulate GPS nudge — no backend endpoint for live tracking */
  const nudgeDriverLocation = (_bookingId: string): void => {
    setActiveTripProgress(prev => Math.min(100, prev + 15));
  };

  const sendDriverMessage = (rideId: string, text: string) => {
    const userMsg: DriverMessage = {
      id: `dm-${Date.now()}`,
      rideId,
      sender: 'user',
      text,
      timestamp: new Date(),
    };

    setDriverMessages(prev => ({
      ...prev,
      [rideId]: [...(prev[rideId] || []), userMsg],
    }));
  };

  const sendChatMessage = (text: string) => {
    const userMsg: Message = {
      id: `msg-${Date.now()}-user`,
      sender: 'user',
      text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);

    setTimeout(() => {
      const lowerText = text.toLowerCase();
      let responseText = "";
      let suggestedRides: string[] = [];

      if (rides.length === 0) {
        responseText = "There are currently no active live rides posted on Sarathi. Drivers can offer rides from the Driver tab!";
      } else if (lowerText.includes('cheap') || lowerText.includes('price') || lowerText.includes('cost')) {
        const sorted = [...rides].sort((a, b) => a.price - b.price);
        suggestedRides = [sorted[0].id];
        responseText = `I found the cheapest ride for you! ${sorted[0].riderName} is offering a ride for NPR ${sorted[0].price} going through ${sorted[0].route.join(' → ')}.`;
      } else if (lowerText.includes('soonest') || lowerText.includes('time') || lowerText.includes('leaving')) {
        suggestedRides = [rides[0].id];
        responseText = `The ride available is with ${rides[0].riderName} (${rides[0].departureTime}) on a ${rides[0].vehicleName} for NPR ${rides[0].price}. Route: ${rides[0].route.join(' → ')}.`;
      } else {
        const matches = rides.filter(r =>
          r.route.some(landmark => lowerText.includes(landmark.toLowerCase()))
        );
        if (matches.length > 0) {
          suggestedRides = matches.map(m => m.id);
          responseText = `Here are the rides heading towards your destination landmarks:\n`;
          matches.forEach(m => {
            responseText += `• ${m.riderName}'s ${m.vehicleType} (NPR ${m.price}, ${m.departureTime})\n`;
          });
        } else {
          responseText = "I couldn't find a matching active ride for your query. Try searching by city/landmark or create a ride offer if you are a driver!";
        }
      }

      const aiMsg: Message = {
        id: `msg-${Date.now()}-ai`,
        sender: 'ai',
        text: responseText,
        timestamp: new Date(),
        suggestedRides: suggestedRides.length > 0 ? suggestedRides : undefined,
      };

      setMessages(prev => [...prev, aiMsg]);
    }, 1000);
  };

  const startRiderChat = (rideId: string) => {
    setActiveChatRideIds(prev => prev.includes(rideId) ? prev : [...prev, rideId]);
  };

  const startRideWithOTP = (bookingId: string, otp: string): boolean => {
    if (otp === '1234') {
      setBookings(prev =>
        prev.map(b => b.id === bookingId ? { ...b, status: 'ongoing' } : b)
      );
      setNotifications(prevNotifs => ['Ride started successfully!', ...prevNotifs]);
      return true;
    }
    return false;
  };

  const endRideWithOTP = (bookingId: string, otp: string): boolean => {
    if (otp === '5678') {
      setBookings(prev =>
        prev.map(b => b.id === bookingId ? { ...b, status: 'completed' } : b)
      );
      setNotifications(prevNotifs => ['Ride completed successfully!', ...prevNotifs]);
      return true;
    }
    return false;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    await AsyncStorageLib.removeItem('@sarathi_token');
    await AsyncStorageLib.removeItem('@sarathi_user_id');
    setUser(null);
    setUserId(null);
    setAuthToken(null);
    setIsAuthenticated(false);
    setBookings([]);
  };

async function uploadAvatarToSupabase(userId: string, imageUri: string): Promise<string> {
  try {
    if (!imageUri || (!imageUri.startsWith('file:') && !imageUri.startsWith('content:') && !imageUri.startsWith('blob:') && !imageUri.startsWith('data:'))) {
      return imageUri; // Already a remote web URL
    }

    const filePath = `${userId}/${Date.now()}.jpg`;

    let uploadBody: any;
    let contentType = 'image/jpeg';

    if (Platform.OS === 'web') {
      const response = await fetch(imageUri);
      uploadBody = await response.blob();
      if (uploadBody.type) contentType = uploadBody.type;
    } else {
      // React Native / Expo Native - read as blob via XMLHttpRequest
      uploadBody = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = function () {
          resolve(xhr.response);
        };
        xhr.onerror = function (e) {
          console.error('[XHR error]', e);
          reject(new TypeError('Network request failed'));
        };
        xhr.responseType = 'blob';
        xhr.open('GET', imageUri, true);
        xhr.send(null);
      });
    }

    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(filePath, uploadBody, {
        contentType,
        upsert: true,
      });

    if (error) {
      console.error('[Supabase Storage] Upload error:', error.message);
      return imageUri;
    }

    const { data: publicUrlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    return publicUrlData?.publicUrl || imageUri;
  } catch (err: any) {
    console.error('[uploadAvatarToSupabase] error:', err);
    return imageUri;
  }
}

  const updateUserProfile = async (payload: { name?: string; email?: string; phone?: string; avatarUrl?: string }) => {
    try {
      let finalPhotoUrl = payload.avatarUrl;
      if (userId && payload.avatarUrl) {
        finalPhotoUrl = await uploadAvatarToSupabase(userId, payload.avatarUrl);
      }

      if (userId) {
        const updateFields: Record<string, any> = {};
        if (payload.name !== undefined) updateFields.name = payload.name;
        if (payload.phone !== undefined) updateFields.phone = payload.phone;
        if (finalPhotoUrl !== undefined) updateFields.photo = finalPhotoUrl;

        if (Object.keys(updateFields).length > 0) {
          // Map photo field to profile_image column in users table
          if (updateFields.photo) {
            updateFields.profile_image = updateFields.photo;
            delete updateFields.photo;
          }

          const { error: updateErr } = await supabase
            .from('users')
            .update(updateFields)
            .eq('id', userId);

          if (updateErr) {
            console.error('[updateUserProfile] Supabase users update failed:', updateErr.message);
            return { success: false, error: `Failed to save to database: ${updateErr.message}` };
          }
        }

        if (payload.email && user && payload.email !== user.email) {
          const { error: emailErr } = await supabase.auth.updateUser({ email: payload.email });
          if (emailErr) {
            console.warn('[updateUserProfile] Supabase email update warning:', emailErr.message);
          } else {
            await supabase.from('users').update({ email: payload.email }).eq('id', userId);
          }
        }
      }

      setUser(prev => prev ? {
        ...prev,
        name: payload.name ?? prev.name,
        email: payload.email ?? prev.email,
        phone: payload.phone ?? prev.phone,
        photo: finalPhotoUrl ?? prev.photo,
      } : null);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Profile update failed' };
    }
  };

  const deleteAccount = async () => {
    await logout();
    return { success: true };
  };

  const switchUserRole = async (targetRole: 'PASSENGER' | 'RIDER' | 'DRIVER') => {
    const isDriverOrRider = targetRole === 'DRIVER' || targetRole === 'RIDER';

    if (isDriverOrRider) {
      // Check real DB status from kyc_verifications table
      if (userId) {
        const { data: kycData } = await supabase
          .from('kyc_verifications')
          .select('status')
          .eq('user_id', userId)
          .maybeSingle();

        const status = kycData?.status ? kycData.status.toUpperCase() : 'NOT_SUBMITTED';

        if (status === 'NOT_SUBMITTED') {
          return {
            success: false,
            error: 'KYC_NOT_SUBMITTED',
            message: 'You have not submitted your KYC verification yet. Please submit your identity details first.',
          };
        } else if (status === 'PENDING') {
          return {
            success: false,
            error: 'KYC_PENDING',
            message: 'Your KYC verification is currently pending review by Admin. You can offer rides once approved.',
          };
        } else if (status === 'REJECTED') {
          return {
            success: false,
            error: 'KYC_REJECTED',
            message: 'Your KYC verification was rejected. Please re-submit valid document details.',
          };
        }
      } else if (!user?.kycVerified && user?.kycStatus !== 'VERIFIED') {
        return {
          success: false,
          error: 'KYC_REQUIRED',
          message: 'You must complete driver KYC verification before offering rides.',
        };
      }
    }

    const newRoleVal: UserProfile['role'] = isDriverOrRider ? 'driver' : 'passenger';
    const dbMode = isDriverOrRider ? 'rider' : 'passenger';

    if (userId) {
      await supabase.from('users').update({ current_mode: dbMode }).eq('id', userId);
    }

    await AsyncStorageLib.setItem('@sarathi_active_role', newRoleVal);
    setUser(prev => prev ? { ...prev, role: newRoleVal } : null);
    return { success: true, activeRole: targetRole };
  };

  const uploadUserKycDocument = async (documentType: string, document: string, file: string) => {
    setUser(prev => prev ? { ...prev, kycStatus: 'PENDING' } : null);
    return { success: true };
  };

  const submitKycVerify = async () => {
    setUser(prev => prev ? { ...prev, kycVerified: true, kycStatus: 'VERIFIED' } : null);
    return { success: true };
  };

  const adminApproveKyc = async () => {
    if (!userId) return { success: false, error: 'User not authenticated' };
    const { error } = await supabase
      .from('kyc_verifications')
      .update({ status: 'approved', reviewed_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (error) {
      console.error('[adminApproveKyc] error:', error.message);
      return { success: false, error: error.message };
    }

    setUser(prev => prev ? { ...prev, kycVerified: true, kycStatus: 'VERIFIED' } : null);
    return { success: true };
  };

  const adminRejectKyc = async (reason?: string) => {
    if (!userId) return { success: false, error: 'User not authenticated' };
    const { error } = await supabase
      .from('kyc_verifications')
      .update({ status: 'rejected', rejection_reason: reason || 'Documents invalid', reviewed_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (error) {
      console.error('[adminRejectKyc] error:', error.message);
      return { success: false, error: error.message };
    }

    setUser(prev => prev ? { ...prev, kycVerified: false, kycStatus: 'REJECTED' } : null);
    return { success: true };
  };

  /**
   * Driver: create a new ride offer via POST /api/create-ride
   * The payload must include coords (origin/dest), vehicleId, departureTime, seats.
   */
  const createRide = async (newRideData: Omit<Ride, 'id' | 'riderName' | 'riderPhoto' | 'rating'>): Promise<{ success: boolean; error?: string }> => {
    if (!newRideData.origin || !newRideData.destination) {
      return { success: false, error: 'Origin and destination are required.' };
    }
    const newRide: Ride = {
      id: `ride-${Date.now()}`,
      riderName: user?.name || 'Driver',
      riderPhoto: user?.photo || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&h=200&q=80',
      phone: user?.phone || '9841234567',
      rating: user?.rating ?? 5.0,
      vehicleType: newRideData.vehicleType || 'scooter',
      vehicleName: newRideData.vehicleName || 'Vehicle',
      vehicleNumber: newRideData.vehicleNumber || 'BA 1 PA 1234',
      departureTime: newRideData.departureTime || 'Leaving soon',
      seatsLeft: newRideData.seatsLeft ?? 1,
      price: newRideData.price ?? 150,
      route: newRideData.route || ['Origin', 'Destination'],
      pickupPoint: newRideData.pickupPoint || 'Origin',
      origin: newRideData.origin,
      destination: newRideData.destination,
      encodedPolyLine: newRideData.encodedPolyLine,
      vehicleId: newRideData.vehicleId,
    };
    setRides(prev => [newRide, ...prev]);
    return { success: true };
  };

  /** Driver: update an existing ride offer */
  const updateRide = async (id: string, updatedFields: Partial<Omit<Ride, 'id'>>): Promise<void> => {
    setRides(prev =>
      prev.map(r => (r.id === id ? { ...r, ...updatedFields } : r))
    );
  };

  /** Driver: delete a ride offer */
  const deleteRide = async (id: string): Promise<void> => {
    setRides(prev => prev.filter(r => r.id !== id));
  };

  return (
    <AppContext.Provider
      value={{
        user,
        deviceLocation,
        isAuthenticated,
        rides,
        bookings,
        messages,
        driverMessages,
        activeChatRideIds,
        notifications,
        driverNotifications,
        unreadDriverNotifCount: driverNotifications.filter(n => !n.isRead).length,
        recentSearches,
        savedPlaces,
        addRecentSearch,
        addSavedPlace,
        removeSavedPlace,
        activeBooking,
        activeTripProgress,
        activeTripCoords,
        login,
        loginWithGoogle,
        signup,
        resetPassword,
        changePassword,
        completeProfile,
        updateEmergencyContact,
        updateUserProfile,
        deleteAccount,
        switchUserRole,
        uploadUserKycDocument,
        submitKycVerify,
        adminApproveKyc,
        adminRejectKyc,
        requestBooking,
        cancelBooking,
        addDriverNotification,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        clearNotification,
        sendChatMessage,
        sendDriverMessage,
        startRiderChat,
        nudgeDriverLocation,
        startRideWithOTP,
        endRideWithOTP,
        verifyPickupOtp,
        verifyCompletionOtp,
        processPayment,
        submitRideRating,
        createRide,
        updateRide,
        deleteRide,
        acceptBooking,
        declineBooking,
        logout,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
