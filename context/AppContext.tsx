import { default as AsyncStorage, default as AsyncStorageLib } from '@react-native-async-storage/async-storage';
import { User } from '@supabase/supabase-js';
import * as Location from 'expo-location';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import {
  triggerMobilePushNotification
} from '../services/notificationService';
// NOTE: rideService and bookingService API calls are intentionally disabled.
// Ride/booking functionality is being rebuilt — these will be re-enabled in a later pass.
import { deleteUser, getUser, loginUser, signupUser, switchRole, updateUser, uploadKycDocument, verifyKycStatus } from '../services/userService';

import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

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
  ecodedPolyLine?: string;
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
  supabaseUser: User | null;
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
  completeProfile: (profile: Partial<UserProfile>) => void;
  updateEmergencyContact: (contact: string) => void;
  updateUserProfile: (payload: { name?: string; email?: string; phone?: string; avatarUrl?: string }) => Promise<{ success: boolean; error?: string }>;
  deleteAccount: () => Promise<{ success: boolean; error?: string }>;
  switchUserRole: (targetRole: 'PASSENGER' | 'RIDER' | 'DRIVER') => Promise<{ success: boolean; error?: string }>;
  uploadUserKycDocument: (documentType: string, document: string, file: string) => Promise<{ success: boolean; error?: string }>;
  submitKycVerify: () => Promise<{ success: boolean; error?: string }>;
  requestBooking: (rideId: string, passengerPickup?: string, passengerDropoff?: string) => void;
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
  createRide: (ride: Omit<Ride, 'id' | 'riderName' | 'riderPhoto' | 'rating'>) => void;
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
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
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
  // Load and fetch device location once at app startup
  useEffect(() => {
    (async () => {
      try {
        // Load cached location first
        const cached = await AsyncStorage.getItem('@device_location');
        if (cached) {
          setDeviceLocation(cached);
        }

        // Fetch exact current location
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          return;
        }

        let location = null;
        try {
          location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
        } catch (locErr) {
          console.warn('[AppContext] getCurrentPositionAsync failed, trying last known position:', locErr);
          try {
            location = await Location.getLastKnownPositionAsync();
          } catch (lastLocErr) {
            console.warn('[AppContext] getLastKnownPositionAsync also failed:', lastLocErr);
          }
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

        const storedToken = await AsyncStorage.getItem('@sarathi_auth_token');
        const storedUserId = await AsyncStorage.getItem('@sarathi_user_id');
        if (storedToken) setAuthToken(storedToken);
        if (storedUserId) setUserId(storedUserId);

        const savedUser = await AsyncStorage.getItem('@sarathi_user');
        if (savedUser) setUser(JSON.parse(savedUser));

        // If we have a user ID and token, refresh user details from backend
        if (storedUserId && storedToken) {
          try {
            const fetched = await getUser(storedUserId, storedToken);
            if (fetched.success && fetched.data) {
              const userData = fetched.data;
              setUser(prev => ({
                name: userData.name || prev?.name || 'User',
                email: userData.email || prev?.email || '',
                phone: userData.phone || prev?.phone || '',
                role: (userData.activeRole || userData.role || '').toUpperCase() === 'DRIVER' || (userData.activeRole || userData.role || '').toUpperCase() === 'RIDER' ? 'driver' : 'passenger',
                collegeOrCompany: prev?.collegeOrCompany || 'N/A',
                emergencyContact: prev?.emergencyContact || '',
                rating: prev?.rating ?? 5.0,
                photo: userData.avatarUrl || prev?.photo || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&h=200&q=80',
                kycVerified: userData.kycVerified ?? prev?.kycVerified,
                kycStatus: userData.kycStatus || (userData.kycVerified ? 'VERIFIED' : prev?.kycStatus),
              }));
            }
            // Booking load from backend disabled — will be re-enabled when booking logic is rebuilt.
          } catch (err) {
            console.log('[AppContext] Failed to refresh user on startup:', err);
          }
        }
      } catch (error) {
        console.error('Error loading stored state:', error);
      }
    })();
  }, []);

  // Listen for Supabase auth state changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setSupabaseUser(session.user);
        setIsAuthenticated(true);
        setUser(prev => prev || {
          name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
          phone: session.user.user_metadata?.phone || '',
          email: session.user.email || '',
          role: session.user.user_metadata?.role || 'passenger',
          collegeOrCompany: session.user.user_metadata?.college_or_company || 'N/A',
          emergencyContact: '',
          rating: 5.0,
          photo: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&h=200&q=80',
        });
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setSupabaseUser(session.user);
        setIsAuthenticated(true);
        setUser(prev => prev || {
          name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
          phone: session.user.user_metadata?.phone || '',
          email: session.user.email || '',
          role: session.user.user_metadata?.role || 'passenger',
          collegeOrCompany: session.user.user_metadata?.college_or_company || 'N/A',
          emergencyContact: '',
          rating: 5.0,
          photo: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&h=200&q=80',
        });
      } else {
        setSupabaseUser(null);
        setIsAuthenticated(false);
        setUser(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Poll simulator and GPS simulation loop removed — booking/ride logic being rebuilt.

  const login = async (email: string, password?: string) => {
    if (!password) {
      // No password — mock/guest session
      setUser({
        name: '',
        phone: '',
        email: email || '',
        role: 'passenger',
        collegeOrCompany: '',
        emergencyContact: '',
        rating: 0,
        photo: '',
      });
      setIsAuthenticated(true);
      return { success: true };
    }

    // ── 1. Call Sarathi backend (/api/user/login) ──────────────────────────
    try {
      const apiResult = await loginUser({ email, password });

      if (!apiResult.success) {
        return { success: false, error: apiResult.error || 'Login failed. Check your credentials.' };
      }

      // Login response only contains { accessToken, refreshToken }
      const rawData = apiResult.data as any;
      const accessToken = rawData?.accessToken || rawData?.data?.accessToken || rawData?.token;
      const refreshToken = rawData?.refreshToken || rawData?.data?.refreshToken;

      if (!accessToken) {
        return { success: false, error: 'Login failed: no token received.' };
      }

      // Decode JWT to extract userId (stored as sub, id, or userId in payload)
      const jwtPayload = decodeJwtPayload(accessToken);
      const uid = jwtPayload?.sub || jwtPayload?.id || jwtPayload?.userId || jwtPayload?.user_id;

      console.log('[login] JWT payload:', JSON.stringify(jwtPayload));
      console.log('[login] resolved uid:', uid);

      // Persist token + userId
      await AsyncStorageLib.setItem('@sarathi_token', accessToken);
      await AsyncStorageLib.setItem('@sarathi_auth_token', accessToken);
      setAuthToken(accessToken);
      if (refreshToken) await AsyncStorageLib.setItem('@sarathi_refresh_token', refreshToken);

      // ── 2. Fetch full user profile using userId from JWT ──────────────────
      let fetchedUser: any = null;
      if (uid) {
        await AsyncStorageLib.setItem('@sarathi_user_id', uid);
        setUserId(uid);
        const profileResult = await getUser(uid, accessToken);
        if (profileResult.success && profileResult.data) {
          fetchedUser = profileResult.data;
          console.log('[login] fetched profile:', JSON.stringify(fetchedUser));
        }
      }

      // Derive role
      const activeRole = (fetchedUser?.activeRole || fetchedUser?.role || '').toString();
      const role: UserProfile['role'] =
        activeRole.toUpperCase() === 'DRIVER' ? 'driver' : 'passenger';

      setUser({
        name: fetchedUser?.name || email.split('@')[0],
        phone: fetchedUser?.phone || '',
        email: fetchedUser?.email || email,
        role,
        kycVerified: fetchedUser?.kycVerified,
        collegeOrCompany: 'N/A',
        emergencyContact: '',
        rating: 4.8,
        photo: fetchedUser?.avatarUrl || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&h=200&q=80',
      });
      setIsAuthenticated(true);

      // ── 3. Best-effort Supabase session (for realtime features)
      try {
        await supabase.auth.signInWithPassword({ email, password });
      } catch {
        // Non-critical; backend auth is the source of truth
      }

      return { success: true };
    } catch (networkErr: any) {
      // ── 3. Network fallback ────────────────────────────────────────────────
      console.warn('[login] Backend unreachable, falling back to local session:', networkErr?.message ?? networkErr);
      setUser({
        name: email.split('@')[0] || 'User',
        phone: '',
        email,
        role: 'passenger',
        collegeOrCompany: 'N/A',
        emergencyContact: '',
        rating: 4.8,
        photo: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&h=200&q=80',
      });
      setIsAuthenticated(true);
      return { success: true };
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
        return { success: false, error: 'Could not generate Google sign-in URL' };
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

      if (result.type === 'success' && result.url) {
        let access_token: string | undefined;
        let refresh_token: string | undefined;

        // In OAuth hash fragment (#access_token=...&refresh_token=...)
        if (result.url.includes('#')) {
          const hashString = result.url.split('#')[1];
          const params = new URLSearchParams(hashString);
          access_token = params.get('access_token') || undefined;
          refresh_token = params.get('refresh_token') || undefined;
        }

        // Fallback to query params (?access_token=...)
        if (!access_token) {
          const parsedUrl = Linking.parse(result.url);
          access_token = parsedUrl.queryParams?.access_token as string;
          refresh_token = parsedUrl.queryParams?.refresh_token as string;
        }

        if (access_token && refresh_token) {
          const { data: sessionData, error: sessionErr } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });

          if (sessionErr) {
            return { success: false, error: sessionErr.message };
          }

          if (sessionData.user) {
            setUser({
              name: sessionData.user.user_metadata?.full_name || sessionData.user.email?.split('@')[0] || 'User',
              email: sessionData.user.email || '',
              phone: sessionData.user.user_metadata?.phone || '',
              role: 'passenger',
              collegeOrCompany: 'N/A',
              emergencyContact: '',
              rating: 5.0,
              photo: sessionData.user.user_metadata?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&h=200&q=80',
            });
            setIsAuthenticated(true);
          }
        }
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Google Sign-In failed' };
    }
  };

  const signup = async (profile: Partial<UserProfile> & { password?: string }) => {
    if (!profile.email || !profile.password) {
      // No credentials provided — create a local guest session
      setUser({
        name: profile.name || 'New Passenger',
        phone: profile.phone || '98XXXXXXXX',
        email: profile.email || 'passenger@sarathi.com',
        role: profile.role || 'passenger',
        collegeOrCompany: profile.collegeOrCompany || 'N/A',
        emergencyContact: '',
        rating: 5.0,
        photo: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&h=200&q=80',
      });
      return { success: true };
    }

    // ── 1. Call Sarathi backend (/api/user/signup) ─────────────────────────
    try {
      const apiResult = await signupUser({
        name: profile.name || '',
        email: profile.email,
        phone: profile.phone || '',
        password: profile.password,
        role: profile.role ?? 'passenger',
      });

      if (!apiResult.success) {
        // Backend returned a proper error (e.g. duplicate email)
        return { success: false, error: apiResult.error || 'Signup failed. Please try again.' };
      }

      // Backend signup succeeded — set user state from returned data
      const signupBackendUser = apiResult.data;
      const signupToken = signupBackendUser?.token;
      const signupUid = signupBackendUser?.id || signupBackendUser?.userId;
      if (signupToken) {
        await AsyncStorageLib.setItem('@sarathi_token', signupToken);
        setAuthToken(signupToken);
      }
      if (signupUid) {
        await AsyncStorageLib.setItem('@sarathi_user_id', signupUid);
        setUserId(signupUid);
      }
      const signupActiveRole = signupBackendUser?.activeRole ?? '';
      const signupRole: UserProfile['role'] =
        signupActiveRole.toUpperCase() === 'DRIVER' ? 'driver' : 'passenger';
      setUser({
        name: signupBackendUser?.name || profile.name || 'New Passenger',
        phone: signupBackendUser?.phone || profile.phone || '98XXXXXXXX',
        email: signupBackendUser?.email || profile.email,
        role: signupRole || profile.role || 'passenger',
        collegeOrCompany: profile.collegeOrCompany || 'N/A',
        emergencyContact: '',
        rating: 5.0,
        photo: signupBackendUser?.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&h=200&q=80',
      });

      // ── 2. Optionally also sign up in Supabase (for realtime / auth session)
      try {
        const { data: sbData } = await supabase.auth.signUp({
          email: profile.email,
          password: profile.password,
          options: {
            data: {
              full_name: profile.name,
              phone: profile.phone,
              role: profile.role,
              college_or_company: profile.collegeOrCompany,
            },
          },
        });
        if (sbData?.user) {
          setSupabaseUser(sbData.user);
        }
      } catch (sbErr: any) {
        // Supabase signup is best-effort; don't fail the overall flow
        console.warn('[signup] Supabase signUp skipped:', sbErr?.message ?? sbErr);
      }

      return { success: true };
    } catch (networkErr: any) {
      // ── 3. Network fallback — backend unreachable ──────────────────────────
      console.warn('[signup] Backend unreachable, falling back to local session:', networkErr?.message ?? networkErr);
      setUser({
        name: profile.name || 'New Passenger',
        phone: profile.phone || '98XXXXXXXX',
        email: profile.email,
        role: profile.role || 'passenger',
        collegeOrCompany: profile.collegeOrCompany || 'N/A',
        emergencyContact: '',
        rating: 5.0,
        photo: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&h=200&q=80',
      });
      setIsAuthenticated(true);
      return { success: true };
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

    // Fire real native mobile push notification (Lock screen, Status bar, Notification panel)
    triggerMobilePushNotification({
      title: item.title,
      body: item.description,
      data: {
        targetScreen: item.targetScreen,
        targetParams: item.targetParams,
      },
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

  // requestBooking disabled — ride/booking functionality being rebuilt
  const requestBooking = (_rideId: string, _passengerPickup?: string, _passengerDropoff?: string): void => {
    Alert.alert('Coming Soon', 'Ride booking will be available soon. Stay tuned!');
  };

  // acceptBooking disabled — ride/booking functionality being rebuilt
  const acceptBooking = (_bookingId: string): void => {};


  // verifyPickupOtp disabled — ride/booking functionality being rebuilt
  const verifyPickupOtp = (_bookingId: string, _otp: string): { success: boolean; error?: string } => {
    return { success: false, error: 'Coming soon.' };
  };

  // verifyCompletionOtp disabled — ride/booking functionality being rebuilt
  const verifyCompletionOtp = (_bookingId: string, _otp: string): { success: boolean; error?: string } => {
    return { success: false, error: 'Coming soon.' };
  };

  // processPayment disabled — ride/booking functionality being rebuilt
  const processPayment = (_bookingId: string, _method: 'cash' | 'khalti' | 'esewa'): { success: boolean; error?: string } => {
    return { success: false, error: 'Coming soon.' };
  };

  // submitRideRating disabled — ride/booking functionality being rebuilt
  const submitRideRating = (_bookingId: string, _rating: number, _comment?: string): void => {};

  // cancelBooking / declineBooking disabled — ride/booking functionality being rebuilt
  const cancelBooking = (_bookingId: string): void => {};
  const declineBooking = (_bookingId: string): void => {};

  // nudgeDriverLocation disabled — ride/booking functionality being rebuilt
  const nudgeDriverLocation = (_bookingId: string): void => {};

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

    setTimeout(() => {
      const ride = rides.find(r => r.id === rideId);
      const driverName = ride ? ride.riderName.split(' ')[0] : 'Driver';
      const driverReply: DriverMessage = {
        id: `dm-${Date.now()}-reply`,
        rideId,
        sender: 'driver',
        text: `Got it! Thanks for letting me know. See you at pickup soon! - ${driverName}`,
        timestamp: new Date(),
      };

      setDriverMessages(prev => ({
        ...prev,
        [rideId]: [...(prev[rideId] || []), driverReply],
      }));
    }, 1200);
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

      if (lowerText.includes('cheap') || lowerText.includes('price') || lowerText.includes('cost')) {
        const sorted = [...rides].sort((a, b) => a.price - b.price);
        suggestedRides = [sorted[0].id];
        responseText = `I found the cheapest ride for you! ${sorted[0].riderName} is offering a ride for only NPR ${sorted[0].price} going through ${sorted[0].route.join(' → ')}.`;
      } else if (lowerText.includes('soonest') || lowerText.includes('time') || lowerText.includes('leaving')) {
        suggestedRides = ['ride-1'];
        responseText = `The ride leaving soonest is with Sakar Aryal (leaving in 5 mins) on a ${rides[0].vehicleName} for NPR ${rides[0].price}. Route: ${rides[0].route.join(' → ')}.`;
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
          responseText = "I couldn't find a specific match for your destination or filters. Please try search terms containing landmarks like 'Koteshwor', 'Balkhu', or 'Kalanki', or ask about 'cheapest' / 'soonest' rides.";
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
    setSupabaseUser(null);
    setIsAuthenticated(false);
    setBookings([]);
  };

  const updateUserProfile = async (payload: { name?: string; email?: string; phone?: string; avatarUrl?: string }) => {
    if (!userId) return { success: false, error: 'Not logged in' };
    const token = authToken || (await AsyncStorageLib.getItem('@sarathi_token')) || undefined;
    const result = await updateUser(userId, payload, token ?? undefined);
    if (!result.success) {
      return { success: false, error: result.error };
    }
    // Sync local state with updated values
    const updated = (result.data as any)?.data ?? result.data;
    setUser(prev => prev ? {
      ...prev,
      name: updated?.name ?? prev.name,
      email: updated?.email ?? prev.email,
      phone: updated?.phone ?? prev.phone,
      photo: updated?.avatarUrl ?? prev.photo,
      kycVerified: updated?.kycVerified ?? prev.kycVerified,
    } : null);
    return { success: true };
  };

  const getStoredToken = async () => {
    if (authToken) return authToken;
    const token1 = await AsyncStorageLib.getItem('@sarathi_token');
    if (token1) return token1;
    const token2 = await AsyncStorageLib.getItem('@sarathi_auth_token');
    return token2 || undefined;
  };

  const deleteAccount = async () => {
    let targetUserId = userId || (await AsyncStorageLib.getItem('@sarathi_user_id'));
    const token = await getStoredToken();

    // If targetUserId is missing or empty, extract from JWT payload
    if (!targetUserId && token) {
      const jwtPayload = decodeJwtPayload(token);
      targetUserId = jwtPayload?.sub || jwtPayload?.id || jwtPayload?.userId || jwtPayload?.user_id;
    }

    if (!targetUserId) return { success: false, error: 'Not logged in' };

    console.log(`[deleteAccount] Requesting DELETE /api/users/${targetUserId}`);
    const result = await deleteUser(targetUserId, token);
    if (!result.success) {
      return { success: false, error: result.error };
    }
    await logout();
    return { success: true };
  };

  const switchUserRole = async (targetRole: 'PASSENGER' | 'RIDER' | 'DRIVER') => {
    const token = await getStoredToken();
    const currentRole = user?.role === 'driver' ? 'RIDER' : 'PASSENGER';
    const reqTargetRole = (targetRole === 'DRIVER' || targetRole === 'RIDER') ? 'RIDER' : 'PASSENGER';

    const result = await switchRole({ role: currentRole, targetRole: reqTargetRole }, token);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    const resUser = result.data?.user;
    const resToken = result.data?.token;

    if (resToken) {
      await AsyncStorageLib.setItem('@sarathi_token', resToken);
      await AsyncStorageLib.setItem('@sarathi_auth_token', resToken);
      setAuthToken(resToken);
    }

    const updatedRole = resUser?.activeRole || reqTargetRole;
    const isDriverOrRider = updatedRole.toUpperCase() === 'RIDER' || updatedRole.toUpperCase() === 'DRIVER';
    const newRoleVal: UserProfile['role'] = isDriverOrRider ? 'driver' : 'passenger';

    await AsyncStorageLib.setItem('@sarathi_active_role', newRoleVal);

    setUser(prev => prev ? {
      ...prev,
      name: resUser?.name || prev.name,
      email: resUser?.email || prev.email,
      phone: resUser?.phone || prev.phone,
      role: newRoleVal,
      kycVerified: resUser?.kycVerified ?? prev.kycVerified,
    } : {
      name: resUser?.name || 'User',
      email: resUser?.email || '',
      phone: resUser?.phone || '',
      role: newRoleVal,
      collegeOrCompany: 'N/A',
      emergencyContact: '',
      rating: 5.0,
      photo: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&h=200&q=80',
      kycVerified: resUser?.kycVerified ?? false,
    });

    return { success: true, activeRole: updatedRole };
  };

  const uploadUserKycDocument = async (documentType: string, document: string, file: string) => {
    if (!userId) return { success: false, error: 'Not logged in' };
    const token = await getStoredToken();
    const result = await uploadKycDocument(userId, { documentType, document, file }, token);
    if (!result.success) {
      return { success: false, error: result.error };
    }
    // Update local user status to PENDING upon successful submission
    setUser(prev => prev ? { ...prev, kycStatus: 'PENDING' } : null);
    return { success: true };
  };

  const submitKycVerify = async () => {
    if (!userId) return { success: false, error: 'Not logged in' };
    const token = await getStoredToken();
    const result = await verifyKycStatus(userId, token);
    if (!result.success) {
      return { success: false, error: result.error };
    }
    if (result.data?.kycVerified) {
      setUser(prev => prev ? { ...prev, kycVerified: true, kycStatus: 'VERIFIED' } : null);
    }
    return { success: true };
  };

  // createRide / updateRide / deleteRide disabled — ride functionality being rebuilt
  const createRide = async (_newRideData: Omit<Ride, 'id' | 'riderName' | 'riderPhoto' | 'rating'>): Promise<void> => {
    console.log('[createRide] disabled — coming soon');
  };

  const updateRide = async (_id: string, _updatedFields: Partial<Omit<Ride, 'id'>>): Promise<void> => {
    console.log('[updateRide] disabled — coming soon');
  };

  const deleteRide = async (_id: string): Promise<void> => {
    console.log('[deleteRide] disabled — coming soon');
  };

  return (
    <AppContext.Provider
      value={{
        user,
        deviceLocation,
        supabaseUser,
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
        completeProfile,
        updateEmergencyContact,
        updateUserProfile,
        deleteAccount,
        switchUserRole,
        uploadUserKycDocument,
        submitKycVerify,
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
