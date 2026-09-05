import { default as AsyncStorage, default as AsyncStorageLib } from '@react-native-async-storage/async-storage';
import { User } from '@supabase/supabase-js';
import * as Location from 'expo-location';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import {
  triggerMobilePushNotification
} from '../services/notificationService';
import { deleteUser, getUser, loginUser, signupUser, updateUser, switchRole, uploadKycDocument, verifyKycStatus } from '../services/userService';

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

// Landmark coordinates on our map & GPS grid (Butwal and surrounding areas)
export interface Landmark {
  name: string;
  x: number; // percentage width on map canvas (0-100)
  y: number; // percentage height on map canvas (0-100)
  latitude: number;
  longitude: number;
}

export const LANDMARKS: Record<string, Landmark> = {
  'Butwal': { name: 'Butwal', x: 20, y: 30, latitude: 27.7006, longitude: 83.4484 },
  'Golpark': { name: 'Golpark', x: 25, y: 35, latitude: 27.7050, longitude: 83.4520 },
  'Devinagar': { name: 'Devinagar', x: 30, y: 40, latitude: 27.6910, longitude: 83.4560 },
  'Milanchowk': { name: 'Milanchowk', x: 35, y: 45, latitude: 27.6850, longitude: 83.4600 },
  'Yogikuti': { name: 'Yogikuti', x: 42, y: 50, latitude: 27.6750, longitude: 83.4660 },
  'Drivertole': { name: 'Drivertole', x: 48, y: 55, latitude: 27.6620, longitude: 83.4690 },
  'Tilottama': { name: 'Tilottama', x: 55, y: 62, latitude: 27.6500, longitude: 83.4720 },
  'Manigram': { name: 'Manigram', x: 65, y: 70, latitude: 27.6300, longitude: 83.4750 },
  'Kotihawa': { name: 'Kotihawa', x: 75, y: 80, latitude: 27.5800, longitude: 83.4500 },
  'Bhairahawa': { name: 'Bhairahawa', x: 85, y: 90, latitude: 27.5020, longitude: 83.4510 },
};

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
  acceptBooking: (bookingId: string) => void;
  declineBooking: (bookingId: string) => void;
  logout: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const initialRides: Ride[] = [
  {
    id: 'ride-1',
    riderName: 'Anish Shrestha',
    riderPhoto: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&h=200&q=80',
    phone: '+9779841234567',
    rating: 4.9,
    vehicleType: 'scooter',
    vehicleName: 'Vespa VXL 150',
    vehicleNumber: 'LU 1 PA 1234',
    departureTime: 'Leaving in 5 mins',
    seatsLeft: 1,
    price: 150,
    route: ['Butwal', 'Golpark', 'Devinagar', 'Tilottama', 'Manigram', 'Bhairahawa'],
    pickupPoint: 'Butwal Bus Park Main Gate',
  },
  {
    id: 'ride-2',
    riderName: 'Bibek Gurung',
    riderPhoto: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&w=200&h=200&q=80',
    phone: '+9779851098765',
    rating: 4.6,
    vehicleType: 'scooter',
    vehicleName: 'Honda Activa 6G',
    vehicleNumber: 'LU 2 PA 5678',
    departureTime: 'Leaving in 10 mins',
    seatsLeft: 1,
    price: 120,
    route: ['Butwal', 'Milanchowk', 'Yogikuti', 'Drivertole', 'Tilottama'],
    pickupPoint: 'Milanchowk Highway Stop',
  },
  {
    id: 'ride-3',
    riderName: 'Sita Sharma',
    riderPhoto: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&h=200&q=80',
    phone: '+9779860112233',
    rating: 4.8,
    vehicleType: 'bike',
    vehicleName: 'Yamaha FZS V3',
    vehicleNumber: 'LU 3 PA 9012',
    departureTime: 'Leaving in 15 mins',
    seatsLeft: 1,
    price: 200,
    route: ['Golpark', 'Devinagar', 'Yogikuti', 'Manigram', 'Bhairahawa'],
    pickupPoint: 'Golpark Traffic Chowk',
  },
  {
    id: 'ride-4',
    riderName: 'Rajesh Thapa',
    riderPhoto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&h=200&q=80',
    phone: '+9779812345678',
    rating: 4.9,
    vehicleType: 'bike',
    vehicleName: 'Royal Enfield Classic 350',
    vehicleNumber: 'LU 1 PA 7788',
    departureTime: 'Leaving in 20 mins',
    seatsLeft: 2,
    price: 180,
    route: ['Devinagar', 'Tilottama', 'Manigram', 'Kotihawa', 'Bhairahawa'],
    pickupPoint: 'Devinagar Highway Gate',
  },
];

const initialDriverMessages: Record<string, DriverMessage[]> = {
  'ride-1': [
    { id: 'dm-1-1', rideId: 'ride-1', sender: 'driver', text: 'Namaste! I am Anish. Are you waiting near Butwal Bus Park Gate?', timestamp: new Date(Date.now() - 300000) },
    { id: 'dm-1-2', rideId: 'ride-1', sender: 'user', text: 'Yes, standing right near the main gate wearing a black jacket.', timestamp: new Date(Date.now() - 180000) },
    { id: 'dm-1-3', rideId: 'ride-1', sender: 'driver', text: 'Great! Arriving in 2 minutes on Vespa VXL 150.', timestamp: new Date(Date.now() - 60000) },
  ],
  'ride-2': [
    { id: 'dm-2-1', rideId: 'ride-2', sender: 'driver', text: 'Hi! Bibek here. Starting from Milanchowk in 10 mins.', timestamp: new Date(Date.now() - 600000) },
  ],
  'ride-3': [
    { id: 'dm-3-1', rideId: 'ride-3', sender: 'driver', text: 'Namaste! Sita here, leaving Golpark Chowk shortly.', timestamp: new Date(Date.now() - 900000) },
  ],
  'ride-4': [
    { id: 'dm-4-1', rideId: 'ride-4', sender: 'driver', text: 'Hi! Rajesh here on Royal Enfield. Let me know when you arrive.', timestamp: new Date(Date.now() - 1200000) },
  ],
};

const initialDriverNotifications: DriverNotificationItem[] = [
  {
    id: 'notif-1',
    type: 'ride_request',
    title: 'New Ride Request',
    description: 'Ram requested a ride from Butwal → Bhairahawa',
    timestamp: new Date(Date.now() - 120000),
    isRead: false,
    iconName: 'car-sport',
    iconColor: '#2563EB',
    targetScreen: '/activity',
  },
  {
    id: 'notif-2',
    type: 'kyc',
    title: 'KYC Verification Approved',
    description: 'Your driver identity and vehicle documents (LU 1 PA 7788) have been verified successfully.',
    timestamp: new Date(Date.now() - 3600000),
    isRead: false,
    iconName: 'shield-checkmark',
    iconColor: '#16A34A',
    targetScreen: '/profile',
  },
  {
    id: 'notif-3',
    type: 'announcement',
    title: 'System Announcement',
    description: 'Welcome to Sarathi Driver Workspace! Publish your route and split travel costs with passengers.',
    timestamp: new Date(Date.now() - 86400000),
    isRead: true,
    iconName: 'notifications',
    iconColor: '#F59E0B',
    targetScreen: '/index',
  },
];

const initialSavedPlaces: SavedPlaceItem[] = [
  { id: 'sp-1', name: 'Butwal Hub', landmark: 'Butwal' },
  { id: 'sp-2', name: 'Bhairahawa Station', landmark: 'Bhairahawa' },
  { id: 'sp-3', name: 'Kalanki Junction', landmark: 'Kalanki' },
  { id: 'sp-4', name: 'Koteshwor Stop', landmark: 'Koteshwor' },
];

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
  const [deviceLocation, setDeviceLocation] = useState<string>('Kalanki');
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
  const [activeChatRideIds, setActiveChatRideIds] = useState<string[]>(['ride-1']);
  const [notifications, setNotifications] = useState<string[]>([
    'Your ride request with Sakar Aryal has been ACCEPTED!',
    'Welcome to Sarathi! Set up your profile to start booking rides.',
  ]);
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

        let location = await Location.getCurrentPositionAsync({});
        let geocode = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

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
              }));
            }
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

  // Poll simulator for pending bookings
  useEffect(() => {
    const pendingBooking = bookings.find(b => b.status === 'pending');
    if (pendingBooking) {
      const timer = setTimeout(() => {
        setBookings(prev =>
          prev.map(b => {
            if (b.id === pendingBooking.id) {
              const ride = rides.find(r => r.id === b.rideId);
              const startLandmark = ride ? LANDMARKS[ride.route[0]] : null;
              return {
                ...b,
                status: 'accepted',
                lifecycleState: 'waiting_for_pickup',
                currentLat: startLandmark ? startLandmark.latitude : 27.6937,
                currentLng: startLandmark ? startLandmark.longitude : 85.2817,
              };
            }
            return b;
          })
        );
        const ride = rides.find(r => r.id === pendingBooking.rideId);
        const driverName = ride ? ride.riderName : 'Your driver';
        setNotifications(prev => [`Your ride request with ${driverName} has been ACCEPTED!`, ...prev]);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [bookings, rides]);

  // GPS Simulation Loop
  useEffect(() => {
    const acceptedBooking = bookings.find(b => b.status === 'ongoing');
    if (acceptedBooking) {
      const ride = rides.find(r => r.id === acceptedBooking.rideId);
      if (ride && ride.route.length > 1) {
        if (tripIntervalRef.current) clearInterval(tripIntervalRef.current);

        setActiveTripProgress(0);

        tripIntervalRef.current = setInterval(() => {
          setActiveTripProgress(prev => {
            if (prev >= 100) {
              clearInterval(tripIntervalRef.current!);
              setBookings(currBookings =>
                currBookings.map(b => b.id === acceptedBooking.id ? { ...b, status: 'arrived' } : b)
              );
              setNotifications(prevNotifs => ['Your ride has reached the destination! Verify OTP to complete.', ...prevNotifs]);
              return 100;
            }
            const nextProgress = prev + 5;

            const routeLandmarks = ride.route.map(name => LANDMARKS[name]).filter(Boolean);
            if (routeLandmarks.length >= 2) {
              const totalSegments = routeLandmarks.length - 1;
              const currentSegmentFraction = nextProgress / 100;
              const segmentFloat = currentSegmentFraction * totalSegments;
              const segmentIndex = Math.min(Math.floor(segmentFloat), totalSegments - 1);
              const segmentProgress = segmentFloat - segmentIndex;

              const startNode = routeLandmarks[segmentIndex];
              const endNode = routeLandmarks[segmentIndex + 1];

              const currentX = startNode.x + (endNode.x - startNode.x) * segmentProgress;
              const currentY = startNode.y + (endNode.y - startNode.y) * segmentProgress;
              setActiveTripCoords({ x: currentX, y: currentY });

              const currentLat = startNode.latitude + (endNode.latitude - startNode.latitude) * segmentProgress;
              const currentLng = startNode.longitude + (endNode.longitude - startNode.longitude) * segmentProgress;

              setBookings(curr => curr.map(b => b.id === acceptedBooking.id ? { ...b, currentLat, currentLng } : b));
            }

            return nextProgress;
          });
        }, 2500);
      }
    } else {
      if (tripIntervalRef.current) {
        clearInterval(tripIntervalRef.current);
        tripIntervalRef.current = null;
      }
      setActiveTripCoords(null);
    }

    return () => {
      if (tripIntervalRef.current) clearInterval(tripIntervalRef.current);
    };
  }, [bookings, rides]);

  const login = async (email: string, password?: string) => {
    if (!password) {
      // No password — mock/guest session
      setUser({
        name: 'Sakar Aryal',
        phone: '9841234567',
        email: email || 'sakar@sarathi.com',
        role: 'passenger',
        collegeOrCompany: 'Tribhuvan University',
        emergencyContact: '9801234567',
        rating: 4.8,
        photo: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&h=200&q=80',
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

  const requestBooking = (rideId: string, passengerPickup?: string, passengerDropoff?: string) => {
    const existing = bookings.find(
      b => b.lifecycleState !== 'completed' && b.lifecycleState !== 'cancelled'
    );
    if (existing) {
      Alert.alert('Ongoing Booking Active', 'You already have an ongoing ride or request. Please complete or cancel it first.');
      return;
    }

    const ride = rides.find(r => r.id === rideId);
    const startLandmark = ride ? LANDMARKS[ride.route[0]] : null;

    const newBooking: Booking = {
      id: `booking-${Date.now()}`,
      rideId,
      passengerId: user?.email || 'passenger@sarathi.com',
      passengerPhone: user?.phone || '+9779841234567',
      passengerPickup: passengerPickup || ride?.route[0] || 'Butwal',
      passengerDropoff: passengerDropoff || ride?.route[(ride?.route.length || 1) - 1] || 'Bhairahawa',
      status: 'pending',
      lifecycleState: 'request_pending',
      createdAt: new Date(),
      currentLat: startLandmark ? startLandmark.latitude : 27.7006,
      currentLng: startLandmark ? startLandmark.longitude : 83.4484,
      pickupOtp: '4821',
      completionOtp: '7392',
    };

    setBookings(prev => [newBooking, ...prev]);
    saveActiveBookingToStorage(newBooking);
    setNotifications(prev => ['Your ride request has been submitted to the driver!', ...prev]);

    // Send Push Notification to Driver
    addDriverNotification({
      type: 'ride_request',
      title: '🚗 New Ride Request',
      description: `Passenger requested a ride from ${newBooking.passengerPickup} → ${newBooking.passengerDropoff}`,
      iconName: 'car-sport',
      iconColor: '#2563EB',
      targetScreen: '/activity',
      targetParams: { rideId },
    });
  };

  const acceptBooking = (bookingId: string) => {
    let updatedBooking: Booking | null = null;
    setBookings(prev =>
      prev.map(b => {
        if (b.id === bookingId) {
          updatedBooking = {
            ...b,
            status: 'accepted',
            lifecycleState: 'waiting_for_pickup',
          };
          return updatedBooking;
        }
        return b;
      })
    );

    if (updatedBooking) {
      saveActiveBookingToStorage(updatedBooking);
    }
    setNotifications(prev => ['Your ride request has been ACCEPTED by the driver!', ...prev]);
  };

  const verifyPickupOtp = (bookingId: string, otp: string): { success: boolean; error?: string } => {
    const targetBooking = bookings.find(b => b.id === bookingId);
    if (!targetBooking) return { success: false, error: 'Booking not found.' };

    if (otp.trim() === targetBooking.pickupOtp || otp.trim() === '4821') {
      let updatedBooking: Booking | null = null;
      setBookings(prev =>
        prev.map(b => {
          if (b.id === bookingId) {
            updatedBooking = {
              ...b,
              status: 'ongoing',
              lifecycleState: 'ride_started',
              otpError: null,
            };
            return updatedBooking;
          }
          return b;
        })
      );
      if (updatedBooking) saveActiveBookingToStorage(updatedBooking);
      setNotifications(prev => ['Pickup verified! Your ride has officially started.', ...prev]);
      return { success: true };
    }

    setBookings(prev =>
      prev.map(b => (b.id === bookingId ? { ...b, otpError: 'Incorrect Pickup OTP (Default: 4821)' } : b))
    );
    return { success: false, error: 'Incorrect Pickup OTP. Please enter 4821.' };
  };

  const verifyCompletionOtp = (bookingId: string, otp: string): { success: boolean; error?: string } => {
    const targetBooking = bookings.find(b => b.id === bookingId);
    if (!targetBooking) return { success: false, error: 'Booking not found.' };

    if (otp.trim() === targetBooking.completionOtp || otp.trim() === '7392') {
      let updatedBooking: Booking | null = null;
      setBookings(prev =>
        prev.map(b => {
          if (b.id === bookingId) {
            updatedBooking = {
              ...b,
              status: 'arrived',
              lifecycleState: 'payment_pending',
              otpError: null,
            };
            return updatedBooking;
          }
          return b;
        })
      );
      if (updatedBooking) saveActiveBookingToStorage(updatedBooking);
      setNotifications(prev => ['Destination reached! Please select payment method.', ...prev]);
      return { success: true };
    }

    setBookings(prev =>
      prev.map(b => (b.id === bookingId ? { ...b, otpError: 'Incorrect Completion OTP (Default: 7392)' } : b))
    );
    return { success: false, error: 'Incorrect Completion OTP. Please enter 7392.' };
  };

  const processPayment = (bookingId: string, method: 'cash' | 'khalti' | 'esewa'): { success: boolean; error?: string } => {
    let updatedBooking: Booking | null = null;
    setBookings(prev =>
      prev.map(b => {
        if (b.id === bookingId) {
          updatedBooking = {
            ...b,
            paymentMethod: method,
            paymentStatus: 'completed',
            lifecycleState: 'rating_pending',
          };
          return updatedBooking;
        }
        return b;
      })
    );

    if (updatedBooking) saveActiveBookingToStorage(updatedBooking);
    setNotifications(prev => [`Payment of NPR 180 completed via ${method.toUpperCase()}!`, ...prev]);
    return { success: true };
  };

  const submitRideRating = (bookingId: string, rating: number, comment?: string) => {
    setBookings(prev =>
      prev.map(b => {
        if (b.id === bookingId) {
          return {
            ...b,
            rating,
            reviewComment: comment,
            status: 'completed',
            lifecycleState: 'completed',
          };
        }
        return b;
      })
    );

    saveActiveBookingToStorage(null);
    setNotifications(prev => ['Thank you for rating your Sarathi ride!', ...prev]);
  };

  const cancelBooking = (bookingId: string) => {
    setBookings(prev =>
      prev.map(b => (b.id === bookingId ? { ...b, status: 'cancelled', lifecycleState: 'cancelled' } : b))
    );
    saveActiveBookingToStorage(null);
    setNotifications(prev => ['You cancelled your ride request.', ...prev]);
  };

  const declineBooking = (bookingId: string) => {
    setBookings(prev =>
      prev.map(b => (b.id === bookingId ? { ...b, status: 'cancelled', lifecycleState: 'cancelled' } : b))
    );
    saveActiveBookingToStorage(null);
    setNotifications(prev => ['You declined the passenger request.', ...prev]);
  };

  const nudgeDriverLocation = (bookingId: string) => {
    setActiveTripProgress(prev => {
      const nextProgress = Math.min(100, prev + 15);
      const booking = bookings.find(b => b.id === bookingId);
      if (booking) {
        const ride = rides.find(r => r.id === booking.rideId);
        if (ride && ride.route.length >= 2) {
          const startLandmark = LANDMARKS[ride.route[0]];
          const endLandmark = LANDMARKS[ride.route[ride.route.length - 1]];
          if (startLandmark && endLandmark) {
            const frac = nextProgress / 100;
            const newLat = startLandmark.latitude + (endLandmark.latitude - startLandmark.latitude) * frac;
            const newLng = startLandmark.longitude + (endLandmark.longitude - startLandmark.longitude) * frac;
            setBookings(curr => curr.map(b => b.id === bookingId ? { ...b, currentLat: newLat, currentLng: newLng } : b));
          }
        }
      }
      return nextProgress;
    });
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

  const deleteAccount = async () => {
    if (!userId) return { success: false, error: 'Not logged in' };
    const token = authToken || (await AsyncStorageLib.getItem('@sarathi_auth_token')) || undefined;
    const result = await deleteUser(userId, token ?? undefined);
    if (!result.success) {
      return { success: false, error: result.error };
    }
    await logout();
    return { success: true };
  };

  const switchUserRole = async (targetRole: 'PASSENGER' | 'RIDER' | 'DRIVER') => {
    const token = authToken || (await AsyncStorageLib.getItem('@sarathi_auth_token')) || undefined;
    const currentRole = user?.role === 'driver' ? 'RIDER' : 'PASSENGER';
    const reqTargetRole = (targetRole === 'DRIVER' || targetRole === 'RIDER') ? 'RIDER' : 'PASSENGER';

    const result = await switchRole({ role: currentRole, targetRole: reqTargetRole }, token);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    const resUser = result.data?.user;
    const resToken = result.data?.token;

    if (resToken) {
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
    const token = authToken || (await AsyncStorageLib.getItem('@sarathi_auth_token')) || undefined;
    const result = await uploadKycDocument(userId, { documentType, document, file }, token);
    if (!result.success) {
      return { success: false, error: result.error };
    }
    return { success: true };
  };

  const submitKycVerify = async () => {
    if (!userId) return { success: false, error: 'Not logged in' };
    const token = authToken || (await AsyncStorageLib.getItem('@sarathi_auth_token')) || undefined;
    const result = await verifyKycStatus(userId, token);
    if (!result.success) {
      return { success: false, error: result.error };
    }
    if (result.data?.kycVerified) {
      setUser(prev => prev ? { ...prev, kycVerified: true } : null);
    }
    return { success: true };
  };

  const createRide = (newRideData: Omit<Ride, 'id' | 'riderName' | 'riderPhoto' | 'rating'>) => {
    const newRide: Ride = {
      id: `ride-${Date.now()}`,
      riderName: user?.name || 'Sarathi Driver',
      riderPhoto: user?.photo || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&h=200&q=80',
      phone: user?.phone || '+9779841234567',
      rating: 5.0,
      ...newRideData,
    };
    setRides(prev => [newRide, ...prev]);
    setNotifications(prev => [`You have offered a new ride going to ${newRideData.route[newRideData.route.length - 1]}!`, ...prev]);
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
