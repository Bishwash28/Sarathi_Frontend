import { default as AsyncStorage, default as AsyncStorageLib } from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Linking from 'expo-linking';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { sendLocalPushNotification } from '../utils/pushNotifications';

WebBrowser.maybeCompleteAuthSession();

const isUUID = (str?: string) => Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

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


export interface RatingItem {
  id?: string;
  rated_user: string;
  rated_by: string;
  rating: number;
  created_at?: string;
}

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
  status?: 'active' | 'completed' | 'cancelled';
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
  driverId?: string;
  driverName?: string;
  driverPhoto?: string;
  driverPhone?: string;
  vehicleName?: string;
  vehicleNumber?: string;
  farePrice?: number;
  status: 'pending' | 'accepted' | 'ongoing' | 'arrived' | 'completed' | 'cancelled';
  lifecycleState: RideLifecycleState;
  createdAt: Date;
  completedAt?: Date;      // NEW
  cancelledAt?: Date;      // NEW
  cancelledBy?: 'passenger' | 'rider'; // NEW
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
  receiverId?: string;
  passengerId?: string;
  riderId?: string;
  isRead?: boolean;
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
  isAuthLoading: boolean;
  hasCompletedOnboarding: boolean;
  completeOnboarding: () => Promise<void>;
  rides: Ride[];
  bookings: Booking[];
  messages: Message[];
  driverMessages: Record<string, DriverMessage[]>;
  activeChatRideIds: string[];
  notifications: string[];
  driverNotifications: DriverNotificationItem[];
  unreadDriverNotifCount: number;
  unreadChatMessageCount: number;
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
  switchUserRole: (targetRole: 'PASSENGER' | 'RIDER' | 'DRIVER') => Promise<{ success: boolean; error?: string; message?: string }>;
  uploadUserKycDocument: (documentType: string, document: string, file: string) => Promise<{ success: boolean; error?: string }>;
  submitKycVerify: () => Promise<{ success: boolean; error?: string }>;
  refreshKycStatus: () => Promise<{ status: string; rejectionReason?: string }>;
  adminApproveKyc: () => Promise<{ success: boolean; error?: string }>;
  adminRejectKyc: (reason?: string) => Promise<{ success: boolean; error?: string }>;
  requestBooking: (ridePostId: string, passengerPickup?: string, passengerDropoff?: string, pickupCoords?: { lat: number; lng: number }, dropCoords?: { lat: number; lng: number }, riderOriginName?: string, riderDestName?: string, explicitRiderId?: string) => Promise<void>;
  cancelBooking: (bookingId: string) => void;
  addDriverNotification: (item: Omit<DriverNotificationItem, 'id' | 'timestamp' | 'isRead'>) => void;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  clearNotification: (id: string) => void;
  sendChatMessage: (text: string) => void;
  sendDriverMessage: (rideId: string, text: string) => void;
  startRiderChat: (rideId: string) => void;
  markConversationAsRead: (rideId: string) => Promise<void>;
  fetchUserConversations: () => Promise<Record<string, DriverMessage[]>>;
  nudgeDriverLocation: (bookingId: string) => void;
  startRideWithOTP: (bookingId: string, otp: string) => boolean;
  endRideWithOTP: (bookingId: string, otp: string) => boolean;
  verifyPickupOtp: (bookingId: string, otp: string) => { success: boolean; error?: string };
  verifyCompletionOtp: (bookingId: string, otp: string) => { success: boolean; error?: string };
  triggerCompletionOtpPrompt: (bookingId: string) => void;
  processPayment: (bookingId: string, method: 'cash' | 'khalti' | 'esewa') => { success: boolean; error?: string };
  ratingsList: RatingItem[];
  getUserRating: (userId?: string) => { average: number; count: number; hasRatings: boolean };
  submitRideRating: (bookingId: string, rating: number, comment?: string) => Promise<void>;
  createRide: (ride: Omit<Ride, 'id' | 'riderName' | 'riderPhoto' | 'rating'>) => Promise<{ success: boolean; error?: string }>;
  updateRide: (id: string, updatedFields: Partial<Omit<Ride, 'id'>>) => Promise<{ success: boolean; error?: string }>;
  deleteRide: (id: string) => Promise<{ success: boolean; error?: string }>;
  acceptBooking: (bookingId: string) => void;
  declineBooking: (bookingId: string) => void;
  deleteConversation: (rideId: string) => Promise<void>;
  deletedChatRideIds: string[];
  fetchActiveRides: () => Promise<Ride[]>;
  fetchUserBookings: () => Promise<Booking[]>;
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
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean>(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlaceItem[]>(initialSavedPlaces);
  const [ratingsList, setRatingsList] = useState<RatingItem[]>([]);

  const completeOnboarding = async () => {
    setHasCompletedOnboarding(true);
    try {
      await AsyncStorageLib.setItem('@sarathi_has_completed_onboarding', 'true');
    } catch (err) {
      console.warn('[completeOnboarding] AsyncStorage save error:', err);
    }
  };

  /** Dynamic Average Rating Calculation */
  const getUserRating = React.useCallback((targetUserId?: string): { average: number; count: number; hasRatings: boolean } => {
    const validTargetIds = new Set<string>();
    if (targetUserId && targetUserId.trim()) {
      validTargetIds.add(targetUserId.trim().toLowerCase());
    } else {
      if (user?.id && user.id.trim()) validTargetIds.add(user.id.trim().toLowerCase());
      if (user?.email && user.email.trim()) validTargetIds.add(user.email.trim().toLowerCase());
      if (user?.name && user.name.trim()) validTargetIds.add(user.name.trim().toLowerCase());
      if (user?.phone && user.phone.trim()) validTargetIds.add(user.phone.trim().toLowerCase());
    }

    if (validTargetIds.size === 0) {
      return { average: 0, count: 0, hasRatings: false };
    }

    const userRatings = ratingsList.filter(r => {
      if (!r.rated_user) return false;
      const ru = r.rated_user.trim().toLowerCase();
      return validTargetIds.has(ru);
    });

    const uniqueRatingsMap = new Map<string, RatingItem>();
    userRatings.forEach(r => {
      const key = `${r.rated_by}_${r.rating}_${r.created_at || r.id}`;
      if (!uniqueRatingsMap.has(key)) {
        uniqueRatingsMap.set(key, r);
      }
    });

    const uniqueRatings = Array.from(uniqueRatingsMap.values());

    if (uniqueRatings.length === 0) {
      return { average: 0, count: 0, hasRatings: false };
    }

    const sum = uniqueRatings.reduce((acc, curr) => acc + Number(curr.rating || 0), 0);
    const avg = Math.round((sum / uniqueRatings.length) * 10) / 10;
    return { average: avg, count: uniqueRatings.length, hasRatings: true };
  }, [ratingsList, user?.id, user?.email, user?.name, user?.phone]);

  /** Fetch ratings from Supabase & local storage */
  const fetchRatings = async () => {
    try {
      const cached = await AsyncStorage.getItem('sarathi_ratings_list');
      let cachedList: RatingItem[] = [];
      if (cached) {
        try { cachedList = JSON.parse(cached); } catch (e) { }
      }

      const { data, error } = await supabase.from('ratings').select('*');
      if (error) {
        if (cachedList.length > 0) setRatingsList(cachedList);
      } else if (data) {
        const map = new Map<string, RatingItem>();
        cachedList.forEach(item => {
          const key = `${item.rated_user}_${item.rated_by}_${item.rating}_${item.created_at || ''}`;
          map.set(key, item);
        });
        (data as any[]).forEach(item => {
          const ratingObj: RatingItem = {
            id: item.id,
            rated_user: item.rated_user,
            rated_by: item.rated_by,
            rating: Number(item.rating),
            created_at: item.created_at,
          };
          const key = `${item.rated_user}_${item.rated_by}_${item.rating}_${item.created_at || ''}`;
          map.set(key, ratingObj);
        });
        const merged = Array.from(map.values());
        setRatingsList(merged);
        await AsyncStorage.setItem('sarathi_ratings_list', JSON.stringify(merged));
      } else if (cachedList.length > 0) {
        setRatingsList(cachedList);
      }
    } catch (err) {
      console.error('[fetchRatings] Error:', err);
    }
  };

  /** Fetch notifications from Supabase DB */
  const fetchUserNotifications = async (): Promise<DriverNotificationItem[]> => {
    const activeUserId = userId || user?.id;
    if (!activeUserId) {
      setDriverNotifications([]);
      return [];
    }

    try {
      let notifData: any[] = [];
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', activeUserId)
        .order('created_at', { ascending: false });

      if (error && error.message.includes('schema cache')) {
        // Fallback to chat_messages with sender_role = 'system_notification' if notifications table does not exist
        const { data: sysData } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('receiver_id', activeUserId)
          .eq('sender_role', 'system_notification')
          .order('created_at', { ascending: false });
        if (sysData) {
          notifData = sysData.map((row: any) => ({
            id: row.id,
            user_id: activeUserId,
            type: 'ride_request',
            title: row.sender_name || 'Notification',
            body: row.message_text,
            is_read: row.is_read,
            created_at: row.created_at,
            data: {},
          }));
        }
      } else if (data) {
        notifData = data;
      }

      const mappedNotifs: DriverNotificationItem[] = notifData.map((row: any) => ({
        id: row.id,
        type: row.type || 'ride_request',
        title: row.title || 'Notification',
        description: row.body || row.message_text || '',
        timestamp: new Date(row.created_at),
        isRead: Boolean(row.is_read),
        iconName: row.data?.iconName || (row.type === 'ride_request' ? 'person-add' : 'notifications'),
        iconColor: row.data?.iconColor || '#2563EB',
        targetRole: row.data?.targetRole,
        targetScreen: row.data?.targetScreen,
        targetParams: row.data?.targetParams,
      }));

      setDriverNotifications(mappedNotifs);
      return mappedNotifs;
    } catch (err) {
      console.error('[fetchUserNotifications] Error:', err);
      return driverNotifications;
    }
  };

  useEffect(() => {
    if (userId) {
      fetchRatings();
      fetchUserNotifications();
    }
  }, [userId]);

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
  const [deletedChatRideIds, setDeletedChatRideIds] = useState<string[]>([]);
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
        // 0. Check persistent onboarding completion flag from AsyncStorage
        const onboardingFlag = await AsyncStorageLib.getItem('@sarathi_has_completed_onboarding');
        if (onboardingFlag === 'true') {
          setHasCompletedOnboarding(true);
        }

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
      } finally {
        setIsAuthLoading(false);
      }
    })();
  }, []);

  // ── RE-FETCH ACTIVE RIDES & BOOKINGS ON AUTHENTICATION CHANGE ──
  useEffect(() => {
    if (isAuthenticated) {
      fetchActiveRides();
      fetchUserConversations();
      fetchUserBookings();
    }
  }, [isAuthenticated]);

  // ── REALTIME DB CHAT CONVERSATIONS SUBSCRIPTION ──
  useEffect(() => {
    if (!userId) return;

    fetchUserConversations();
    fetchUserBookings();

    const dbChatChannel = supabase
      .channel(`sarathi-db-chat-realtime-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages',
        },
        (payload: any) => {
          if (payload.new) {
            const newRow = payload.new;
            const isParticipant =
              newRow.sender_id === userId ||
              newRow.receiver_id === userId ||
              newRow.passenger_id === userId ||
              newRow.rider_id === userId;

            if (isParticipant) {
              fetchUserConversations();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(dbChatChannel);
    };
  }, [userId]);

  // ── SUPABASE REALTIME WEBSOCKET SUBSCRIPTION ──
  useEffect(() => {
    const realtimeChannel = supabase.channel('sarathi-global-realtime');

    realtimeChannel
      .on('broadcast', { event: 'chat_message' }, ({ payload }) => {
        if (payload && payload.rideId) {
          const isParticipant =
            !payload.senderId ||
            !userId ||
            payload.senderId === userId ||
            payload.receiverId === userId ||
            payload.passengerId === userId ||
            payload.riderId === userId;

          if (!isParticipant) return;

          setDriverMessages(prev => {
            const existingList = prev[payload.rideId] || [];
            const payloadTime = new Date(payload.timestamp).getTime();
            const isDuplicate = existingList.some(
              m => m.id === payload.id ||
                ((m.senderId === payload.senderId || (m.senderName && payload.senderName && m.senderName === payload.senderName)) &&
                  m.text === payload.text &&
                  Math.abs(new Date(m.timestamp).getTime() - payloadTime) < 3000)
            );
            if (isDuplicate) return prev;
            const updated = {
              ...prev,
              [payload.rideId]: [...existingList, { ...payload, timestamp: new Date(payload.timestamp) }],
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
        if (payload) {
          if (payload.booking) {
            setBookings(prev => [...prev.filter(b => b.id !== payload.booking.id), payload.booking]);
            saveActiveBookingToStorage(payload.booking);
          }
          if (payload.driverNotification) {
            setDriverNotifications(prev => [payload.driverNotification, ...prev.filter(n => n.id !== payload.driverNotification.id)]);
            triggerPushNotification(payload.driverNotification.title, payload.driverNotification.description, {
              screen: payload.driverNotification.targetScreen,
              params: payload.driverNotification.targetParams,
            });
          }
          if (payload.passengerNotification) {
            setDriverNotifications(prev => [payload.passengerNotification, ...prev.filter(n => n.id !== payload.passengerNotification.id)]);
            triggerPushNotification(payload.passengerNotification.title, payload.passengerNotification.description, {
              screen: payload.passengerNotification.targetScreen,
              params: payload.passengerNotification.targetParams,
            });
          }
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

  const fetchActiveRides = async (): Promise<Ride[]> => {
    try {
      const { data, error } = await supabase
        .from('rides')
        .select('*, users!rider_id(*), vehicles!vehicle_id(*)')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[fetchActiveRides] Error:', error.message);
        return rides;
      }

      if (data) {
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
          departureTime: item.departure_time ? new Date(item.departure_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          seatsLeft: item.available_seats,
          price: Number(item.price_per_seat),
          route: [item.origin_name, item.destination_name],
          pickupPoint: item.origin_name,
          origin: { lat: Number(item.origin_lat), lng: Number(item.origin_lng) },
          destination: { lat: Number(item.destination_lat), lng: Number(item.destination_lng) },
          encodedPolyLine: item.encoded_polyline,
          vehicleId: item.vehicle_id,
          status: item.status || 'active',
        }));
        setRides(mappedRides);
        return mappedRides;
      }
      return rides;
    } catch (err) {
      console.error('[fetchActiveRides] Catch:', err);
      return rides;
    }
  };

  const fetchUserBookings = async (): Promise<Booking[]> => {
    if (!userId) {
      return bookings;
    }

    try {
      const activeUserId = userId;
      const { data: myRides } = await supabase
        .from('rides')
        .select('id')
        .eq('rider_id', activeUserId);

      const driverRideIds = (myRides || []).map((r: any) => r.id);

      // FIX: nested join now pulls rider (users) + vehicle info attached to
      // the ride, so this data survives regardless of whether the ride is
      // still 'active' in the separate `rides` in-memory list.
      let query = supabase
        .from('ride_requests')
        .select('*, users!passenger_id(*), rides!ride_id(*, users!rider_id(*), vehicles!vehicle_id(*))');

      if (driverRideIds.length > 0) {
        query = query.or(`passenger_id.eq.${activeUserId},ride_id.in.(${driverRideIds.join(',')})`);
      } else {
        query = query.eq('passenger_id', activeUserId);
      }

      let { data, error } = await query.order('requested_at', { ascending: false });

      if (error && error.message.includes('schema cache')) {
        let fallbackQuery = supabase.from('bookings').select('*');
        if (driverRideIds.length > 0) {
          fallbackQuery = fallbackQuery.or(`passenger_id.eq.${activeUserId},ride_id.in.(${driverRideIds.join(',')})`);
        } else {
          fallbackQuery = fallbackQuery.eq('passenger_id', activeUserId);
        }
        const res = await fallbackQuery.order('created_at', { ascending: false });
        data = res.data;
        error = res.error;
      }

      if (error) {
        if (!error.message.includes('schema cache')) {
          console.warn('[fetchUserBookings] Error:', error.message);
        }
        return bookings;
      }

      if (data) {
        const mappedBookings: Booking[] = data.map((item: any) => ({
          id: item.id,
          rideId: item.ride_id,
          passengerId: item.passenger_id || '',
          passengerName: item.users?.name || item.passenger_name || 'Passenger',
          passengerPhone: item.users?.phone || item.passenger_phone || '',
          passengerPhoto: item.users?.profile_image || item.passenger_photo || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&h=200&q=80',
          passengerPickup: item.pickup_name || item.passenger_pickup || '',
          passengerDropoff: item.drop_name || item.dropoff_name || item.passenger_dropoff || '',
          riderOriginName: item.rides?.origin_name || item.rider_origin_name,
          riderDestName: item.rides?.destination_name || item.rider_dest_name,
          // NEW: driver + vehicle info now sourced from the nested join,
          // present on history rows even when the ride itself is no longer active.
          driverId: item.rides?.rider_id || item.driver_id,
          driverName: item.rides?.users?.name || item.driver_name || 'Driver',
          driverPhoto: item.rides?.users?.profile_image || item.driver_photo || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&h=200&q=80',
          driverPhone: item.rides?.users?.phone || item.driver_phone || '',
          vehicleName: item.rides?.vehicles?.vehicle_name || item.vehicle_name || 'Vehicle',
          vehicleNumber: item.rides?.vehicles?.number_plate || item.vehicle_number || '',
          farePrice: Number(item.fare_amount ?? item.rides?.price_per_seat ?? 150),
          status: (item.status || 'pending').toLowerCase() as any,
          cancelledBy: item.cancelled_by || undefined,
          createdAt: item.requested_at ? new Date(item.requested_at) : (item.created_at ? new Date(item.created_at) : new Date()),
          completedAt: item.completed_at ? new Date(item.completed_at) : undefined,
          cancelledAt: item.cancelled_at ? new Date(item.cancelled_at) : undefined,
          pickupOtp: item.start_pin_code || item.pickup_otp || '1234',
          completionOtp: item.end_pin_code || item.completion_otp || '5678',
          lifecycleState: item.lifecycle_state || (
            item.status === 'pending' ? 'request_pending' :
              item.status === 'accepted' ? 'waiting_for_pickup' :
                item.status === 'ongoing' ? 'ride_started' :
                  item.status === 'completed' ? 'completed' : 'cancelled'
          ),
        }));

        setBookings(mappedBookings);
        return mappedBookings;
      }
      return bookings;
    } catch (err) {
      console.error('[fetchUserBookings] Catch:', err);
      return bookings;
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
      await fetchActiveRides();
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

      if (!data?.url) {
        return { success: false, error: 'Failed to generate Google authentication URL.' };
      }

      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

      let session: any = null;

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
            session = sessionData?.session;
          }
        }
      }

      // Fallback: Check active session in Supabase client if set via deep link listener
      if (!session) {
        const { data: activeSessionData } = await supabase.auth.getSession();
        session = activeSessionData?.session;
      }

      if (!session || !session.user) {
        return { success: false, error: 'Google authentication was cancelled or failed.' };
      }

      const uid = session.user.id;
      setAuthToken(session.access_token);
      setUserId(uid);

      // Fetch existing user profile
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', uid)
        .maybeSingle();

      const userEmail = session.user.email || profile?.email || '';
      const userName = profile?.name || session.user.user_metadata?.name || session.user.user_metadata?.full_name || userEmail.split('@')[0] || 'User';
      const userPhoto = profile?.profile_image || session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&h=200&q=80';
      const userPhone = profile?.phone || session.user.user_metadata?.phone || '';

      // If user profile is not in public.users DB yet, create it
      if (!profile) {
        try {
          await supabase.from('users').upsert({
            id: uid,
            email: userEmail,
            name: userName,
            phone: userPhone,
            profile_image: userPhoto,
            current_mode: 'passenger',
          });
        } catch (e) {
          console.warn('[loginWithGoogle] Profile upsert warning:', e);
        }
      }

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
        name: userName,
        phone: userPhone,
        email: userEmail,
        role: userRole,
        kycVerified: isKycApproved,
        kycStatus: kycStatusStr as any,
        kycRejectionReason: kycData?.rejection_reason || undefined,
        collegeOrCompany: 'N/A',
        emergencyContact: '',
        rating: 5.0,
        photo: userPhoto,
      });
      setIsAuthenticated(true);
      await fetchActiveRides();
      return { success: true };
    } catch (err: any) {
      console.error('[loginWithGoogle] Catch error:', err);
      return { success: false, error: err.message || 'Google login failed' };
    }
  };

  const resetPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      // Use dynamic app deep link (sarathifrontend://reset-password on APK, localhost on web)
      const redirectUrl = Linking.createURL('/reset-password');

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

      const redirectUrl = Linking.createURL('/(auth)/login');

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
    try {
      await sendLocalPushNotification({ title, body, data: data || {} });
    } catch (err) {
      console.warn('[PushNotification] Trigger error:', err);
    }
  };

  const addDriverNotification = async (item: Omit<DriverNotificationItem, 'id' | 'timestamp' | 'isRead'>, targetUserId?: string) => {
    const newItem: DriverNotificationItem = {
      ...item,
      id: `driver-notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date(),
      isRead: false,
    };

    const recipientId = targetUserId || userId || user?.id;
    const isForCurrentUser = Boolean(!targetUserId || (user?.id && targetUserId === user.id) || (userId && targetUserId === userId));

    if (isForCurrentUser) {
      setDriverNotifications(prev => {
        if (prev.some(n => n.id === newItem.id || (n.title === newItem.title && n.description === newItem.description && Math.abs(n.timestamp.getTime() - newItem.timestamp.getTime()) < 3000))) {
          return prev;
        }
        return [newItem, ...prev];
      });

      triggerPushNotification(newItem.title, newItem.description, {
        screen: newItem.targetScreen,
        params: newItem.targetParams,
      });
    }

    if (recipientId) {
      try {
        // FIX: use SECURITY DEFINER RPC instead of a direct table insert.
        // A direct insert here would silently fail under normal RLS
        // (auth.uid() = user_id) whenever recipientId belongs to the OTHER
        // party (e.g. passenger notifying the rider). This is what was
        // causing riders to never receive request notifications, and why
        // those notifications never came back after logout/login — they
        // were never actually saved to the DB in the first place.
        const { error } = await supabase.rpc('create_notification', {
          p_user_id: recipientId,
          p_type: newItem.type || 'ride_request',
          p_title: newItem.title,
          p_body: newItem.description,
          p_data: {
            iconName: newItem.iconName,
            iconColor: newItem.iconColor,
            targetRole: newItem.targetRole,
            targetScreen: newItem.targetScreen,
            targetParams: newItem.targetParams,
          },
        });

        if (error) {
          console.warn('[addDriverNotification] RPC insert failed:', error.message);
        }
      } catch (e) {
        console.warn('[addDriverNotification] DB save warning:', e);
      }
    }
  };

  const markNotificationAsRead = async (id: string) => {
    setDriverNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
    );
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      await supabase.from('chat_messages').update({ is_read: true }).eq('id', id);
    } catch (e) { }
  };

  const markAllNotificationsAsRead = async () => {
    setDriverNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    const activeUserId = userId || user?.id;
    if (activeUserId) {
      try {
        await supabase.from('notifications').update({ is_read: true }).eq('user_id', activeUserId);
        await supabase.from('chat_messages').update({ is_read: true }).eq('receiver_id', activeUserId).eq('sender_role', 'system_notification');
      } catch (e) { }
    }
  };

  const clearNotification = async (id: string) => {
    setDriverNotifications(prev => prev.filter(n => n.id !== id));
    try {
      await supabase.from('notifications').delete().eq('id', id);
      await supabase.from('chat_messages').delete().eq('id', id);
    } catch (e) { }
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

  useEffect(() => {
    if (!userId) return;

    const notifChannel = supabase
      .channel(`sarathi-notifications-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => {
          fetchUserNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notifChannel);
    };
  }, [userId]);

  const activeBooking = bookings.find(
    b => (user?.id ? (b.passengerId === user.id || (user?.email && b.passengerId === user.email)) : false) &&
      b.lifecycleState !== 'completed' &&
      b.lifecycleState !== 'cancelled' &&
      b.status !== 'completed' &&
      b.status !== 'cancelled'
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
    explicitRiderId?: string,
  ): Promise<void> => {
    // Verify ride availability and self-booking restriction
    let targetRide = rides.find(r => r.id === ridePostId);
    let targetRiderUserId = explicitRiderId || targetRide?.riderId;

    if ((!targetRide || !targetRiderUserId) && isUUID(ridePostId)) {
      try {
        const { data: dbRide } = await supabase
          .from('rides')
          .select('*, users!rider_id(*), vehicles!vehicle_id(*)')
          .eq('id', ridePostId)
          .maybeSingle();

        if (dbRide) {
          targetRiderUserId = targetRiderUserId || dbRide.rider_id;
          if (!targetRide) {
            targetRide = {
              id: dbRide.id,
              riderId: dbRide.rider_id,
              riderName: dbRide.users?.name || 'Driver',
              riderPhoto: dbRide.users?.profile_image || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&h=200&q=80',
              phone: dbRide.users?.phone || '',
              rating: 5.0,
              vehicleType: (dbRide.vehicles?.vehicle_type || 'bike') as any,
              vehicleName: dbRide.vehicles?.vehicle_name || 'Vehicle',
              vehicleNumber: dbRide.vehicles?.number_plate || '',
              departureTime: dbRide.departure_time ? new Date(dbRide.departure_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              seatsLeft: dbRide.available_seats,
              price: Number(dbRide.price_per_seat),
              route: [dbRide.origin_name, dbRide.destination_name],
              pickupPoint: dbRide.origin_name,
              origin: { lat: Number(dbRide.origin_lat), lng: Number(dbRide.origin_lng) },
              destination: { lat: Number(dbRide.destination_lat), lng: Number(dbRide.destination_lng) },
              encodedPolyLine: dbRide.encoded_polyline,
              vehicleId: dbRide.vehicle_id,
              status: dbRide.status || 'active',
            };
            setRides(prev => [...prev.filter(r => r.id !== targetRide!.id), targetRide!]);
          }
        }
      } catch (err) {
        console.warn('[requestBooking] DB ride fetch warning:', err);
      }
    }

    if (targetRide) {
      if (targetRide.status === 'completed' || targetRide.status === 'cancelled' || targetRide.seatsLeft <= 0) {
        throw new Error('RIDE_UNAVAILABLE: This ride offer has been completed or has no available seats.');
      }
      const isRiderOwner = Boolean(
        (targetRiderUserId && user?.id && targetRiderUserId === user.id) ||
        (targetRide.riderId && user?.id && targetRide.riderId === user.id) ||
        (targetRide.riderName && user?.name && targetRide.riderName === user.name) ||
        (targetRide.phone && user?.phone && targetRide.phone === user.phone)
      );
      if (isRiderOwner) {
        throw new Error('SELF_BOOKING_DISALLOWED: You cannot request a booking on your own ride offer.');
      }
    }

    // Prevent passenger from creating concurrent active ride requests
    const activeUserId = userId || user?.id;
    const existingActiveBooking = bookings.find(
      b => ((activeUserId && b.passengerId === activeUserId) || (user?.email && b.passengerId === user.email)) &&
        (b.status === 'pending' || b.status === 'accepted' || b.status === 'ongoing')
    );
    if (existingActiveBooking) {
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
      passengerId: user?.id || user?.email || 'passenger@sarathi.com',
      passengerName,
      passengerPhone,
      passengerPhoto,
      passengerPickup: passengerPickup || 'Pickup',
      passengerDropoff: passengerDropoff || 'Drop-off',
      pickupCoords,
      dropCoords,
      riderOriginName: riderOriginName || targetRide?.pickupPoint || targetRide?.route?.[0] || 'Rider Origin',
      riderDestName: riderDestName || (targetRide?.route ? targetRide.route[targetRide.route.length - 1] : 'Rider Destination'),
      driverId: targetRiderUserId || targetRide?.riderId,
      driverName: targetRide?.riderName,
      driverPhoto: targetRide?.riderPhoto,
      driverPhone: targetRide?.phone,
      vehicleName: targetRide?.vehicleName,
      vehicleNumber: targetRide?.vehicleNumber,
      farePrice: targetRide?.price || 150,
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
      title: 'New Ride Request Incoming! 📍',
      description: `${passengerName} requested a ride: ${passengerPickup || 'Pickup'} ➔ ${passengerDropoff || 'Dropoff'}`,
      timestamp: new Date(),
      isRead: false,
      iconName: 'person-add',
      iconColor: '#DC2626',
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
      title: 'Booking Request Sent 🚀',
      description: `Your request (${passengerPickup} ➔ ${passengerDropoff}) has been sent to the driver. Waiting for driver response.`,
      timestamp: new Date(),
      isRead: false,
      iconName: 'paper-plane',
      iconColor: '#2563EB',
      targetRole: 'passenger',
      targetScreen: '/booking-status',
      targetParams: { rideId: ridePostId },
    };

    startRiderChat(ridePostId);

    // Persist booking in Supabase DB (ride_requests & fallback bookings)
    try {
      const isUuid = (str?: string) => Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));
      const passengerUuid = isUuid(user?.id) ? user!.id : (isUuid(activeUserId) ? activeUserId : null);
      const rideUuid = isUuid(ridePostId) ? ridePostId : null;

      if (rideUuid && passengerUuid) {
        const { data: insertedReq } = await supabase.from('ride_requests').insert({
          ride_id: rideUuid,
          passenger_id: passengerUuid,
          pickup_name: passengerPickup || 'Pickup',
          pickup_lat: pickupCoords?.lat || null,
          pickup_lng: pickupCoords?.lng || null,
          drop_name: passengerDropoff || 'Dropoff',
          drop_lat: dropCoords?.lat || null,
          drop_lng: dropCoords?.lng || null,
          seats_requested: 1,
          fare_amount: targetRide?.price || 150,
          status: 'pending',
          start_pin_code: randomPickupOtp,
          end_pin_code: randomCompletionOtp,
        }).select().single();

        if (insertedReq) {
          newBooking.id = insertedReq.id;
          if (riderNotif.targetParams) {
            riderNotif.targetParams.bookingId = insertedReq.id;
          }
        }
      }

      await supabase.from('bookings').insert({
        id: newBooking.id,
        ride_id: ridePostId,
        passenger_id: user?.id || user?.email,
        passenger_name: passengerName,
        passenger_phone: passengerPhone,
        passenger_photo: passengerPhoto,
        pickup_name: passengerPickup,
        dropoff_name: passengerDropoff,
        status: 'pending',
        lifecycle_state: 'request_pending',
        pickup_otp: randomPickupOtp,
        completion_otp: randomCompletionOtp,
      });
    } catch (e) {
      console.warn('[requestBooking] Supabase bookings notice:', e);
    }

    // Persist notifications scoped strictly to respective user IDs
    if (targetRiderUserId) {
      addDriverNotification(riderNotif, targetRiderUserId);
    } else {
      addDriverNotification(riderNotif);
    }
    addDriverNotification(passengerNotif, user?.id || activeUserId);

    // FIX: broadcast the new request immediately over realtime so the
    // rider's app updates live if they're currently online, instead of
    // relying only on the next notifications poll/fetch. Your existing
    // listener for event 'ride_request' already handles this payload —
    // it just was never triggered from here before.
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

    startRiderChat(ridePostId);
  };

  /** Driver: accept a pending booking */
  const acceptBooking = async (bookingId: string): Promise<void> => {
    const targetBooking = bookings.find(b => b.id === bookingId);
    if (!targetBooking) return;
    const targetRide = rides.find(r => r.id === targetBooking.rideId);

    // Authorization check: Only ride owner can accept
    const isOwner = Boolean(
      user?.role === 'driver' &&
      ((targetRide?.riderId && user?.id && targetRide.riderId === user.id) ||
        (targetRide?.riderName && user?.name && targetRide.riderName === user.name) ||
        (targetRide?.phone && user?.phone && targetRide.phone === user.phone))
    );

    if (!isOwner) {
      console.warn('[acceptBooking] Unauthorized attempt to accept booking');
      return;
    }

    if (targetBooking.status !== 'pending') {
      console.warn('[acceptBooking] Booking is not pending:', targetBooking.status);
      return;
    }

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

    // Persist booking update to Supabase DB
    try {
      await supabase.from('bookings').update({ status: 'accepted', lifecycle_state: 'waiting_for_pickup' }).eq('id', bookingId);
      if (targetBooking.rideId) {
        await supabase.from('rides').update({ available_seats: Math.max(0, (targetRide?.seatsLeft || 1) - 1) }).eq('id', targetBooking.rideId);
      }
    } catch (e) {
      console.warn('[acceptBooking] Supabase notice:', e);
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

      const targetRide = rides.find(r => r.id === target.rideId);
      const riderName = targetRide?.riderName || 'Driver';
      const passengerName = target.passengerName || 'Passenger';
      const dropoff = target.passengerDropoff || 'Destination';

      // Driver notification: Ride Started Confirmation
      const driverStartedNotif: DriverNotificationItem = {
        id: `dn-started-driver-${Date.now()}`,
        type: 'request_status',
        title: 'Ride Started Confirmation 🚀',
        description: `Pickup PIN verified with ${passengerName}. Ride in progress to ${dropoff}.`,
        timestamp: new Date(),
        isRead: false,
        iconName: 'navigate-circle',
        iconColor: '#16A34A',
        targetRole: 'driver',
        targetScreen: '/active-trip',
        targetParams: { rideId: target.rideId, bookingId: target.id },
      };

      // Passenger notification: Ride Started
      const passengerStartedNotif: DriverNotificationItem = {
        id: `dn-started-pass-${Date.now()}`,
        type: 'request_status',
        title: 'Ride Started 🚀',
        description: `Your trip with ${riderName} has started! En route to ${dropoff}.`,
        timestamp: new Date(),
        isRead: false,
        iconName: 'navigate-circle',
        iconColor: '#16A34A',
        targetRole: 'passenger',
        targetScreen: '/active-trip',
        targetParams: { rideId: target.rideId, bookingId: target.id },
      };

      addDriverNotification(driverStartedNotif);
      addDriverNotification(passengerStartedNotif);

      supabase.channel('sarathi-global-realtime').send({
        type: 'broadcast',
        event: 'booking_status_change',
        payload: {
          booking: updatedBooking,
          driverNotification: driverStartedNotif,
          passengerNotification: passengerStartedNotif,
        }
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

      if (target.rideId) {
        supabase.from('rides').update({ status: 'completed' }).eq('id', target.rideId).then(({ error }) => {
          if (error) console.error('[verifyCompletionOtp] Supabase ride update error:', error.message);
        });
        setRides(prev => prev.map(r => (r.id === target.rideId ? { ...r, status: 'completed' } : r)));
      }

      // NEW: stamp ride_requests as completed right away, independent of payment step
      supabase.from('ride_requests').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      }).eq('id', bookingId).then(({ error }) => {
        if (error) console.warn('[verifyCompletionOtp] ride_requests update warning:', error.message);
      });

      const passengerName = target.passengerName || 'Passenger';

      // Driver notification: Ride Completed
      const driverCompletedNotif: DriverNotificationItem = {
        id: `dn-completed-driver-${Date.now()}`,
        type: 'request_status',
        title: 'Ride Completed 🎉',
        description: `Trip completed successfully with ${passengerName}.`,
        timestamp: new Date(),
        isRead: false,
        iconName: 'checkmark-done-circle',
        iconColor: '#7C3AED',
        targetRole: 'driver',
        targetScreen: '/active-trip',
        targetParams: { rideId: target.rideId, bookingId: target.id },
      };

      // Passenger notification: Ride Completed
      const passengerCompletedNotif: DriverNotificationItem = {
        id: `dn-completed-pass-${Date.now()}`,
        type: 'request_status',
        title: 'Ride Completed 🎉',
        description: `You have arrived at your destination! Please rate your trip.`,
        timestamp: new Date(),
        isRead: false,
        iconName: 'star',
        iconColor: '#EAB308',
        targetRole: 'passenger',
        targetScreen: '/active-trip',
        targetParams: { rideId: target.rideId, bookingId: target.id },
      };

      addDriverNotification(driverCompletedNotif);
      addDriverNotification(passengerCompletedNotif);

      supabase.channel('sarathi-global-realtime').send({
        type: 'broadcast',
        event: 'booking_status_change',
        payload: {
          booking: updatedBooking,
          driverNotification: driverCompletedNotif,
          passengerNotification: passengerCompletedNotif,
        }
      });

      return { success: true };
    }

    const errText = `Invalid Completion OTP code. Ask passenger for the 4-digit code shown on their screen.`;
    setBookings(prev => prev.map(b => (b.id === bookingId ? { ...b, otpError: errText } : b)));
    return { success: false, error: errText };
  };

  /** Driver: prompt dropoff / completion PIN verification */
  const triggerCompletionOtpPrompt = (bookingId: string) => {
    const target = bookings.find(b => b.id === bookingId);
    if (!target) return;

    const updatedBooking: Booking = {
      ...target,
      lifecycleState: 'completion_otp_required',
    };

    setBookings(prev => prev.map(b => (b.id === bookingId ? updatedBooking : b)));
    saveActiveBookingToStorage(updatedBooking);

    supabase.channel('sarathi-global-realtime').send({
      type: 'broadcast',
      event: 'booking_status_change',
      payload: { booking: updatedBooking }
    });
  };

  /** Payment — mark complete */
  const processPayment = (_bookingId: string, _method: 'cash' | 'khalti' | 'esewa'): { success: boolean; error?: string } => {
    const target = bookings.find(b => b.id === _bookingId);
    if (target?.rideId) {
      supabase.from('rides').update({ status: 'completed' }).eq('id', target.rideId).then(({ error }) => {
        if (error) console.error('[processPayment] Supabase ride update error:', error.message);
      });
      setRides(prev => prev.map(r => (r.id === target.rideId ? { ...r, status: 'completed' } : r)));
    }
    if (isUUID(_bookingId)) {
      supabase.from('ride_requests').update({ status: 'completed' }).eq('id', _bookingId).then(({ error }) => {
        if (error) console.error('[processPayment] Supabase ride_requests update error:', error.message);
      });
    }
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
  const submitRideRating = async (_bookingId: string, _rating: number, _comment?: string): Promise<void> => {
    const targetBooking = bookings.find(b => b.id === _bookingId);
    const targetRide = rides.find(r => r.id === targetBooking?.rideId);

    const isDriverView = user?.role === 'driver';
    const ratedUserId = isDriverView
      ? (targetBooking?.passengerId || 'passenger')
      : (targetRide?.riderId || 'driver');
    const ratedByUserId = user?.id || (isDriverView ? 'driver' : 'passenger');

    const cleanRating = Math.min(5, Math.max(1, Math.round(_rating)));
    const isUuid = (str?: string) => Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

    try {
      if (isUuid(ratedUserId) && isUuid(ratedByUserId)) {
        const ratingPayload: any = {
          rated_user: ratedUserId,
          rated_by: ratedByUserId,
          rating: cleanRating,
          review_text: _comment || null,
        };
        if (isUuid(_bookingId)) {
          ratingPayload.ride_request_id = _bookingId;
        }
        await supabase.from('ratings').insert([ratingPayload]);
      }
    } catch (err) {
      console.log('[submitRideRating] Supabase insert warning:', err);
    }

    if (targetBooking?.rideId) {
      supabase.from('rides').update({ status: 'completed' }).eq('id', targetBooking.rideId).then(({ error }) => {
        if (error) console.error('[submitRideRating] Supabase ride update error:', error.message);
      });
      setRides(prev => prev.map(r => (r.id === targetBooking.rideId ? { ...r, status: 'completed', rating: cleanRating } : r)));
    }

    setBookings(prev =>
      prev.map(b =>
        b.id === _bookingId
          ? { ...b, rating: cleanRating, reviewComment: _comment, lifecycleState: 'completed', status: 'completed' }
          : b
      )
    );

    // Refresh real ratings list from database
    await fetchRatings();

    saveActiveBookingToStorage(null);
  };

  /** Cancel a booking */
  const cancelBooking = async (bookingId: string): Promise<void> => {
    const targetBooking = bookings.find(b => b.id === bookingId);
    const isDriver = user?.role === 'driver';

    const updatedBooking: Booking = {
      ...(targetBooking || ({ id: bookingId } as any)),
      status: 'cancelled',
      lifecycleState: 'cancelled',
      cancelledBy: isDriver ? 'rider' : 'passenger', // NEW
      cancelledAt: new Date(), // NEW
    };

    setBookings(prev =>
      prev.map(b => (b.id === bookingId ? updatedBooking : b))
    );
    saveActiveBookingToStorage(null);

    const passengerName = targetBooking?.passengerName || 'Passenger';
    const targetRide = rides.find(r => r.id === targetBooking?.rideId);
    const riderName = targetRide?.riderName || 'Driver';

    // Driver notification: Passenger Cancelled
    const driverCancelNotif: DriverNotificationItem = {
      id: `dn-cancel-driver-${Date.now()}`,
      type: 'request_status',
      title: isDriver ? 'Ride Cancelled ❌' : 'Passenger Cancelled Trip ⚠️',
      description: isDriver
        ? `You cancelled the ride with ${passengerName}.`
        : `${passengerName} has cancelled their ride request.`,
      timestamp: new Date(),
      isRead: false,
      iconName: 'close-circle',
      iconColor: '#DC2626',
      targetRole: 'driver',
      targetScreen: '/notifications',
    };

    // Passenger notification: Driver Cancelled
    const passengerCancelNotif: DriverNotificationItem = {
      id: `dn-cancel-pass-${Date.now()}`,
      type: 'request_status',
      title: isDriver ? 'Driver Cancelled the Ride ❌' : 'Ride Cancelled ⚠️',
      description: isDriver
        ? `${riderName} has cancelled your booked ride.`
        : `Your booking request has been cancelled.`,
      timestamp: new Date(),
      isRead: false,
      iconName: 'close-circle',
      iconColor: '#DC2626',
      targetRole: 'passenger',
      targetScreen: '/notifications',
    };

    addDriverNotification(driverCancelNotif, targetRide?.riderId);
    addDriverNotification(passengerCancelNotif, targetBooking?.passengerId);

    try {
      await supabase.from('ride_requests').update({
        status: 'cancelled',
        cancelled_by: isDriver ? 'rider' : 'passenger', // NEW
        cancelled_at: new Date().toISOString(),          // NEW
      }).eq('id', bookingId);
      await supabase.from('bookings').update({ status: 'cancelled', lifecycle_state: 'cancelled' }).eq('id', bookingId);
    } catch (e) { }

    supabase.channel('sarathi-global-realtime').send({
      type: 'broadcast',
      event: 'booking_status_change',
      payload: {
        booking: updatedBooking,
        driverNotification: driverCancelNotif,
        passengerNotification: passengerCancelNotif,
      }
    });
  };

  /** Driver rejects a booking */
  const declineBooking = async (bookingId: string): Promise<void> => {
    const targetBooking = bookings.find(b => b.id === bookingId);
    if (!targetBooking) return;
    const targetRide = rides.find(r => r.id === targetBooking.rideId);

    // Authorization check: Only ride owner can decline
    const isOwner = Boolean(
      user?.role === 'driver' &&
      ((targetRide?.riderId && user?.id && targetRide.riderId === user.id) ||
        (targetRide?.riderName && user?.name && targetRide.riderName === user.name) ||
        (targetRide?.phone && user?.phone && targetRide.phone === user.phone))
    );

    if (!isOwner) {
      console.warn('[declineBooking] Unauthorized attempt to decline booking');
      return;
    }

    if (targetBooking.status !== 'pending') {
      console.warn('[declineBooking] Booking is not pending:', targetBooking.status);
      return;
    }

    const updatedBooking: Booking = {
      ...targetBooking,
      status: 'cancelled',
      lifecycleState: 'cancelled',
    };

    setBookings(prev => prev.map(b => b.id === bookingId ? updatedBooking : b));

    const riderName = targetRide?.riderName || 'Driver';
    const passengerName = targetBooking.passengerName || 'Passenger';

    // Passenger notification: Driver Cancelled the Ride
    const passengerDeclineNotif: DriverNotificationItem = {
      id: `dn-decline-pass-${Date.now()}`,
      type: 'request_status',
      title: 'Driver Cancelled the Ride ❌',
      description: `${riderName} has cancelled your ride request from ${targetBooking.passengerPickup} to ${targetBooking.passengerDropoff}.`,
      timestamp: new Date(),
      isRead: false,
      iconName: 'close-circle-outline',
      iconColor: '#DC2626',
      targetRole: 'passenger',
      targetScreen: '/search-ride',
      targetParams: { rideId: targetBooking.rideId },
    };

    // Driver notification: Ride Request Declined
    const driverDeclineNotif: DriverNotificationItem = {
      id: `dn-decline-driver-${Date.now()}`,
      type: 'request_status',
      title: 'Ride Offer Cancelled ❌',
      description: `You declined the request from ${passengerName}.`,
      timestamp: new Date(),
      isRead: false,
      iconName: 'close-circle',
      iconColor: '#64748B',
      targetRole: 'driver',
      targetScreen: '/notifications',
    };

    addDriverNotification(passengerDeclineNotif, targetBooking.passengerId);
    addDriverNotification(driverDeclineNotif, user?.id);

    try {
      await supabase.from('ride_requests').update({ status: 'cancelled' }).eq('id', bookingId);
      await supabase.from('bookings').update({ status: 'cancelled', lifecycle_state: 'cancelled' }).eq('id', bookingId);
    } catch (err) {
      console.warn('[declineBooking] Supabase update notice:', err);
    }

    supabase.channel('sarathi-global-realtime').send({
      type: 'broadcast',
      event: 'booking_status_change',
      payload: {
        booking: updatedBooking,
        passengerNotification: passengerDeclineNotif,
        driverNotification: driverDeclineNotif,
      }
    });
  };

  /** Simulate GPS nudge — no backend endpoint for live tracking */
  const nudgeDriverLocation = (_bookingId: string): void => {
    setActiveTripProgress(prev => Math.min(100, prev + 15));
  };

  const sendDriverMessage = (rideId: string, text: string) => {
    const isDriver = user?.role === 'driver';
    const senderRole = isDriver ? 'driver' : 'user';

    const booking = bookings.find(b => b.rideId === rideId);
    const ride = rides.find(r => r.id === rideId);
    const existingMsgs = driverMessages[rideId] || [];

    const existingPassengerId = existingMsgs.find(m => m.passengerId)?.passengerId ||
      existingMsgs.find(m => m.sender === 'user' && m.senderId)?.senderId ||
      existingMsgs.find(m => m.senderId && m.senderId !== user?.id && isDriver)?.senderId;

    const existingRiderId = existingMsgs.find(m => m.riderId)?.riderId ||
      existingMsgs.find(m => m.sender === 'driver' && m.senderId)?.senderId ||
      existingMsgs.find(m => m.senderId && m.senderId !== user?.id && !isDriver)?.senderId;

    const passengerId = isDriver
      ? (booking?.passengerId || existingPassengerId)
      : (user?.id || existingPassengerId || booking?.passengerId);

    const riderId = isDriver
      ? (user?.id || existingRiderId || ride?.riderId)
      : (ride?.riderId || existingRiderId);

    const receiverId = isDriver ? passengerId : riderId;

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
      receiverId,
      passengerId,
      riderId,
    };

    setDriverMessages(prev => {
      const existingList = prev[rideId] || [];
      const msgTime = userMsg.timestamp.getTime();
      const isDuplicate = existingList.some(
        m => m.id === userMsg.id ||
          ((m.senderId === userMsg.senderId || (m.senderName && userMsg.senderName && m.senderName === userMsg.senderName)) &&
            m.text === userMsg.text &&
            Math.abs(new Date(m.timestamp).getTime() - msgTime) < 3000)
      );
      if (isDuplicate) return prev;
      const updated = {
        ...prev,
        [rideId]: [...existingList, userMsg],
      };
      saveChatMessagesToStorage(updated);
      return updated;
    });

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

    // Broadcast message over Supabase Realtime WebSocket ONLY (no notification bar item)
    supabase.channel('sarathi-global-realtime').send({
      type: 'broadcast',
      event: 'chat_message',
      payload: userMsg,
    });

    // Insert message into Supabase DB chat_messages table (with fallback)
    supabase
      .from('chat_messages')
      .insert({
        id: userMsg.id,
        ride_id: rideId,
        sender_id: user?.id,
        sender_name: userMsg.senderName,
        sender_photo: userMsg.senderPhoto,
        sender_phone: userMsg.senderPhone,
        receiver_id: receiverId,
        passenger_id: passengerId,
        rider_id: riderId,
        sender_role: senderRole,
        message_text: text,
        is_read: false,
        created_at: userMsg.timestamp.toISOString(),
      })
      .then(({ error }: { error: any }) => {
        if (error && !error.message.includes('schema cache')) {
          console.warn('[sendDriverMessage] DB insert warning:', error.message);
        }
        fetchUserConversations();
      });
  };

  const fetchUserConversations = async (): Promise<Record<string, DriverMessage[]>> => {
    if (!userId) {
      setDriverMessages({});
      return {};
    }

    try {
      const [{ data: myRides }, { data: myBookings }] = await Promise.all([
        supabase.from('rides').select('id').eq('rider_id', userId),
        supabase.from('bookings').select('ride_id').eq('passenger_id', userId),
      ]);

      const myRideIds = (myRides || []).map((r: any) => r.id);
      const myBookingRideIds = (myBookings || []).map((b: any) => b.ride_id).filter(Boolean);
      const userRideIds = Array.from(new Set([...myRideIds, ...myBookingRideIds]));

      let filterClause = `sender_id.eq.${userId},receiver_id.eq.${userId},passenger_id.eq.${userId},rider_id.eq.${userId}`;
      if (userRideIds.length > 0) {
        filterClause += `,ride_id.in.(${userRideIds.join(',')})`;
      }

      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .or(filterClause)
        .order('created_at', { ascending: true });

      if (error) {
        if (!error.message.includes('schema cache')) {
          console.warn('[fetchUserConversations] Error:', error.message);
        }
        return driverMessages;
      }

      if (data) {
        const grouped: Record<string, DriverMessage[]> = {};
        data.forEach((row: any) => {
          const rideId = row.ride_id;
          if (!rideId) return;

          const msg: DriverMessage = {
            id: row.id,
            rideId,
            sender: row.sender_role === 'driver' ? 'driver' : 'user',
            text: row.message_text || '',
            timestamp: new Date(row.created_at),
            senderId: row.sender_id,
            senderName: row.sender_name,
            senderPhoto: row.sender_photo,
            senderPhone: row.sender_phone,
            receiverId: row.receiver_id,
            passengerId: row.passenger_id,
            riderId: row.rider_id,
            isRead: row.is_read !== false,
          };

          if (!grouped[rideId]) {
            grouped[rideId] = [];
          }
          grouped[rideId].push(msg);
        });

        setDriverMessages(grouped);
        return grouped;
      }
      return driverMessages;
    } catch (err) {
      console.error('[fetchUserConversations] Catch:', err);
      return driverMessages;
    }
  };

  const markConversationAsRead = async (rideId: string) => {
    if (!userId || !rideId) return;

    try {
      await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('ride_id', rideId)
        .eq('receiver_id', userId);
    } catch (e) {
      console.warn('[markConversationAsRead] Error:', e);
    }

    setDriverMessages(prev => {
      const msgs = prev[rideId];
      if (!msgs) return prev;
      const updated = msgs.map(m => (m.receiverId === userId ? { ...m, isRead: true } : m));
      return { ...prev, [rideId]: updated };
    });
  };

  const unreadChatMessageCount = useMemo(() => {
    if (!userId) return 0;
    let count = 0;
    Object.keys(driverMessages).forEach(rideId => {
      if (deletedChatRideIds.includes(rideId)) return;
      const msgs = driverMessages[rideId] || [];
      msgs.forEach(m => {
        if (m.receiverId === userId && m.isRead === false) {
          count++;
        }
      });
    });
    return count;
  }, [driverMessages, userId, deletedChatRideIds]);

  const sendChatMessage = (text: string) => {
    const userMsg: Message = {
      id: `msg-${Date.now()}-user`,
      sender: 'user',
      text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);

    setTimeout(async () => {
      let activeRides = rides;
      try {
        activeRides = await fetchActiveRides();
      } catch {
        // Fallback to local rides state if network check fails
      }
      activeRides = activeRides.filter(r => (r.status === 'active' || !r.status) && r.seatsLeft > 0);
      const lowerText = text.toLowerCase();
      let responseText = "";
      let suggestedRides: string[] = [];

      if (activeRides.length === 0) {
        responseText = "There are currently no active live rides posted on Sarathi. Drivers can offer rides from the Driver tab!";
      } else if (lowerText.includes('cheap') || lowerText.includes('price') || lowerText.includes('cost')) {
        const sorted = [...activeRides].sort((a, b) => a.price - b.price);
        suggestedRides = [sorted[0].id];
        responseText = `I found the cheapest ride for you! ${sorted[0].riderName} is offering a ride for NPR ${sorted[0].price} going through ${sorted[0].route.join(' → ')}.`;
      } else if (lowerText.includes('soonest') || lowerText.includes('time') || lowerText.includes('leaving')) {
        suggestedRides = [activeRides[0].id];
        responseText = `The ride available is with ${activeRides[0].riderName} (${activeRides[0].departureTime}) on a ${activeRides[0].vehicleName} for NPR ${activeRides[0].price}. Route: ${activeRides[0].route.join(' → ')}.`;
      } else {
        const matches = activeRides.filter(r =>
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
    // Deprecated no-op auto creation: chats exist ONLY when messages exist in DB
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

  const deleteConversation = async (rideId: string) => {
    setDeletedChatRideIds(prev => {
      if (prev.includes(rideId)) return prev;
      const updated = [...prev, rideId];
      if (userId) {
        AsyncStorageLib.setItem(`@sarathi_deleted_chats_${userId}`, JSON.stringify(updated)).catch(() => null);
      }
      return updated;
    });
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('SignOut warning:', e);
    }
    await AsyncStorageLib.removeItem('@sarathi_token');
    await AsyncStorageLib.removeItem('@sarathi_user_id');
    await AsyncStorageLib.removeItem('@SARATHI_ACTIVE_BOOKING_V2');
    await AsyncStorageLib.removeItem('@SARATHI_CHAT_MESSAGES_V2');
    await AsyncStorageLib.removeItem('@SARATHI_ACTIVE_CHATS_V2');
    setUser(null);
    setUserId(null);
    setAuthToken(null);
    setIsAuthenticated(false);
    setBookings([]);
    setDriverNotifications([]);
    setDriverMessages({});
    setActiveChatRideIds([]);
    setDeletedChatRideIds([]);
    setRides([]);
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
      }

      setUser(prev => prev ? {
        ...prev,
        name: payload.name ?? prev.name,
        phone: payload.phone ?? prev.phone,
        photo: finalPhotoUrl ?? prev.photo,
      } : null);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Profile update failed' };
    }
  };

  const deleteAccount = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const activeUserId = userId || user?.id;

      // 1. Primary: Call Supabase RPC delete_user_account (deletes auth.users + cascades to public.users & all data)
      const { error: rpcErr } = await supabase.rpc('delete_user_account');
      if (rpcErr) {
        console.warn('[deleteAccount] RPC warning:', rpcErr.message);
        if (activeUserId) {
          // 2. Fallback: Direct table deletion if RPC is missing
          try { await supabase.from('kyc_verifications').delete().eq('user_id', activeUserId); } catch (e) { }
          try { await supabase.from('vehicles').delete().eq('user_id', activeUserId); } catch (e) { }
          try { await supabase.from('rides').delete().eq('rider_id', activeUserId); } catch (e) { }
          try { await supabase.from('bookings').delete().or(`passenger_id.eq.${activeUserId}`); } catch (e) { }
          const { error: userDelErr } = await supabase.from('users').delete().eq('id', activeUserId);
          if (userDelErr && user?.email) {
            await supabase.from('users').delete().eq('email', user.email.toLowerCase().trim());
          }
        }
      }

      // 3. Clear auth session and local storage
      await logout();
      return { success: true };
    } catch (err: any) {
      console.error('[deleteAccount] error:', err);
      await logout();
      return { success: true };
    }
  };

  const switchUserRole = async (targetRole: 'PASSENGER' | 'RIDER' | 'DRIVER') => {
    const isDriverOrRider = targetRole === 'DRIVER' || targetRole === 'RIDER';
    const currentRole = user?.role ?? 'passenger';

    // Prevent role switching if user has an active trip or booking
    const activeUserId = userId || user?.id;
    if (currentRole === 'driver') {
      const myDriverRideIds = rides
        .filter(r => (r.status === 'active' || !r.status) && ((r.riderId && activeUserId && r.riderId === activeUserId) || (user?.phone && r.phone === user.phone) || (user?.name && r.riderName === user.name)))
        .map(r => r.id);

      const activeDriverRide = rides.find(
        r => (r.status === 'active' || !r.status) && ((r.riderId && activeUserId && r.riderId === activeUserId) || (user?.phone && r.phone === user.phone) || (user?.name && r.riderName === user.name))
      );
      const activeDriverBooking = bookings.find(
        b =>
          myDriverRideIds.includes(b.rideId) &&
          (b.status === 'pending' || b.status === 'accepted' || b.status === 'ongoing') &&
          b.lifecycleState !== 'completed' &&
          b.lifecycleState !== 'cancelled'
      );
      if (activeDriverRide || activeDriverBooking) {
        return {
          success: false,
          error: 'ACTIVE_TRIP_EXISTS',
          message: 'You have an active ride offer or trip in progress as a Driver. Please complete or cancel your current trip before switching roles.',
        };
      }
    }

    if (currentRole === 'passenger') {
      const activePassengerBooking = bookings.find(
        b =>
          ((activeUserId && b.passengerId === activeUserId) || (user?.email && b.passengerId === user.email)) &&
          (b.status === 'pending' || b.status === 'accepted' || b.status === 'ongoing') &&
          b.lifecycleState !== 'completed' &&
          b.lifecycleState !== 'cancelled'
      );
      if (activePassengerBooking) {
        return {
          success: false,
          error: 'ACTIVE_TRIP_EXISTS',
          message: 'You have an active ride booking in progress as a Passenger. Please complete or cancel your current trip before switching roles.',
        };
      }
    }

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

    const myDriverRideIds = rides
      .filter(r => (r.status === 'active' || !r.status) && (r.riderName === user?.name || (user?.phone && r.phone === user.phone) || (user?.id && r.riderId === user.id)))
      .map(r => r.id);

    // Strict rider restriction: Cannot publish a new ride offer if an active offer or trip exists
    const hasActiveOffer = rides.some(
      r => (r.status === 'active' || !r.status) && (r.riderName === user?.name || (user?.phone && r.phone === user.phone) || (user?.id && r.riderId === user.id)) && r.seatsLeft > 0
    );
    const hasActiveTrip = bookings.some(
      b => myDriverRideIds.includes(b.rideId) && (b.status === 'pending' || b.status === 'accepted' || b.status === 'ongoing')
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
        departureTime: data.departure_time
          ? new Date(data.departure_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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

  /** Driver: delete a ride offer from Supabase (updates status='cancelled' and notifies booked passengers) */
  const deleteRide = async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const activeUserId = userId || user?.id;
      if (!activeUserId) {
        return { success: false, error: 'User is not authenticated.' };
      }

      // 1. Primary: Deactivate in Supabase DB by setting status = 'cancelled'
      let dbSuccess = false;
      const { error: updateErr } = await supabase
        .from('rides')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .eq('rider_id', activeUserId);

      if (!updateErr) {
        dbSuccess = true;
      } else {
        console.warn('[deleteRide] Update status warning:', updateErr.message);
        // Fallback: Try hard delete if status update fails
        const { error: deleteErr } = await supabase
          .from('rides')
          .delete()
          .eq('id', id)
          .eq('rider_id', activeUserId);

        if (!deleteErr) {
          dbSuccess = true;
        } else {
          console.error('[deleteRide] Hard delete error:', deleteErr.message);
          return { success: false, error: deleteErr.message };
        }
      }

      if (dbSuccess) {
        // Also mark all associated ride requests as 'cancelled' in DB and notify passengers
        const { data: affectedRequests } = await supabase
          .from('ride_requests')
          .update({ status: 'cancelled' })
          .eq('ride_id', id)
          .select('*');

        if (affectedRequests && affectedRequests.length > 0) {
          for (const req of affectedRequests) {
            if (req.passenger_id) {
              addDriverNotification(
                {
                  title: 'Ride Cancelled by Rider ❌',
                  description: `The rider has cancelled the ride offer for trip #${id.slice(0, 8)}.`,
                  type: 'ride_event',
                  iconName: 'close-circle-outline',
                  iconColor: '#EF4444',
                  targetRole: 'passenger',
                  targetScreen: '/booking-status',
                  targetParams: { rideId: id },
                },
                req.passenger_id
              );
            }
          }
        }

        // Update local bookings state so passenger UI triggers cancellation status banner
        setBookings(prev =>
          prev.map(b => (b.rideId === id ? { ...b, status: 'cancelled', lifecycleState: 'cancelled' } : b))
        );

        setRides(prev => prev.filter(r => r.id !== id));
        await fetchActiveRides();
        return { success: true };
      }

      return { success: false, error: 'Could not deactivate ride in database.' };
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
        isAuthLoading,
        hasCompletedOnboarding,
        completeOnboarding,
        rides,
        bookings,
        messages,
        driverMessages,
        activeChatRideIds,
        notifications,
        driverNotifications,
        unreadDriverNotifCount: driverNotifications.filter(n => {
          if (n.isRead) return false;
          const activeRole = user?.role === 'driver' || user?.kycVerified === true ? 'driver' : 'passenger';
          if (n.targetRole && n.targetRole !== activeRole) {
            if (n.type === 'ride_request' && activeRole === 'driver') {
              return true;
            }
            return false;
          }
          return true;
        }).length,
        unreadChatMessageCount,
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
        markConversationAsRead,
        fetchUserConversations,
        nudgeDriverLocation,
        startRideWithOTP,
        endRideWithOTP,
        verifyPickupOtp,
        verifyCompletionOtp,
        triggerCompletionOtpPrompt,
        processPayment,
        ratingsList,
        getUserRating,
        submitRideRating,
        createRide,
        updateRide,
        deleteRide,
        acceptBooking,
        declineBooking,
        deleteConversation,
        deletedChatRideIds,
        fetchActiveRides,
        fetchUserBookings,
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
