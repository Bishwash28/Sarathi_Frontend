import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { useApp } from '../../context/AppContext';
import { Ionicons } from '@expo/vector-icons';

export default function SignupScreen() {
  const { signup } = useApp();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'passenger' | 'driver'>('passenger');
  const [collegeOrCompany, setCollegeOrCompany] = useState('');

  const handleSignup = async () => {
    if (!name || !phone || !email || !password || !collegeOrCompany) {
      alert('Please fill in all fields');
      return;
    }
    
    await signup({
      name,
      phone,
      email,
      role,
      collegeOrCompany,
    });
    
    // Proceed to OTP screen
    router.push({
      pathname: '/(auth)/otp',
      params: { phone, email, name }
    });
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        {/* Header Section */}
        <View style={styles.headerContainer}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join Sarathi to ride and share</Text>
        </View>

        {/* Form Section */}
        <View style={styles.formContainer}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Sakar Aryal"
            placeholderTextColor={Colors.textMuted}
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 9841234567"
            placeholderTextColor={Colors.textMuted}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. sakar@email.com"
            placeholderTextColor={Colors.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Create password"
            placeholderTextColor={Colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Text style={styles.label}>College / Company</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Pulchowk Campus / Tech Inc"
            placeholderTextColor={Colors.textMuted}
            value={collegeOrCompany}
            onChangeText={setCollegeOrCompany}
          />

          <Text style={styles.label}>Choose Your Role</Text>
          <View style={styles.roleContainer}>
            <TouchableOpacity 
              style={[styles.roleOption, role === 'passenger' && styles.roleOptionSelected]}
              onPress={() => setRole('passenger')}
            >
              <Ionicons name="person-outline" size={20} color={role === 'passenger' ? Colors.background : Colors.primary} />
              <Text style={[styles.roleText, role === 'passenger' && styles.roleTextSelected]}>Passenger</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.roleOption, role === 'driver' && styles.roleOptionSelected]}
              onPress={() => setRole('driver')}
            >
              <Ionicons name="car-outline" size={20} color={role === 'driver' ? Colors.background : Colors.primary} />
              <Text style={[styles.roleText, role === 'driver' && styles.roleTextSelected]}>Rider/Driver</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.signupButton} onPress={handleSignup}>
            <Text style={styles.signupButtonText}>Send OTP Verification</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
            <Text style={styles.loginText}>Log In</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 50,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textMuted,
  },
  formContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  roleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 12,
  },
  roleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    backgroundColor: Colors.surface,
    gap: 6,
  },
  roleOptionSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accent,
  },
  roleText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  roleTextSelected: {
    color: Colors.background,
  },
  signupButton: {
    backgroundColor: Colors.accent,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  signupButtonText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: 'bold',
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  footerText: {
    color: Colors.textMuted,
    fontSize: 15,
  },
  loginText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: 'bold',
  },
});
