import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Dimensions, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/Colors';

const { width } = Dimensions.get('window');

type Role = 'passenger' | 'driver' | null;

export default function RoleSelectionScreen() {
  const [selectedRole, setSelectedRole] = useState<Role>(null);

  const handleContinue = () => {
    if (selectedRole === 'passenger') {
      router.replace('/(tabs)');
    } else if (selectedRole === 'driver') {
      router.push('/kyc');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerLogo}>SARATHI</Text>
          <TouchableOpacity>
            <Ionicons name="help-circle-outline" size={28} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Title Area */}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>How will you use Sarathi?</Text>
          <Text style={styles.subtitle}>Choose your role to get started with your journey.</Text>
        </View>

        {/* Role Cards */}
        <View style={styles.cardsContainer}>
          {/* Passenger Card */}
          <TouchableOpacity
            style={[
              styles.card,
              selectedRole === 'passenger' && styles.selectedCard
            ]}
            onPress={() => setSelectedRole('passenger')}
            activeOpacity={0.8}
          >
            <View style={[styles.iconContainer, { backgroundColor: '#FEF2F2' }]}>
              <Ionicons name="location-outline" size={24} color={Colors.secondary} />
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={[styles.cardTitle, { color: Colors.secondary }]}>Book a Ride</Text>
              <Text style={styles.cardSubtitle}>Get a reliable ride in minutes</Text>
            </View>
            {/* Background decorative icon */}
            <Ionicons
              name="bicycle-outline"
              size={100}
              color="#F8ECEC"
              style={styles.bgIcon}
            />
          </TouchableOpacity>

          {/* Driver Card */}
          <TouchableOpacity
            style={[
              styles.card,
              selectedRole === 'driver' && styles.selectedCard
            ]}
            onPress={() => setSelectedRole('driver')}
            activeOpacity={0.8}
          >
            <View style={[styles.iconContainer, { backgroundColor: '#F0F4FA' }]}>
              <Ionicons name="car-sport-outline" size={24} color={Colors.primary} />
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={[styles.cardTitle, { color: Colors.primary }]}>Offer a Ride</Text>
              <Text style={styles.cardSubtitle}>Earn by sharing your journey</Text>
            </View>
            {/* Background decorative icon */}
            <Ionicons
              name="car-sport-outline"
              size={100}
              color="#F0F4FA"
              style={styles.bgIcon}
            />
          </TouchableOpacity>
        </View>



        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.continueButton,
              !selectedRole && styles.disabledButton
            ]}
            onPress={handleContinue}
            disabled={!selectedRole}
          >
            <Text style={[
              styles.continueButtonText,
              !selectedRole && styles.disabledButtonText
            ]}>
              Continue
            </Text>
            <Ionicons
              name="arrow-forward"
              size={20}
              color={!selectedRole ? '#9CA3AF' : Colors.background}
              style={{ marginLeft: 8 }}
            />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 50,
  },
  headerLogo: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.secondary, // Used custom theme red
    letterSpacing: 1,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  cardsContainer: {
    marginBottom: 40,
  },
  card: {
    backgroundColor: Colors.background,
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  selectedCard: {
    borderColor: Colors.secondary,
    borderWidth: 1.5,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    zIndex: 2,
  },
  cardTextContainer: {
    flex: 1,
    zIndex: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  bgIcon: {
    position: 'absolute',
    right: -20,
    top: -10,
    zIndex: 1,
    opacity: 0.5,
  },
  graphicContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleGraphic: {
    width: width * 0.7,
    height: width * 0.7,
    borderRadius: (width * 0.7) / 2,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  innerImage: {
    width: '70%',
    height: '40%',
    borderRadius: 8,
  },
  footer: {
    paddingVertical: 20,
    justifyContent: 'flex-end',
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,

  },
  continueButton: {
    backgroundColor: Colors.accent,
    paddingVertical: 18,
    borderRadius: 30,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueButtonText: {
    color: Colors.background,
    fontSize: 18,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#E5E7EB',
  },
  disabledButtonText: {
    color: '#9CA3AF',
  },
});
