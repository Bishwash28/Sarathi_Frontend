import React, { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { useApp } from '../context/AppContext';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function KYCScreen() {
  const { user, completeProfile } = useApp();

  // Form States
  const [phone, setPhone] = useState(user?.phone || '');
  const [nid, setNid] = useState(user?.nid || '');
  const [vehicleType, setVehicleType] = useState<'bike' | 'scooter'>('bike');
  const [vehicleName, setVehicleName] = useState(user?.vehicleName || '');
  const [vehicleNumber, setVehicleNumber] = useState(user?.vehicleNumber || '');
  
  // Simulated upload state
  const [licenseImage, setLicenseImage] = useState<string>('');
  const [plateImage, setPlateImage] = useState<string>('');

  const handleBack = () => {
    router.back();
  };

  const handleSkip = () => {
    completeProfile({
      kycVerified: false,
      role: 'driver',
    });
    router.replace('/(tabs)');
  };

  const simulateLicenseUpload = () => {
    setLicenseImage('https://images.unsplash.com/photo-1554774853-aae0a22c8aa4?auto=format&fit=crop&w=300&q=80');
    Alert.alert('Simulated Upload', 'Driver License Card uploaded successfully.');
  };

  const simulatePlateUpload = () => {
    setPlateImage('https://images.unsplash.com/photo-1593941707882-a5bba1491017?auto=format&fit=crop&w=300&q=80');
    Alert.alert('Simulated Upload', 'Vehicle Plate Image uploaded successfully.');
  };

  const handleSubmit = () => {
    if (!phone) {
      Alert.alert('Missing Field', 'Please enter your mobile number.');
      return;
    }
    if (!nid) {
      Alert.alert('Missing Field', 'Please enter your National ID (NID) number.');
      return;
    }
    if (!vehicleName) {
      Alert.alert('Missing Field', 'Please enter your vehicle model name.');
      return;
    }
    if (!vehicleNumber) {
      Alert.alert('Missing Field', 'Please enter your vehicle plate number.');
      return;
    }
    if (!licenseImage) {
      Alert.alert('Missing Document', 'Please upload a photo of your Driver License.');
      return;
    }
    if (!plateImage) {
      Alert.alert('Missing Document', 'Please upload a photo of your Vehicle Plate.');
      return;
    }

    // Update user profile inside AppContext
    completeProfile({
      phone,
      nid,
      vehicleType,
      vehicleName,
      vehicleNumber,
      licenseImage,
      plateImage,
      kycVerified: true,
      role: 'driver',
    });

    Alert.alert(
      'KYC Approved',
      'Congratulations! Your driver KYC documents have been verified successfully.',
      [
        {
          text: 'Proceed to Offer Ride',
          onPress: () => router.replace('/(tabs)'),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verification Portal</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.introCard}>
            <Ionicons name="shield-checkmark" size={32} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.introTitle}>Driver KYC Verification</Text>
              <Text style={styles.introText}>
                Complete these details to verify your identity and start offering rides on the Sarathi platform.
              </Text>
            </View>
          </View>

          {/* Phone Field */}
          <Text style={styles.inputLabel}>Mobile Number</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="call-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="e.g. 9841234567"
              placeholderTextColor={Colors.textMuted}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>

          {/* NID Field */}
          <Text style={styles.inputLabel}>National ID (NID) Number</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="card-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter your NID number"
              placeholderTextColor={Colors.textMuted}
              value={nid}
              onChangeText={setNid}
              keyboardType="numeric"
            />
          </View>

          {/* Vehicle Type Selector */}
          <Text style={styles.inputLabel}>Vehicle Type</Text>
          <View style={styles.typeSelectorRow}>
            <TouchableOpacity
              style={[styles.typeButton, vehicleType === 'bike' && styles.typeButtonActive]}
              onPress={() => setVehicleType('bike')}
            >
              <Ionicons name="bicycle" size={20} color={vehicleType === 'bike' ? '#FFF' : Colors.primary} />
              <Text style={[styles.typeButtonText, vehicleType === 'bike' && styles.typeButtonTextActive]}>Bike</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, vehicleType === 'scooter' && styles.typeButtonActive]}
              onPress={() => setVehicleType('scooter')}
            >
              <Ionicons name="speedometer-outline" size={20} color={vehicleType === 'scooter' ? '#FFF' : Colors.primary} />
              <Text style={[styles.typeButtonText, vehicleType === 'scooter' && styles.typeButtonTextActive]}>Scooter</Text>
            </TouchableOpacity>
          </View>

          {/* Vehicle Name Field */}
          <Text style={styles.inputLabel}>Vehicle Model Name</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="options-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="e.g. Pulsar 220F, Suzuki Swift"
              placeholderTextColor={Colors.textMuted}
              value={vehicleName}
              onChangeText={setVehicleName}
            />
          </View>

          {/* Plate Number Field */}
          <Text style={styles.inputLabel}>License Plate Number</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="barcode-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="e.g. BA 95 PA 8821"
              placeholderTextColor={Colors.textMuted}
              value={vehicleNumber}
              onChangeText={setVehicleNumber}
              autoCapitalize="characters"
            />
          </View>

          {/* Document Upload Slots */}
          <Text style={styles.inputLabel}>Upload Supporting Documents</Text>
          
          <View style={styles.uploadCardsContainer}>
            {/* License Upload Card */}
            <TouchableOpacity style={styles.uploadCard} onPress={simulateLicenseUpload}>
              {licenseImage ? (
                <View style={styles.previewContainer}>
                  <Image source={{ uri: licenseImage }} style={styles.uploadPreviewImage} />
                  <View style={styles.successBadge}>
                    <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                    <Text style={styles.successBadgeText}>Uploaded</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.uploadPlaceholder}>
                  <Ionicons name="document-text" size={32} color={Colors.primary} />
                  <Text style={styles.uploadTitle}>Driver License</Text>
                  <Text style={styles.uploadSubtitle}>Tap to upload Front Card</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Plate Number Upload Card */}
            <TouchableOpacity style={styles.uploadCard} onPress={simulatePlateUpload}>
              {plateImage ? (
                <View style={styles.previewContainer}>
                  <Image source={{ uri: plateImage }} style={styles.uploadPreviewImage} />
                  <View style={styles.successBadge}>
                    <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                    <Text style={styles.successBadgeText}>Uploaded</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.uploadPlaceholder}>
                  <Ionicons name="images" size={32} color={Colors.primary} />
                  <Text style={styles.uploadTitle}>Number Plate Photo</Text>
                  <Text style={styles.uploadSubtitle}>Tap to upload rear plate photo</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Submit Button */}
          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} activeOpacity={0.9}>
            <Text style={styles.submitText}>Submit KYC for Approval</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFF" />
          </TouchableOpacity>

          {/* Skip Button */}
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip} activeOpacity={0.9}>
            <Text style={styles.skipText}>Skip for Now</Text>
            <Ionicons name="arrow-forward-outline" size={18} color={Colors.primary} />
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 48,
  },
  introCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.accent + '25',
    marginBottom: 24,
  },
  introTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 4,
  },
  introText: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
    marginTop: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 12,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    height: 48,
  },
  typeButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  typeButtonTextActive: {
    color: '#FFF',
  },
  uploadCardsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
  },
  uploadCard: {
    flex: 1,
    height: 120,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    borderRadius: 16,
    overflow: 'hidden',
  },
  uploadPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  uploadTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginTop: 8,
  },
  uploadSubtitle: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  previewContainer: {
    flex: 1,
    position: 'relative',
  },
  uploadPreviewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  successBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  successBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: Colors.success,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 16,
    marginTop: 36,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  submitText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  skipButton: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 16,
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  skipText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
