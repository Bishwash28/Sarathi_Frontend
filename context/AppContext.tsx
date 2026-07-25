import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

// Landmark coordinates on our map & GPS grid
export interface Landmark {
  name: string;
  x: number; // percentage width on map canvas (0-100)
  y: number; // percentage height on map canvas (0-100)
  latitude: number;
  longitude: number;
}

export const LANDMARKS: Record<string, Landmark> = {
  'Kalanki': { name: 'Kalanki', x: 15, y: 55, latitude: 27.6937, longitude: 85.2817 },
  'Balkhu': { name: 'Balkhu', x: 25, y: 75, latitude: 27.6845, longitude: 85.2907 },
  'Tripureshwor': { name: 'Tripureshwor', x: 45, y: 50, latitude: 27.6961, longitude: 85.3121 },
  'Putalisadak': { name: 'Putalisadak', x: 60, y: 35, latitude: 27.7042, longitude: 85.3218 },
  'Chabahil': { name: 'Chabahil', x: 80, y: 25, latitude: 27.7172, longitude: 85.3496 },
  'Koteshwor': { name: 'Koteshwor', x: 85, y: 70, latitude: 27.6756, longitude: 85.3461 },
  'Balkumari': { name: 'Balkumari', x: 75, y: 80, latitude: 27.6708, longitude: 85.3418 },
  'Lagankhel': { name: 'Lagankhel', x: 55, y: 85, latitude: 27.6675, longitude: 85.3232 },
};

export interface Ride {
  id: string;
  riderName: string;
  riderPhoto: string;
  rating: number;
  vehicleType: 'bike' | 'car';
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
  status: 'pending' | 'accepted' | 'cancelled' | 'completed';
  createdAt: Date;
  currentLat?: number;
  currentLng?: number;
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
  name: string;
  phone: string;
  email: string;
  role: 'passenger' | 'driver';
  collegeOrCompany: string;
  emergencyContact: string;
  rating: number;
  photo: string;
}

interface AppContextType {
  user: UserProfile | null;
  supabaseUser: User | null;
  isAuthenticated: boolean;
  rides: Ride[];
  bookings: Booking[];
  messages: Message[];
  driverMessages: Record<string, DriverMessage[]>;
  activeChatRideIds: string[];
  notifications: string[];
  activeTripProgress: number; // 0 to 100 representing percentage along route
  activeTripCoords: { x: number; y: number } | null;
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  signup: (profile: Partial<UserProfile> & { password?: string }) => Promise<{ success: boolean; error?: string }>;
  completeProfile: (profile: Partial<UserProfile>) => void;
  updateEmergencyContact: (contact: string) => void;
  requestBooking: (rideId: string) => void;
  cancelBooking: (bookingId: string) => void;
  sendChatMessage: (text: string) => void;
  sendDriverMessage: (rideId: string, text: string) => void;
  startRiderChat: (rideId: string) => void;
  nudgeDriverLocation: (bookingId: string) => void;
  logout: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const initialRides: Ride[] = [
  {
    id: 'ride-1',
    riderName: 'Sakar Aryal',
    riderPhoto: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&h=200&q=80',
    rating: 4.9,
    vehicleType: 'bike',
    vehicleName: 'Pulsar 220F',
    vehicleNumber: 'BA 95 PA 8821',
    departureTime: 'Leaving in 5 mins',
    seatsLeft: 1,
    price: 120,
    route: ['Kalanki', 'Balkhu', 'Tripureshwor', 'Koteshwor'],
    pickupPoint: 'Kalanki Chowk (near Overhead Bridge)',
  },
  {
    id: 'ride-2',
    riderName: 'Priya Sharma',
    riderPhoto: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&h=200&q=80',
    rating: 4.8,
    vehicleType: 'car',
    vehicleName: 'Hyundai Grand i10',
    vehicleNumber: 'BA 3 CHA 4590',
    departureTime: 'Leaving in 15 mins',
    seatsLeft: 3,
    price: 320,
    route: ['Chabahil', 'Putalisadak', 'Tripureshwor', 'Lagankhel'],
    pickupPoint: 'Chabahil Chowk (near KL Tower)',
  },
  {
    id: 'ride-3',
    riderName: 'Ram Bahadur',
    riderPhoto: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&w=200&h=200&q=80',
    rating: 4.6,
    vehicleType: 'bike',
    vehicleName: 'Honda Hornet 160R',
    vehicleNumber: 'BA 82 PA 1244',
    departureTime: 'Leaving in 10 mins',
    seatsLeft: 1,
    price: 150,
    route: ['Kalanki', 'Balkhu', 'Lagankhel', 'Balkumari'],
    pickupPoint: 'Balkhu Bhatbhateni Gate',
  },
  {
    id: 'ride-4',
    riderName: 'Sneha Shrestha',
    riderPhoto: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=200&h=200&q=80',
    rating: 4.7,
    vehicleType: 'car',
    vehicleName: 'Suzuki Swift',
    vehicleNumber: 'BA 2 CHA 8891',
    departureTime: 'Leaving in 30 mins',
    seatsLeft: 4,
    price: 280,
    route: ['Balkhu', 'Tripureshwor', 'Putalisadak', 'Chabahil'],
    pickupPoint: 'Tripureshwor (near Dasharath Rangasala)',
  },
];

const initialDriverMessages: Record<string, DriverMessage[]> = {
  'ride-1': [
    { id: 'dm-1-1', rideId: 'ride-1', sender: 'driver', text: 'Hello! I am Sakar. Are you waiting near Kalanki Overhead Bridge?', timestamp: new Date(Date.now() - 300000) },
    { id: 'dm-1-2', rideId: 'ride-1', sender: 'user', text: 'Yes, I am near the entrance wearing a navy jacket.', timestamp: new Date(Date.now() - 180000) },
    { id: 'dm-1-3', rideId: 'ride-1', sender: 'driver', text: 'Great! Reaching in 3 minutes on my Pulsar 220F.', timestamp: new Date(Date.now() - 60000) },
  ],
  'ride-2': [
    { id: 'dm-2-1', rideId: 'ride-2', sender: 'driver', text: 'Hi! Priya here. Starting from Chabahil in 15 mins.', timestamp: new Date(Date.now() - 600000) },
  ],
  'ride-3': [
    { id: 'dm-3-1', rideId: 'ride-3', sender: 'driver', text: 'Namaste! Ram Bahadur here, leaving Balkhu soon.', timestamp: new Date(Date.now() - 900000) },
  ],
  'ride-4': [
    { id: 'dm-4-1', rideId: 'ride-4', sender: 'driver', text: 'Hi! Sneha here. Let me know when you reach Tripureshwor.', timestamp: new Date(Date.now() - 1200000) },
  ],
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [rides] = useState<Ride[]>(initialRides);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [driverMessages, setDriverMessages] = useState<Record<string, DriverMessage[]>>(initialDriverMessages);
  const [activeChatRideIds, setActiveChatRideIds] = useState<string[]>(['ride-1']); // Sakar Aryal active by default
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
    const acceptedBooking = bookings.find(b => b.status === 'accepted');
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
                currBookings.map(b => b.id === acceptedBooking.id ? { ...b, status: 'completed' } : b)
              );
              setNotifications(prevNotifs => ['Your ride has completed successfully!', ...prevNotifs]);
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
    if (password) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        return { success: false, error: error.message };
      }
      if (data.user) {
        setSupabaseUser(data.user);
        setIsAuthenticated(true);
        setUser({
          name: data.user.user_metadata?.full_name || email.split('@')[0],
          phone: data.user.user_metadata?.phone || '',
          email: data.user.email || email,
          role: data.user.user_metadata?.role || 'passenger',
          collegeOrCompany: data.user.user_metadata?.college_or_company || 'N/A',
          emergencyContact: '',
          rating: 4.8,
          photo: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&h=200&q=80',
        });
        return { success: true };
      }
    }
    
    // Fallback/Mock login if no password specified
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
  };

  const signup = async (profile: Partial<UserProfile> & { password?: string }) => {
    if (profile.email && profile.password) {
      const { data, error } = await supabase.auth.signUp({
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

      if (error) {
        return { success: false, error: error.message };
      }
      if (data.user) {
        setSupabaseUser(data.user);
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
        return { success: true };
      }
    }

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
  };

  const completeProfile = (profile: Partial<UserProfile>) => {
    setUser(prev => prev ? { ...prev, ...profile } : null);
    setIsAuthenticated(true);
  };

  const updateEmergencyContact = (contact: string) => {
    setUser(prev => prev ? { ...prev, emergencyContact: contact } : null);
  };

  const requestBooking = (rideId: string) => {
    const activeBooking = bookings.find(b => b.status === 'pending' || b.status === 'accepted');
    if (activeBooking) {
      Alert.alert('Ongoing Booking', 'You already have an active booking or trip. Please complete or cancel it first.');
      return;
    }

    const ride = rides.find(r => r.id === rideId);
    const startLandmark = ride ? LANDMARKS[ride.route[0]] : null;

    const newBooking: Booking = {
      id: `booking-${Date.now()}`,
      rideId,
      passengerId: user?.email || 'guest',
      status: 'pending',
      createdAt: new Date(),
      currentLat: startLandmark ? startLandmark.latitude : 27.6937,
      currentLng: startLandmark ? startLandmark.longitude : 85.2817,
    };
    setBookings(prev => [newBooking, ...prev]);
    setNotifications(prev => ['Your ride request has been submitted!', ...prev]);
  };

  const cancelBooking = (bookingId: string) => {
    setBookings(prev => 
      prev.map(b => b.id === bookingId ? { ...b, status: 'cancelled' } : b)
    );
    setNotifications(prev => ['You cancelled your ride request.', ...prev]);
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

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSupabaseUser(null);
    setIsAuthenticated(false);
    setBookings([]);
  };

  return (
    <AppContext.Provider
      value={{
        user,
        supabaseUser,
        isAuthenticated,
        rides,
        bookings,
        messages,
        driverMessages,
        activeChatRideIds,
        notifications,
        activeTripProgress,
        activeTripCoords,
        login,
        signup,
        completeProfile,
        updateEmergencyContact,
        requestBooking,
        cancelBooking,
        sendChatMessage,
        sendDriverMessage,
        startRiderChat,
        nudgeDriverLocation,
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
