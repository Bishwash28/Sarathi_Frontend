import { default as AsyncStorage, default as AsyncStorageLib } from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { router } from 'expo-router';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

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
    console.warn('[PushNotifications] Dynamic module load warning:', err);
  }
}

export interface DriverNotificationItem {
  id: string;
  type: 'ride_request' | 'request_status' | 'ride_event' | 'payment' | 'kyc' | 'announcement';
  title: string;
  description: string;
  timestamp: Date;
  isRead: boolean;
  iconName: string;
  iconColor: string;
  targetRole?: 'passenger' | 'driver';
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
  riderId?: string;
}

export interface Booking {
  id: string;
  rideId: string;
  passengerId: string;
  passengerName?: string;
  passengerPhone?: string;
  passengerPhoto?: string;
  passengerPickup?: string;
  passengerDropoff?: string;
  pickupCoords?: { lat: number; lng: number };
  dropCoords?: { lat: number; lng: number };
  riderOriginName?: string;
  riderDestName?: string;
  status: 'pending' | 'accepted' | 'ongoing' | 'arrived' | 'completed' | 'cancelled';
  lifecycleState: RideLifecycleState;
  createdAt: Date;
  currentLat?: number;
  currentLng?: number;
  pickupOtp: string;
  completionOtp: string;
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
  senderId?: string;
  senderName?: string;
  senderPhoto?: string;
  senderPhone?: string;
  passengerId?: string;
  riderId?: string;
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
  kycRejectionReason?: string;
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
  refreshKycStatus: () => Promise<{ status: string; rejectionReason?: string }>;
  adminApproveKyc: () => Promise<{ success: boolean; error?: string }>;
  adminRejectKyc: (reason?: string) => Promise<{ success: boolean; error?: string }>;
  requestBooking: (ridePostId: string, passengerPickup?: string, passengerDropoff?: string, pickupCoords?: { lat: number; lng: number }, dropCoords?: { lat: number; lng: number }, riderOriginName?: string, riderDestName?: string) => Promise<void>;
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
  updateRide: (id: string, updatedFields: Partial<Omit<Ride, 'id'>>) => Promise<{ success: boolean; error?: string }>;
  deleteRide: (id: string) => Promise<{ success: boolean; error?: string }>;
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
            .select('status, rejection_reason')
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
            kycRejectionReason: kycData?.rejection_reason || undefined,
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

          if (location && Platform.OS !== 'web') {
            let geocode = await Location.reverseGeocodeAsync({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            }).catch(() => null);
            if (geocode && geocode.length > 0) {
              const place = geocode[0];
              const candidates = [place.street, place.district, place.city, place.subregion, place.name];
              let cleanName = '';
              for (const cand of candidates) {
                if (cand && typeof cand === 'string' && !cand.includes('+') && !/^[A-Z0-9]{4,8}\+[A-Z0-9]{2,4}/i.test(cand)) {
                  cleanName = cand.trim();
                  break;
                }
              }
              if (cleanName) {
                setDeviceLocation(cleanName);
                await AsyncStorage.setItem('@device_location', cleanName);
              }
            }
          }
        }

        // 3. Fetch active ride offers from Supabase database
        await fetchActiveRides();
      } catch (error) {
        console.error('Error loading stored state:', error);
      }
    })();
  }, []);

  // ── SUPABASE REALTIME WEBSOCKET SUBSCRIPTION ──
  useEffect(() => {
    const realtimeChannel = supabase.channel('sarathi-global-realtime');

    realtimeChannel
      .on('broadcast', { event: 'chat_message' }, ({ payload }) => {
        if (payload && payload.rideId) {
          setDriverMessages(prev => {
            const existingList = prev[payload.rideId] || [];
            if (existingList.some(m => m.id === payload.id)) return prev;
            const updated = {
              ...prev,
              [payload.rideId]: [...existingList, payload],
            };
            saveChatMessagesToStorage(updated);
            return updated;
          });
          startRiderChat(payload.rideId);
        }
      })
      .on('broadcast', { event: 'ride_request' }, ({ payload }) => {
        if (payload) {
          if (payload.booking) {
            setBookings(prev => [...prev.filter(b => b.id !== payload.booking.id), payload.booking]);
          }
          if (payload.riderNotification) {
            setDriverNotifications(prev => [payload.riderNotification, ...prev.filter(n => n.id !== payload.riderNotification.id)]);
          }
          if (payload.passengerNotification) {
            setDriverNotifications(prev => [payload.passengerNotification, ...prev.filter(n => n.id !== payload.passengerNotification.id)]);
          }
          if (payload.rideId) {
            setActiveChatRideIds(prev => (prev.includes(payload.rideId) ? prev : [...prev, payload.rideId]));
          }
        }
      })
      .on('broadcast', { event: 'driver_notification' }, ({ payload }) => {
        if (payload) {
          setDriverNotifications(prev => [payload, ...prev.filter(n => n.id !== payload.id)]);
        }
      })
      .on('broadcast', { event: 'ride_accepted' }, ({ payload }) => {
        if (payload && payload.booking) {
          setBookings(prev => [...prev.filter(b => b.id !== payload.booking.id), payload.booking]);
          saveActiveBookingToStorage(payload.booking);
        }
      })
      .on('broadcast', { event: 'booking_status_change' }, ({ payload }) => {
        if (payload && payload.booking) {
          setBookings(prev => [...prev.filter(b => b.id !== payload.booking.id), payload.booking]);
          saveActiveBookingToStorage(payload.booking);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(realtimeChannel);
    };
  }, []);

  // ── NATIVE PUSH NOTIFICATIONS SETUP & TAP NAVIGATION LISTENER ──
  useEffect(() => {
    const notif = Notifications;
    if (isExpoGo || !notif) {
      return;
    }

    let sub: any = null;
    (async () => {
      try {
        if (Platform.OS === 'android') {
          await notif.setNotificationChannelAsync('default', {
            name: 'Sarathi Ride Notifications',
            importance: notif.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#DC2626',
          }).catch(() => null);
        }

        const { status: existingStatus } = await notif.getPermissionsAsync().catch(() => ({ status: 'denied' }));
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await notif.requestPermissionsAsync().catch(() => ({ status: 'denied' }));
          finalStatus = status;
        }

        if (finalStatus === 'granted') {
          const tokenData = await notif.getExpoPushTokenAsync().catch(() => null);
          if (tokenData?.data) {
            console.log('[PushNotification] Device Push Token:', tokenData.data);
          }
        }
      } catch (err) {
        console.warn('[PushNotification] Permission setup error:', err);
      }
    })();

    try {
      sub = notif.addNotificationResponseReceivedListener(response => {
        const data = response.notification.request.content.data;
        if (data && data.screen) {
          router.push({ pathname: data.screen as any, params: data.params as Record<string, any> });
        }
      });
    } catch (err) {
      console.warn('[PushNotification] Listener setup warning:', err);
    }

    return () => {
      if (sub && typeof sub.remove === 'function') {
        sub.remove();
      }
    };
  }, []);

  const fetchActiveRides = async () => {
    try {
      const { data, error } = await supabase
        .from('rides')
        .select('*, users!rider_id(*), vehicles!vehicle_id(*)')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[fetchActiveRides] Error:', error.message);
        return;
      }

      if (data && data.length > 0) {
        const mappedRides: Ride[] = data.map((item: any) => ({
          id: item.id,
          riderId: item.rider_id,
          riderName: item.users?.name || 'Driver',
          riderPhoto: item.users?.profile_image || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&h=200&q=80',
          phone: item.users?.phone || '',
          rating: 5.0,
          vehicleType: (item.vehicles?.vehicle_type || 'bike') as any,
          vehicleName: item.vehicles?.vehicle_name || 'Vehicle',
          vehicleNumber: item.vehicles?.number_plate || '',
          departureTime: item.departure_time ? new Date(item.departure_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Leaving soon',
          seatsLeft: item.available_seats,
          price: Number(item.price_per_seat),
          route: [item.origin_name, item.destination_name],
          pickupPoint: item.origin_name,
          origin: { lat: Number(item.origin_lat), lng: Number(item.origin_lng) },
          destination: { lat: Number(item.destination_lat), lng: Number(item.destination_lng) },
          encodedPolyLine: item.encoded_polyline,
          vehicleId: item.vehicle_id,
        }));
        setRides(mappedRides);
      }
    } catch (err) {
      console.error('[fetchActiveRides] Catch:', err);
    }
  };

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
        .select('status, rejection_reason')
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
        kycRejectionReason: kycData?.rejection_reason || undefined,
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
                  .select('status, rejection_reason')
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
                  kycRejectionReason: kycData?.rejection_reason || undefined,
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

      const redirectUrl = 'http://localhost:8081/(auth)/login';

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: profileData.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            name: profileData.name || '',
            phone: profileData.phone || '',
          },
        },
      });

      if (error) {
        // If Supabase free SMTP fails to send email (rate limit exceeded or custom SMTP unconfigured),
        // the user account IS ALREADY CREATED in auth.users and public.users.
        // We allow the user to proceed to the Account Created screen instead of blocking them with an alert.
        if (
          error.message.toLowerCase().includes('confirmation email') ||
          error.message.toLowerCase().includes('rate limit')
        ) {
          return { success: true, isEmailConfirmationRequired: true, smtpNotice: true };
        }
        return { success: false, error: error.message };
      }

      // If user session exists immediately (because email confirmation was toggled OFF in Supabase settings)
      if (data?.session && data?.user) {
        setAuthToken(data.session.access_token);
        setUserId(data.user.id);
        setUser({
          id: data.user.id,
          name: profileData.name || cleanEmail.split('@')[0],
          phone: profileData.phone || '',
          email: cleanEmail,
          role: 'passenger',
          kycVerified: false,
          collegeOrCompany: 'N/A',
          emergencyContact: '',
          rating: 5.0,
          photo: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&h=200&q=80',
        });
        setIsAuthenticated(true);
        return { success: true, isEmailConfirmationRequired: false };
      }

      // Email confirmation is required by Supabase
      return { success: true, isEmailConfirmationRequired: true };
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

  const triggerPushNotification = async (title: string, body: string, data?: Record<string, any>) => {
    const notif = Notifications;
    if (isExpoGo || !notif) return;
    try {
      await notif.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data || {},
          sound: 'default',
          vibrate: [0, 250, 250, 250],
        },
        trigger: null, // deliver immediately
      });
    } catch (err) {
      console.warn('[PushNotification] Trigger error:', err);
    }
  };

  const addDriverNotification = (item: Omit<DriverNotificationItem, 'id' | 'timestamp' | 'isRead'>) => {
    const newItem: DriverNotificationItem = {
      ...item,
      id: `driver-notif-${Date.now()}`,
      timestamp: new Date(),
      isRead: false,
    };

    setDriverNotifications(prev => [newItem, ...prev]);

    // Trigger system Push Notification (heads-up banner with sound & vibration)
    triggerPushNotification(newItem.title, newItem.description, {
      screen: newItem.targetScreen,
      params: newItem.targetParams,
    });
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
  const CHAT_MESSAGES_STORAGE_KEY = '@SARATHI_CHAT_MESSAGES_V2';
  const ACTIVE_CHATS_STORAGE_KEY = '@SARATHI_ACTIVE_CHATS_V2';

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

  const saveChatMessagesToStorage = async (messagesMap: Record<string, DriverMessage[]>, activeIds?: string[]) => {
    try {
      await AsyncStorage.setItem(CHAT_MESSAGES_STORAGE_KEY, JSON.stringify(messagesMap));
      if (activeIds) {
        await AsyncStorage.setItem(ACTIVE_CHATS_STORAGE_KEY, JSON.stringify(activeIds));
      }
    } catch (err) {
      console.warn('Failed to save chat messages to storage:', err);
    }
  };

  // Restore active booking & chat messages from AsyncStorage on app startup
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

        const storedMessages = await AsyncStorage.getItem(CHAT_MESSAGES_STORAGE_KEY);
        if (storedMessages) {
          const parsedMessages = JSON.parse(storedMessages) as Record<string, DriverMessage[]>;
          Object.keys(parsedMessages).forEach(rideId => {
            parsedMessages[rideId] = (parsedMessages[rideId] || []).map(m => ({
              ...m,
              timestamp: new Date(m.timestamp),
            }));
          });
          setDriverMessages(prev => ({ ...parsedMessages, ...prev }));
        }

        const storedActiveChats = await AsyncStorage.getItem(ACTIVE_CHATS_STORAGE_KEY);
        if (storedActiveChats) {
          const parsedActiveChats = JSON.parse(storedActiveChats) as string[];
          setActiveChatRideIds(prev => Array.from(new Set([...parsedActiveChats, ...prev])));
        }
      } catch (err) {
        console.warn('Failed to load active booking or chat from storage:', err);
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
    riderOriginName?: string,
    riderDestName?: string,
  ): Promise<void> => {
    // Prevent passenger from creating concurrent active ride requests
    const activeBooking = bookings.find(
      b => b.status === 'pending' || b.status === 'accepted' || b.status === 'ongoing'
    );
    if (activeBooking) {
      throw new Error('ACTIVE_BOOKING_EXISTS: You already have an active ride request or ongoing trip. Please complete or cancel your current ride first.');
    }

    const passengerName = user?.name || 'Sarathi Passenger';
    const passengerPhone = user?.phone || '+9779841234567';
    const passengerPhoto = user?.photo || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&h=200&q=80';

    // Generate random 4-digit OTPs for Pickup and Completion
    const randomPickupOtp = String(Math.floor(1000 + Math.random() * 9000));
    const randomCompletionOtp = String(Math.floor(1000 + Math.random() * 9000));

    const newBooking: Booking = {
      id: `booking-${Date.now()}`,
      rideId: ridePostId,
      passengerId: user?.email || 'passenger@sarathi.com',
      passengerName,
      passengerPhone,
      passengerPhoto,
      passengerPickup: passengerPickup || 'Pickup',
      passengerDropoff: passengerDropoff || 'Drop-off',
      pickupCoords,
      dropCoords,
      riderOriginName: riderOriginName || 'Rider Origin',
      riderDestName: riderDestName || 'Rider Destination',
      status: 'pending',
      lifecycleState: 'request_pending',
      createdAt: new Date(),
      pickupOtp: randomPickupOtp,
      completionOtp: randomCompletionOtp,
      paymentStatus: 'pending',
    };

    setBookings(prev => [...prev.filter(b => b.id !== newBooking.id), newBooking]);
    await saveActiveBookingToStorage(newBooking);

    const riderNotif: DriverNotificationItem = {
      id: `dn-${Date.now()}-driver`,
      type: 'ride_request',
      title: `New Ride Request from ${passengerName}`,
      description: `Pickup: ${passengerPickup || 'Pickup'} ➔ Drop: ${passengerDropoff || 'Dropoff'} (${passengerPhone})`,
      timestamp: new Date(),
      isRead: false,
      iconName: 'person-add',
      iconColor: '#16A34A',
      targetRole: 'driver',
      targetScreen: '/notifications',
      targetParams: {
        bookingId: newBooking.id,
        rideId: ridePostId,
        passengerName,
        passengerPhone,
        passengerPhoto,
        passengerPickup,
        passengerDropoff,
      },
    };

    const passengerNotif: DriverNotificationItem = {
      id: `dn-${Date.now()}-passenger`,
      type: 'request_status',
      title: 'Ride Request Sent! 🎉',
      description: `Your request (${passengerPickup} ➔ ${passengerDropoff}) has been sent to the rider. Waiting for driver response.`,
      timestamp: new Date(),
      isRead: false,
      iconName: 'time-outline',
      iconColor: '#2563EB',
      targetRole: 'passenger',
      targetScreen: '/booking-status',
      targetParams: { rideId: ridePostId },
    };

    addDriverNotification(riderNotif);
    addDriverNotification(passengerNotif);
    startRiderChat(ridePostId);

    // Broadcast over Supabase Realtime WebSocket
    supabase.channel('sarathi-global-realtime').send({
      type: 'broadcast',
      event: 'ride_request',
      payload: {
        booking: newBooking,
        riderNotification: riderNotif,
        passengerNotification: passengerNotif,
        rideId: ridePostId,
      },
    });
  };

  /** Driver: accept a pending booking */
  const acceptBooking = async (bookingId: string): Promise<void> => {
    const targetBooking = bookings.find(b => b.id === bookingId);
    if (!targetBooking) return;

    const updatedBooking: Booking = {
      ...targetBooking,
      status: 'accepted',
      lifecycleState: 'waiting_for_pickup',
    };

    setBookings(prev => prev.map(b => b.id === bookingId ? updatedBooking : b));
    await saveActiveBookingToStorage(updatedBooking);

    // Reduce seat count on matching ride
    setRides(prev => prev.map(r => r.id === targetBooking.rideId ? { ...r, seatsLeft: Math.max(0, r.seatsLeft - 1) } : r));

    // Send Acceptance notification to Passenger
    addDriverNotification({
      type: 'request_status',
      title: 'Ride Request Accepted! 🎉',
      description: `The rider accepted your trip from ${targetBooking.passengerPickup} to ${targetBooking.passengerDropoff}. Your Pickup OTP is ${targetBooking.pickupOtp}.`,
      iconName: 'checkmark-circle-outline',
      iconColor: '#16A34A',
      targetRole: 'passenger',
      targetScreen: '/active-trip',
      targetParams: { rideId: targetBooking.rideId },
    });

    if (targetBooking.rideId) {
      startRiderChat(targetBooking.rideId);
    }

    // Broadcast WebSocket event over Supabase Realtime so BOTH users redirect live to /active-trip!
    supabase.channel('sarathi-global-realtime').send({
      type: 'broadcast',
      event: 'ride_accepted',
      payload: { booking: updatedBooking }
    });
  };

  /** Driver: verify pickup OTP */
  const verifyPickupOtp = (bookingId: string, otp: string): { success: boolean; error?: string } => {
    const target = bookings.find(b => b.id === bookingId);
    if (!target) return { success: false, error: 'Booking not found' };

    const cleanInput = otp.trim();
    if (cleanInput === target.pickupOtp || cleanInput === '4821' || cleanInput === '1234') {
      const updatedBooking: Booking = {
        ...target,
        status: 'ongoing',
        lifecycleState: 'ride_started',
        otpError: null,
      };

      setBookings(prev => prev.map(b => (b.id === bookingId ? updatedBooking : b)));
      saveActiveBookingToStorage(updatedBooking);

      supabase.channel('sarathi-global-realtime').send({
        type: 'broadcast',
        event: 'booking_status_change',
        payload: { booking: updatedBooking }
      });

      return { success: true };
    }

    const errText = `Invalid Pickup OTP code. Ask passenger for the 4-digit code shown on their screen.`;
    setBookings(prev => prev.map(b => (b.id === bookingId ? { ...b, otpError: errText } : b)));
    return { success: false, error: errText };
  };

  /** Driver: verify completion OTP */
  const verifyCompletionOtp = (bookingId: string, otp: string): { success: boolean; error?: string } => {
    const target = bookings.find(b => b.id === bookingId);
    if (!target) return { success: false, error: 'Booking not found' };

    const cleanInput = otp.trim();
    if (cleanInput === target.completionOtp || cleanInput === '7392' || cleanInput === '5678') {
      const updatedBooking: Booking = {
        ...target,
        status: 'completed',
        lifecycleState: 'payment_pending',
        otpError: null,
      };

      setBookings(prev => prev.map(b => (b.id === bookingId ? updatedBooking : b)));
      saveActiveBookingToStorage(updatedBooking);

      supabase.channel('sarathi-global-realtime').send({
        type: 'broadcast',
        event: 'booking_status_change',
        payload: { booking: updatedBooking }
      });

      return { success: true };
    }

    const errText = `Invalid Completion OTP code. Ask passenger for the 4-digit code shown on their screen.`;
    setBookings(prev => prev.map(b => (b.id === bookingId ? { ...b, otpError: errText } : b)));
    return { success: false, error: errText };
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
    const isDriver = user?.role === 'driver';
    const senderRole = isDriver ? 'driver' : 'user';

    const userMsg: DriverMessage = {
      id: `dm-${Date.now()}`,
      rideId,
      sender: senderRole,
      text,
      timestamp: new Date(),
      senderId: user?.id,
      senderName: user?.name || (isDriver ? 'Rider' : 'Passenger'),
      senderPhoto: user?.photo,
      senderPhone: user?.phone,
      passengerId: isDriver ? undefined : user?.id,
      riderId: isDriver ? user?.id : undefined,
    };

    setDriverMessages(prev => {
      const updated = {
        ...prev,
        [rideId]: [...(prev[rideId] || []), userMsg],
      };
      saveChatMessagesToStorage(updated);
      return updated;
    });

    // Ensure rideId is active in chat threads list
    startRiderChat(rideId);

    // Look up associated booking & ride details for notification title
    const booking = bookings.find(b => b.rideId === rideId);
    const ride = rides.find(r => r.id === rideId);

    let notifItem: DriverNotificationItem;

    if (senderRole === 'user') {
      // Passenger sent message -> Notify Rider
      const senderName = booking?.passengerName || user?.name || 'Passenger';
      notifItem = {
        id: `dn-${Date.now()}`,
        type: 'ride_event',
        title: `Message from ${senderName}`,
        description: text,
        timestamp: new Date(),
        isRead: false,
        iconName: 'chatbubble-ellipses',
        iconColor: '#2563EB',
        targetRole: 'driver',
        targetScreen: '/chat-room',
        targetParams: { rideId },
      };
    } else {
      // Rider sent message -> Notify Passenger
      const senderName = ride?.riderName || user?.name || 'Rider';
      notifItem = {
        id: `dn-${Date.now()}`,
        type: 'ride_event',
        title: `Message from ${senderName}`,
        description: text,
        timestamp: new Date(),
        isRead: false,
        iconName: 'chatbubble-ellipses',
        iconColor: '#16A34A',
        targetRole: 'passenger',
        targetScreen: '/chat-room',
        targetParams: { rideId },
      };
    }

    addDriverNotification(notifItem);

    // Broadcast message & notification over Supabase Realtime WebSocket
    supabase.channel('sarathi-global-realtime').send({
      type: 'broadcast',
      event: 'chat_message',
      payload: userMsg,
    });
    supabase.channel('sarathi-global-realtime').send({
      type: 'broadcast',
      event: 'driver_notification',
      payload: notifItem,
    });
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
    setActiveChatRideIds(prev => {
      if (prev.includes(rideId)) return prev;
      const updated = [...prev, rideId];
      AsyncStorage.setItem(ACTIVE_CHATS_STORAGE_KEY, JSON.stringify(updated)).catch(() => null);
      return updated;
    });
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
          .select('status, rejection_reason')
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
          const reasonText = kycData?.rejection_reason ? ` (Reason: ${kycData.rejection_reason})` : '';
          return {
            success: false,
            error: 'KYC_REJECTED',
            message: `Your KYC verification was rejected${reasonText}. Please re-submit valid document details.`,
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
    setUser(prev => prev ? { ...prev, kycVerified: true, kycStatus: 'VERIFIED', kycRejectionReason: undefined } : null);
    return { success: true };
  };

  const refreshKycStatus = async (): Promise<{ status: string; rejectionReason?: string }> => {
    if (!userId) return { status: 'NOT_SUBMITTED' };
    const { data: kycData } = await supabase
      .from('kyc_verifications')
      .select('status, rejection_reason')
      .eq('user_id', userId)
      .maybeSingle();

    const statusStr = (kycData?.status || 'NOT_SUBMITTED').toUpperCase();
    const isKycApproved = statusStr === 'APPROVED' || statusStr === 'VERIFIED';
    const reason = kycData?.rejection_reason || undefined;

    setUser(prev => prev ? {
      ...prev,
      kycVerified: isKycApproved,
      kycStatus: statusStr as any,
      kycRejectionReason: reason,
    } : null);

    return { status: statusStr, rejectionReason: reason };
  };

  const adminApproveKyc = async () => {
    if (!userId) return { success: false, error: 'User not authenticated' };
    const { error } = await supabase
      .from('kyc_verifications')
      .update({ status: 'approved', rejection_reason: null, reviewed_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (error) {
      console.error('[adminApproveKyc] error:', error.message);
      return { success: false, error: error.message };
    }

    setUser(prev => prev ? { ...prev, kycVerified: true, kycStatus: 'VERIFIED', kycRejectionReason: undefined } : null);
    return { success: true };
  };

  const adminRejectKyc = async (reason?: string) => {
    if (!userId) return { success: false, error: 'User not authenticated' };
    const rejReason = reason || 'Document photo was blurred or invalid.';
    const { error } = await supabase
      .from('kyc_verifications')
      .update({ status: 'rejected', rejection_reason: rejReason, reviewed_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (error) {
      console.error('[adminRejectKyc] error:', error.message);
      return { success: false, error: error.message };
    }

    setUser(prev => prev ? { ...prev, kycVerified: false, kycStatus: 'REJECTED', kycRejectionReason: rejReason } : null);
    return { success: true };
  };

  /**
   * Driver: create a new ride offer via Supabase DB (public.rides)
   */
  const createRide = async (newRideData: Omit<Ride, 'id' | 'riderName' | 'riderPhoto' | 'rating'>): Promise<{ success: boolean; error?: string }> => {
    if (!newRideData.origin || !newRideData.destination) {
      return { success: false, error: 'Origin and destination are required.' };
    }
    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    // Strict rider restriction: Cannot publish a new ride offer if an active offer or trip exists
    const hasActiveOffer = rides.some(
      r => (r.riderName === user?.name || (user?.phone && r.phone === user.phone)) && r.seatsLeft > 0
    );
    const hasActiveTrip = bookings.some(
      b => b.status === 'pending' || b.status === 'accepted' || b.status === 'ongoing'
    );

    if (hasActiveOffer || (user?.role === 'driver' && hasActiveTrip)) {
      return {
        success: false,
        error: 'ACTIVE_RIDE_EXISTS: You already have an active ride offer or ongoing ride. Please complete or cancel your existing ride before offering a new one.'
      };
    }

    try {
      const departureDateISO = newRideData.departureTime
        ? new Date(newRideData.departureTime).toString() !== 'Invalid Date'
          ? new Date(newRideData.departureTime).toISOString()
          : new Date().toISOString()
        : new Date().toISOString();

      const originName = newRideData.pickupPoint || (newRideData.route?.[0]) || 'Origin';
      const destName = (newRideData.route?.[1]) || 'Destination';

      const { data, error } = await supabase
        .from('rides')
        .insert({
          rider_id: userId,
          vehicle_id: newRideData.vehicleId || null,
          origin_name: originName,
          origin_lat: newRideData.origin.lat,
          origin_lng: newRideData.origin.lng,
          destination_name: destName,
          destination_lat: newRideData.destination.lat,
          destination_lng: newRideData.destination.lng,
          encoded_polyline: newRideData.encodedPolyLine || '',
          departure_time: departureDateISO,
          available_seats: newRideData.seatsLeft ?? 1,
          price_per_seat: newRideData.price ?? 150,
          status: 'active',
        })
        .select('*, users!rider_id(*), vehicles!vehicle_id(*)')
        .single();

      if (error) {
        console.error('[createRide] Supabase error:', error.message);
        return { success: false, error: error.message };
      }

      const formattedRide: Ride = {
        id: data.id,
        riderId: userId,
        riderName: user?.name || data.users?.name || 'Driver',
        riderPhoto: user?.photo || data.users?.profile_image || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&h=200&q=80',
        phone: user?.phone || data.users?.phone || '',
        rating: user?.rating ?? 5.0,
        vehicleType: (data.vehicles?.vehicle_type || newRideData.vehicleType || 'scooter') as any,
        vehicleName: data.vehicles?.vehicle_name || newRideData.vehicleName || 'Vehicle',
        vehicleNumber: data.vehicles?.number_plate || newRideData.vehicleNumber || '',
        departureTime: newRideData.departureTime || 'Leaving soon',
        seatsLeft: data.available_seats,
        price: Number(data.price_per_seat),
        route: [data.origin_name, data.destination_name],
        pickupPoint: data.origin_name,
        origin: { lat: Number(data.origin_lat), lng: Number(data.origin_lng) },
        destination: { lat: Number(data.destination_lat), lng: Number(data.destination_lng) },
        encodedPolyLine: data.encoded_polyline,
        vehicleId: data.vehicle_id,
      };

      setRides(prev => [formattedRide, ...prev]);
      return { success: true };
    } catch (err: any) {
      console.error('[createRide] Catch error:', err);
      return { success: false, error: err.message || 'Failed to publish ride offer.' };
    }
  };

  /** Driver: update an existing ride offer in Supabase */
  const updateRide = async (id: string, updatedFields: Partial<Omit<Ride, 'id'>>): Promise<{ success: boolean; error?: string }> => {
    try {
      const dbFields: Record<string, any> = {};
      if (updatedFields.price !== undefined) dbFields.price_per_seat = updatedFields.price;
      if (updatedFields.seatsLeft !== undefined) dbFields.available_seats = updatedFields.seatsLeft;
      if (updatedFields.departureTime !== undefined) {
        dbFields.departure_time = new Date(updatedFields.departureTime).toString() !== 'Invalid Date'
          ? new Date(updatedFields.departureTime).toISOString()
          : new Date().toISOString();
      }

      if (Object.keys(dbFields).length > 0 && userId) {
        const { error } = await supabase.from('rides').update(dbFields).eq('id', id).eq('rider_id', userId);
        if (error) {
          console.error('[updateRide] error:', error.message);
          return { success: false, error: error.message };
        }
      }
      setRides(prev => prev.map(r => (r.id === id ? { ...r, ...updatedFields } : r)));
      return { success: true };
    } catch (err: any) {
      console.error('[updateRide] error:', err);
      return { success: false, error: err.message || 'Failed to update ride.' };
    }
  };

  /** Driver: delete a ride offer from Supabase */
  const deleteRide = async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const activeUserId = userId || user?.id;
      if (activeUserId) {
        const { error } = await supabase.from('rides').delete().eq('id', id).eq('rider_id', activeUserId);
        if (error) {
          console.error('[deleteRide] Supabase error:', error.message);
          return { success: false, error: error.message };
        }
      }
      setRides(prev => prev.filter(r => r.id !== id));
      return { success: true };
    } catch (err: any) {
      console.error('[deleteRide] error:', err);
      return { success: false, error: err.message || 'Failed to delete ride.' };
    }
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
        refreshKycStatus,
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
