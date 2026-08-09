import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ImageBackground } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useApp } from '../../context/AppContext';
import { validateName, validateEmail, validatePassword, hasScriptTags, sanitizeInput } from '../../utils/validation';

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
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        {/* Top Header Background Banner Image with Text Overlay */}
        <ImageBackground 
          source={require('../../assets/images/home_top.png')} 
          style={styles.topHeaderBackground} 
          resizeMode="cover"
        >
          <View style={styles.headerContainer}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join Sarathi to ride and share</Text>
          </View>
        </ImageBackground>

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
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Min 8 chars, 1 Upper, 1 Lower & 1 Symbol"
              placeholderTextColor={Colors.textMuted}
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
                size={22} 
                color={Colors.textMuted} 
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.signupButton} onPress={handleSignup}>
            <Text style={styles.signupButtonText}>Create Account</Text>
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
    paddingBottom: 40,
  },
  topHeaderBackground: {
    width: '100%',
    height: 180,
    justifyContent: 'center',
    marginBottom: 30,
  },
  overlayTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  headerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    zIndex: 2,
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  formContainer: {
    paddingHorizontal: 24,
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
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    marginBottom: 16,
  },
  passwordInput: {
    flex: 1,
    padding: 14,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  eyeIcon: {
    paddingHorizontal: 14,
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
    paddingHorizontal: 24,
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
