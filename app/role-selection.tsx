import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Dimensions, Image, ImageBackground, Modal, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '../constants/Colors';

const { width } = Dimensions.get('window');

type Role = 'passenger' | 'driver' | null;

export default function RoleSelectionScreen() {
  const [selectedRole, setSelectedRole] = useState<Role>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);

  const handleContinue = () => {
    if (selectedRole === 'passenger') {
      router.replace('/(tabs)');
    } else if (selectedRole === 'driver') {
      router.push('/kyc');
    }
  };

  return (
    <ImageBackground
      source={require('../assets/images/white_map_bg.png')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.container}>
          {/* Unified Header with direct map background integration */}
          <View style={styles.header}>
            <Image
              source={require('../assets/images/text_logo.png')}
              style={styles.headerLogoImage}
              resizeMode="contain"
            />
            <TouchableOpacity
              onPress={() => setShowHelpModal(true)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="help-circle-outline" size={28} color={Colors.primary} />
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
              <View style={styles.cardTextContainer}>
                <Text style={[styles.cardTitle, { color: Colors.primary }]}>Book a Ride</Text>
                <Text style={styles.cardSubtitle}>Get a reliable ride in minutes</Text>
              </View>
              {selectedRole === 'passenger' && (
                <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
              )}
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
              <View style={styles.cardTextContainer}>
                <Text style={[styles.cardTitle, { color: Colors.primary }]}>Offer a Ride</Text>
                <Text style={styles.cardSubtitle}>Earn by sharing your journey</Text>
              </View>
              {selectedRole === 'driver' && (
                <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
              )}
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
                color={!selectedRole ? '#9CA3AF' : '#FFFFFF'}
                style={{ marginLeft: 8 }}
              />
            </TouchableOpacity>
          </View>

          {/* Working Help Modal */}
          <Modal
            visible={showHelpModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowHelpModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Ionicons name="help-circle" size={36} color={Colors.primary} />
                  <Text style={styles.modalTitle}>Need Assistance?</Text>
                </View>

                <Text style={styles.modalText}>
                  <Text style={{ fontWeight: 'bold' }}>• Book a Ride:</Text> Select this if you are a commuter looking to find rides along your route.
                </Text>
                <Text style={styles.modalText}>
                  <Text style={{ fontWeight: 'bold' }}>• Offer a Ride:</Text> Select this if you are a driver with a vehicle wanting to share your route and earn.
                </Text>

                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setShowHelpModal(false)}
                >
                  <Text style={styles.modalCloseButtonText}>Got it!</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    marginBottom: 36,
  },
  headerLogoImage: {
    width: 140,
    height: 38,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 10,
    lineHeight: 22,
  },
  cardsContainer: {
    marginBottom: 40,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  selectedCard: {
    borderColor: Colors.primary,
    backgroundColor: '#FFFFFF',
  },
  cardTextContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  footer: {
    paddingVertical: 20,
    position: 'absolute',
    bottom: 10,
    left: 24,
    right: 24,
  },
  continueButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 30,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#E2E8F0',
  },
  disabledButtonText: {
    color: '#94A3B8',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    marginTop: 8,
  },
  modalText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 12,
    width: '100%',
  },
  modalCloseButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 20,
    marginTop: 12,
  },
  modalCloseButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
