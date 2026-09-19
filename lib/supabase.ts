import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const rawUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://nesciqgijgmslopxrmko.supabase.co';
const cleanUrl = rawUrl.trim().replace(/^[^\w+:-]+/, '');
const supabaseUrl = cleanUrl.startsWith('http') ? cleanUrl : 'https://nesciqgijgmslopxrmko.supabase.co';

const supabaseAnonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lc2NpcWdpamdtc2xvcHhybWtvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2NDg2NjcsImV4cCI6MjEwNTIyNDY2N30.mXDbMMCM0Hjo5qRFYzGOImiRAdOssabSqGqZFAnVCxg').trim();

const customStorage = {
  getItem: (key: string) => {
    if (typeof window === 'undefined') return Promise.resolve(null);
    return AsyncStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    if (typeof window === 'undefined') return Promise.resolve();
    return AsyncStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    if (typeof window === 'undefined') return Promise.resolve();
    return AsyncStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: customStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
