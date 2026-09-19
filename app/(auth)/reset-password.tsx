import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ResetPasswordScreen() {
  const { changePassword } = useApp();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Set Supabase session if redirected with tokens in URL
  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.log('[ResetPassword] Waiting for auth session recovery...');
        }
      } catch (err) {
        console.warn('[ResetPassword] Session check error:', err);
      }
    })();
  }, []);

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      if (Platform.OS === 'web') {
        window.alert('Weak Password: Password must be at least 8 characters long.');
      } else {
        Alert.alert('Weak Password', 'Password must be at least 8 characters long.');
      }
      return;
    }

    if (newPassword !== confirmPassword) {
      if (Platform.OS === 'web') {
        window.alert('Mismatch: Passwords do not match.');
      } else {
        Alert.alert('Mismatch', 'Passwords do not match.');
      }
      return;
    }

    setIsLoading(true);
    const result = await changePassword(newPassword);
    setIsLoading(false);

    if (result.success) {
      setIsSuccess(true);
      if (Platform.OS === 'web') {
        window.alert('Success! Password updated successfully.');
      }
    } else {
      const errMsg = result.error || 'Could not update password. Session token may have expired. Please request a new reset link.';
      if (Platform.OS === 'web') {
        window.alert(`Reset Failed: ${errMsg}`);
      } else {
        Alert.alert('Reset Failed', errMsg);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          
          {isSuccess ? (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle-outline" size={64} color={Colors.primary} />
              <Text style={styles.title}>Password Updated!</Text>
              <Text style={styles.subtitle}>Your password has been changed successfully. You can now log in with your new password.</Text>
              <TouchableOpacity
                style={styles.loginBtn}
                onPress={() => router.replace('/(auth)/login')}
              >
                <Text style={styles.loginBtnText}>Go to Log In</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.headerContainer}>
                <Text style={styles.title}>Set New Password</Text>
                <Text style={styles.subtitle}>Enter a new password for your Sarathi account.</Text>
              </View>

              <View style={styles.formCard}>
                <Text style={styles.label}>New Password</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color={Colors.primary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Min 8 characters"
                    placeholderTextColor="#94A3B8"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={20} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>Confirm New Password</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color={Colors.primary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Re-enter new password"
                    placeholderTextColor="#94A3B8"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showPassword}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.submitBtn, isLoading && { opacity: 0.7 }]}
                  onPress={handleResetPassword}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitBtnText}>Update Password</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    justifyContent: 'center',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  formCard: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: '#0F172A',
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  successBox: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  loginBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    marginTop: 24,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
