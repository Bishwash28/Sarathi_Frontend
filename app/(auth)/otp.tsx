import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { useApp } from '../../context/AppContext';

export default function OTPScreen() {
  const { login } = useApp();
  const params = useLocalSearchParams();
  const phone = params.phone as string || 'your registered number';
  const email = params.email as string || 'your email';

  const [otpCode, setOtpCode] = useState('');

  const handleVerify = async () => {
    if (otpCode.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter a valid 6-digit code.');
      return;
    }
    
    // Mock OTP verification - any 6 digit code passes
    await login(email);
    
    Alert.alert('Verification Successful', 'Welcome to Sarathi!', [
      {
        text: 'Continue',
        onPress: () => {
          router.replace('/(tabs)');
        }
      }
    ]);
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Verification Code</Text>
        <Text style={styles.subtitle}>
          We have sent a 6-digit OTP code to your number ending in{' '}
          <Text style={styles.boldText}>
            {phone.length > 4 ? phone.slice(-4) : phone}
          </Text>
        </Text>

        <View style={styles.otpInputContainer}>
          <TextInput
            style={styles.otpInput}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="0 0 0 0 0 0"
            placeholderTextColor={Colors.textMuted}
            value={otpCode}
            onChangeText={setOtpCode}
            textAlign="center"
          />
        </View>

        <TouchableOpacity 
          style={[styles.verifyButton, otpCode.length !== 6 && styles.disabledButton]} 
          onPress={handleVerify}
          disabled={otpCode.length !== 6}
        >
          <Text style={styles.verifyButtonText}>Verify & Proceed</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.resendContainer}>
          <Text style={styles.resendText}>Didn't receive the code? </Text>
          <Text style={styles.resendLink}>Resend Code</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  content: {
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
    paddingHorizontal: 10,
  },
  boldText: {
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  otpInputContainer: {
    width: '100%',
    marginBottom: 30,
    alignItems: 'center',
  },
  otpInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.accent + '25',
    borderRadius: 16,
    paddingVertical: 18,
    fontSize: 28,
    letterSpacing: 8,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    width: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  verifyButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  disabledButton: {
    backgroundColor: '#FCA5A5',
  },
  verifyButtonText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: 'bold',
  },
  resendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resendText: {
    color: Colors.textMuted,
    fontSize: 14,
  },
  resendLink: {
    color: Colors.primary,
    fontWeight: 'bold',
    fontSize: 14,
  },
});
