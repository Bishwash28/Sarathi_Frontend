import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ImageBackground, StatusBar, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useApp } from '../../context/AppContext';
import { validateName, validateEmail, validatePassword, hasScriptTags, sanitizeInput } from '../../utils/validation';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SignupScreen() {
  const { signup, loginWithGoogle } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  /** When true, replaces the form with a "check your email" confirmation panel. */
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [signupEmail, setSignupEmail] = useState('');

  const handleGoogleLogin = async () => {
    if (isLoading) return;
    setIsLoading(true);
    const result = await loginWithGoogle();
    setIsLoading(false);

    if (!result.success) {
      alert(result.error || 'Google login failed');
      return;
    }
    router.replace('/(tabs)');
  };

  const handleSignup = async () => {
    if (isLoading) return;
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

    // 4. Phone validation
    const cleanPhone = sanitizeInput(phone).replace(/\s+/g, '');
    if (!cleanPhone || cleanPhone.length < 7) {
      alert('Please enter a valid phone number.');
      return;
    }

    // 5. Password validation (min 8 chars, upper, lower, symbol)
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.isValid) {
      alert(passwordCheck.message);
      return;
    }
    
    setIsLoading(true);
    const result = await signup({
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      password,
      role: 'passenger',
    });
    setIsLoading(false);
    
    if (!result.success) {
      alert(result.error || 'Signup failed');
      return;
    }

    // Show confirmation panel — do NOT auto-navigate to tabs.
    // When the backend adds email verification, the user will need to verify
    // before logging in. Showing this panel is correct in both scenarios.
    setSignupEmail(cleanEmail);
    setSignupSuccess(true);
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

            {/* ── Success / Email Confirmation Panel ──────────────────────── */}
            {signupSuccess ? (
              <View style={styles.successContainer}>
                <View style={styles.successIconWrap}>
                  <Ionicons name="mail-open-outline" size={52} color={Colors.primary} />
                </View>
                <Text style={styles.successTitle}>Account Created!</Text>
                <Text style={styles.successBody}>
                  Your Sarathi account has been created successfully.
                  {"\n\n"}
                  We may have sent a verification link to{' '}
                  <Text style={styles.successEmail}>{signupEmail}</Text>.
                  {" Please check your inbox (and spam/junk folder) and verify your email before logging in."}
                </Text>
                <TouchableOpacity
                  style={styles.goToLoginButton}
                  onPress={() => router.replace('/(auth)/login')}
                  activeOpacity={0.85}
                >
                  <Ionicons name="log-in-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.goToLoginText}>Go to Log In</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
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
                      placeholder="e.g. John Doe"
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
                      placeholder="e.g. user@email.com"
                      placeholderTextColor="#94A3B8"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>

                  <Text style={styles.label}>Phone Number</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="call-outline" size={20} color={Colors.primary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 9841234567"
                      placeholderTextColor="#94A3B8"
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
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

                  <TouchableOpacity
                    style={[styles.signupButton, isLoading && styles.signupButtonDisabled]}
                    onPress={handleSignup}
                    activeOpacity={0.85}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Text style={styles.signupButtonText}>Create Account</Text>
                        <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
                      </>
                    )}
                  </TouchableOpacity>

                  {/* Divider */}
                  <View style={styles.dividerContainer}>
                    <View style={styles.divider} />
                    <Text style={styles.dividerText}>OR</Text>
                    <View style={styles.divider} />
                  </View>

                  {/* Social Auth */}
                  <TouchableOpacity style={[styles.googleButton, isLoading && { opacity: 0.5 }]} onPress={handleGoogleLogin} activeOpacity={0.85} disabled={isLoading}>
                    <Ionicons name="logo-google" size={20} color="#EA4335" style={{ marginRight: 8 }} />
                    <Text style={styles.googleButtonText}>Continue with Google</Text>
                  </TouchableOpacity>
                </View>

                {/* Footer */}
                <View style={styles.footerContainer}>
                  <Text style={styles.footerText}>Already have an account? </Text>
                  <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
                    <Text style={styles.loginText}>Log In</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

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
  // ── Success Panel ───────────────────────────────────────────────────────────────
  successContainer: {
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 32,
  },
  successIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FEF2F2',
    borderWidth: 2,
    borderColor: '#FCA5A5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#C62026',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  successTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 16,
    textAlign: 'center',
  },
  successBody: {
    fontSize: 14.5,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  successEmail: {
    fontWeight: '700',
    color: Colors.primary,
  },
  goToLoginButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 32,
    borderRadius: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  goToLoginText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // ────────────────────────────────────────────────────────────────────────────
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
  signupButtonDisabled: {
    opacity: 0.65,
    shadowOpacity: 0,
    elevation: 0,
  },
  signupButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 22,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    marginHorizontal: 14,
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 14,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleButtonText: {
    color: '#334155',
    fontSize: 15,
    fontWeight: '600',
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

