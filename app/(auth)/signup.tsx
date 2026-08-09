import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ImageBackground, StatusBar } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useApp } from '../../context/AppContext';
import { validateName, validateEmail, validatePassword, hasScriptTags, sanitizeInput } from '../../utils/validation';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SignupScreen() {
  const { signup } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSignup = async () => {
    // 1. Script Tag Security Check
    if (hasScriptTags(name) || hasScriptTags(email) || hasScriptTags(password)) {
      alert('Security Error: Script tags and HTML tags are strictly prohibited.');
      return;
    }

    const cleanName = sanitizeInput(name);
    const cleanEmail = sanitizeInput(email);

    // 2. Name validation (no symbols)
    const nameCheck = validateName(cleanName);
    if (!nameCheck.isValid) {
      alert(nameCheck.message);
      return;
    }

    // 3. Email validation (no temp mail)
    const emailCheck = validateEmail(cleanEmail);
    if (!emailCheck.isValid) {
      alert(emailCheck.message);
      return;
    }

    // 4. Password validation (min 8 chars, upper, lower, symbol)
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.isValid) {
      alert(passwordCheck.message);
      return;
    }
    
    const result = await signup({
      name: cleanName,
      email: cleanEmail,
      password,
      role: 'passenger',
    });
    
    if (!result.success) {
      alert(result.error || 'Signup failed');
      return;
    }

    // Proceed to OTP / Next screen
    router.push({
      pathname: '/(auth)/otp',
      params: { email: cleanEmail, name: cleanName }
    });
  };

  return (
    <ImageBackground
      source={require('../../assets/images/white_map_bg.png')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
          <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
            
            {/* Header Section */}
            <View style={styles.headerContainer}>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Join Sarathi to ride and share together</Text>
            </View>

            {/* Glassmorphic Form Card */}
            <View style={styles.card}>
              <Text style={styles.label}>Full Name</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color={Colors.primary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Sakar Aryal"
                  placeholderTextColor="#94A3B8"
                  value={name}
                  onChangeText={setName}
                />
              </View>

              <Text style={styles.label}>Email Address</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color={Colors.primary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. sakar@email.com"
                  placeholderTextColor="#94A3B8"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <Text style={styles.label}>Password</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color={Colors.primary} style={styles.inputIcon} />
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Min 8 chars, 1 Upper, 1 Lower & 1 Symbol"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity 
                  style={styles.eyeIcon} 
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons 
                    name={showPassword ? "eye-outline" : "eye-off-outline"} 
                    size={20} 
                    color="#64748B" 
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.signupButton} onPress={handleSignup} activeOpacity={0.85}>
                <Text style={styles.signupButtonText}>Create Account</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
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
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 30,
    justifyContent: 'center',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#C62026',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
  },
  card: {
    backgroundColor: 'transparent',
    padding: 0,
    marginBottom: 24,
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
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    marginBottom: 18,
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
  passwordInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: '#0F172A',
  },
  eyeIcon: {
    paddingLeft: 10,
  },
  signupButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  signupButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: '#64748B',
    fontSize: 15,
  },
  loginText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: 'bold',
  },
});
