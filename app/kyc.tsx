import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../constants/Colors';

export default function KYCScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>KYC Verification</Text>
      <Text style={styles.subtitle}>This screen will handle KYC flow for drivers later.</Text>

      <TouchableOpacity 
        style={styles.button}
        onPress={() => router.replace('/(tabs)')}
      >
        <Text style={styles.buttonText}>Simulate KYC Complete & Go to Home</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.button, styles.backButton]}
        onPress={() => router.back()}
      >
        <Text style={[styles.buttonText, { color: Colors.primary }]}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: Colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 40,
  },
  button: {
    backgroundColor: Colors.accent,
    padding: 16,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: 'bold',
  },
  backButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.primary,
  }
});
