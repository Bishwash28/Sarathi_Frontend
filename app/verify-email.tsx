import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Platform, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { supabase } from '../lib/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function VerifyEmailScreen() {
  const params = useLocalSearchParams<{ token_hash?: string; type?: string; error?: string; error_description?: string }>();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    (async () => {
      try {
        // 1. Check if error query params were passed directly from redirect
        if (params.error || params.error_description) {
          setStatus('error');
          setErrorMessage(decodeURIComponent(params.error_description || params.error || 'Verification link is invalid or expired.'));
          return;
        }

        // 2. Check URL Hash (Web format when Supabase redirects: #access_token=...&type=signup or error)
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.hash) {
          const hashStr = window.location.hash.substring(1);
          const hashParams = new URLSearchParams(hashStr);

          const errorDesc = hashParams.get('error_description');
          if (errorDesc) {
            setStatus('error');
            setErrorMessage(decodeURIComponent(errorDesc.replace(/\+/g, ' ')));
            return;
          }

          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');

          if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (sessionError) {
              setStatus('error');
              setErrorMessage(sessionError.message);
            } else {
              setStatus('success');
            }
            return;
          }
        }

        // 3. Check token_hash directly (if passing token_hash via email link)
        if (params.token_hash) {
          const type = (params.type as any) || 'signup';
          const { error } = await supabase.auth.verifyOtp({
            token_hash: params.token_hash,
            type: type,
          });

          if (error) {
            setStatus('error');
            setErrorMessage(error.message);
          } else {
            setStatus('success');
          }
          return;
        }

        // 4. Check if active authenticated session already exists
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setStatus('success');
          return;
        }

        // If no token or parameters found
        setStatus('error');
        setErrorMessage('Invalid or missing verification parameters. Please use the link sent to your email.');
      } catch (err: any) {
        setStatus('error');
        setErrorMessage(err?.message || 'Verification process failed. Please try again.');
      }
    })();
  }, [params]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          
          {/* Loading State */}
          {status === 'loading' && (
            <View style={styles.stateBox}>
              <ActivityIndicator size="large" color={Colors.primary} style={{ marginBottom: 16 }} />
              <Text style={styles.title}>Verifying Your Email</Text>
              <Text style={styles.subtitle}>Please wait while we verify your confirmation link...</Text>
            </View>
          )}

          {/* Verification Successful State */}
          {status === 'success' && (
            <View style={styles.stateBox}>
              <View style={[styles.iconWrap, { backgroundColor: '#ECFDF5', borderColor: '#6EE7B7' }]}>
                <Ionicons name="checkmark-circle" size={56} color="#10B981" />
              </View>
              <Text style={styles.title}>Email Verified!</Text>
              <Text style={styles.subtitle}>
                Your email address has been verified successfully. Your Sarathi account is ready to use.
              </Text>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => router.replace('/(auth)/login')}
                activeOpacity={0.85}
              >
                <Ionicons name="log-in-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.actionBtnText}>Proceed to Log In</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Verification Failed State */}
          {status === 'error' && (
            <View style={styles.stateBox}>
              <View style={[styles.iconWrap, { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }]}>
                <Ionicons name="close-circle" size={56} color="#EF4444" />
              </View>
              <Text style={styles.title}>Verification Failed</Text>
              <Text style={styles.subtitle}>
                {errorMessage}
              </Text>
              
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: Colors.primary }]}
                onPress={() => router.replace('/(auth)/signup')}
                activeOpacity={0.85}
              >
                <Ionicons name="refresh-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.actionBtnText}>Sign Up / Resend Link</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => router.replace('/(auth)/login')}
                activeOpacity={0.7}
              >
                <Text style={styles.secondaryBtnText}>Back to Log In</Text>
              </TouchableOpacity>
            </View>
          )}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 5,
  },
  stateBox: {
    alignItems: 'center',
    textAlign: 'center',
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  actionBtn: {
    width: '100%',
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryBtn: {
    marginTop: 16,
    paddingVertical: 10,
  },
  secondaryBtnText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
});
