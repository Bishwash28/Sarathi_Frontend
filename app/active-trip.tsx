import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  Alert,
  TextInput,
  ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { useApp, LANDMARKS } from '../context/AppContext';
import { RouteMap } from '../components/RouteMap';
import { makePhoneCall } from '../utils/phoneUtils';

export default function ActiveTripScreen() {
  const { rideId } = useLocalSearchParams();
  const {
    user,
    bookings,
    rides,
    activeBooking,
    activeTripProgress,
    nudgeDriverLocation,
    verifyPickupOtp,
    verifyCompletionOtp,
    processPayment,
    submitRideRating,
  } = useApp();

  const [inputPickupOtp, setInputPickupOtp] = useState('');
  const [inputCompletionOtp, setInputCompletionOtp] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<'cash' | 'khalti' | 'esewa'>('esewa');
  const [selectedStars, setSelectedStars] = useState<number>(5);
  const [reviewText, setReviewText] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>(['Safe Riding', 'Clean Vehicle']);

  const currentBooking = activeBooking || bookings.find(b => b.rideId === rideId);
  const ride = rides.find(r => r.id === (currentBooking?.rideId || rideId));

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.log('Location permission was denied.');
        }
      } catch (error) {
        console.log('Error requesting location permissions:', error);
      }
    })();
  }, []);

  if (!ride || !currentBooking) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={56} color={Colors.textMuted} />
        <Text style={styles.errorText}>No active trip found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.backButtonText}>Return Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const lifecycle = currentBooking.lifecycleState || 'waiting_for_pickup';

  const handleSOS = () => {
    Alert.alert(
      'Emergency SOS',
      'Are you sure you want to trigger SOS? This will alert emergency services and your emergency contact immediately.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Trigger SOS', onPress: () => Alert.alert('SOS Triggered', 'Emergency services and contacts notified.'), style: 'destructive' }
      ]
    );
  };

  const handleVerifyPickup = () => {
    const res = verifyPickupOtp(currentBooking.id, inputPickupOtp || '4821');
    if (!res.success) {
      Alert.alert('Verification Failed', res.error || 'Incorrect OTP');
    }
  };

  const handleVerifyCompletion = () => {
    const res = verifyCompletionOtp(currentBooking.id, inputCompletionOtp || '7392');
    if (!res.success) {
      Alert.alert('Verification Failed', res.error || 'Incorrect OTP');
    }
  };

  const handlePayNow = () => {
    const res = processPayment(currentBooking.id, selectedPayment);
    if (!res.success) {
      Alert.alert('Payment Failed', res.error || 'Payment process failed.');
    }
  };

  const handleSubmitRating = () => {
    submitRideRating(currentBooking.id, selectedStars, reviewText);
    Alert.alert('Thank You!', 'Your rating has been submitted successfully.', [
      { text: 'Done', onPress: () => router.replace('/(tabs)') }
    ]);
  };

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(prev => prev.filter(t => t !== tag));
    } else {
      setSelectedTags(prev => [...prev, tag]);
    }
  };

  const startLandmark = LANDMARKS[currentBooking.passengerPickup || ride.route[0]] || LANDMARKS['Butwal'];
  const endLandmark = LANDMARKS[currentBooking.passengerDropoff || ride.route[ride.route.length - 1]] || LANDMARKS['Bhairahawa'];

  const startCoord = { latitude: startLandmark.latitude, longitude: startLandmark.longitude };
  const endCoord = { latitude: endLandmark.latitude, longitude: endLandmark.longitude };

  const liveCoord = (currentBooking.currentLat && currentBooking.currentLng)
    ? { latitude: currentBooking.currentLat, longitude: currentBooking.currentLng }
    : startCoord;

  const eta = Math.max(1, Math.ceil((100 - activeTripProgress) / 10));

  const handleCallParticipant = () => {
    const isDriver = user?.role === 'driver';
    const targetPhone = isDriver ? (currentBooking.passengerPhone || '+9779841234567') : (ride.phone || '+9779841234567');
    makePhoneCall(targetPhone);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.topHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>
              {lifecycle === 'payment_pending'
                ? 'Payment & Fare Summary'
                : lifecycle === 'rating_pending'
                ? 'Rate Your Driver'
                : 'Live Trip Tracking'}
            </Text>
            <Text style={styles.headerSub}>
              {currentBooking.passengerPickup} ➔ {currentBooking.passengerDropoff}
            </Text>
          </View>

          <View style={styles.etaContainer}>
            <Text style={styles.etaLabel}>Status</Text>
            <Text style={styles.etaValue}>
              {lifecycle === 'waiting_for_pickup' || lifecycle === 'pickup_otp_required'
                ? 'Arriving'
                : lifecycle === 'ride_started'
                ? `${eta} mins`
                : lifecycle === 'payment_pending'
                ? 'Pay Fare'
                : lifecycle === 'rating_pending'
                ? 'Rate'
                : 'Completed'}
            </Text>
          </View>
        </View>

        {/* ── Map View (for tracking states) ── */}
        {(lifecycle === 'waiting_for_pickup' ||
          lifecycle === 'pickup_otp_required' ||
          lifecycle === 'ride_started' ||
          lifecycle === 'completion_otp_required') && (
          <View style={styles.mapWrapper}>
            <RouteMap
              startCoord={startCoord}
              endCoord={endCoord}
              liveCoord={liveCoord}
              vehicleType={ride.vehicleType}
            />
          </View>
        )}

        {/* ── Dynamic State Body ── */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
          {/* STEP 1 & 2: Pickup OTP State */}
          {(lifecycle === 'waiting_for_pickup' || lifecycle === 'pickup_otp_required') && (
            <View style={styles.stepCard}>
              <View style={styles.otpBanner}>
                <Ionicons name="key" size={24} color="#FFF" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.otpBannerTitle}>YOUR PICKUP OTP</Text>
                  <Text style={styles.otpBannerCode}>{currentBooking.pickupOtp || '4821'}</Text>
                </View>
              </View>
              <Text style={styles.stepHelpText}>
                Provide this 4-digit code to {ride.riderName} upon vehicle pickup to start the ride.
              </Text>

              <View style={styles.divider} />
              <Text style={styles.inputLabelText}>Driver OTP Entry (Verification):</Text>
              <View style={styles.otpInputRow}>
                <TextInput
                  style={styles.otpTextInput}
                  placeholder="Enter OTP (4821)"
                  placeholderTextColor={Colors.textMuted}
                  value={inputPickupOtp}
                  onChangeText={setInputPickupOtp}
                  keyboardType="numeric"
                  maxLength={4}
                />
                <TouchableOpacity style={styles.verifyButton} onPress={handleVerifyPickup}>
                  <Text style={styles.verifyButtonText}>Verify & Start</Text>
                </TouchableOpacity>
              </View>
              {currentBooking.otpError && (
                <Text style={styles.otpErrorText}>{currentBooking.otpError}</Text>
              )}
            </View>
          )}

          {/* STEP 3: Ride Started & Live Tracking */}
          {lifecycle === 'ride_started' && (
            <View style={styles.stepCard}>
              <View style={styles.ongoingHeader}>
                <Ionicons name="navigate-circle" size={28} color="#16A34A" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.ongoingTitle}>Ride in Progress</Text>
                  <Text style={styles.ongoingSub}>En route to {currentBooking.passengerDropoff}</Text>
                </View>
                <Text style={styles.progressBadge}>{activeTripProgress}%</Text>
              </View>

              <View style={styles.divider} />

              <TouchableOpacity
                style={styles.nudgeButton}
                onPress={() => nudgeDriverLocation(currentBooking.id)}
              >
                <Ionicons name="location" size={18} color="#FFF" />
                <Text style={styles.nudgeButtonText}>Dev: Simulate Live GPS Progress</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.verifyButton, { backgroundColor: Colors.accent, marginTop: 8 }]}
                onPress={() => verifyCompletionOtp(currentBooking.id, '7392')}
              >
                <Ionicons name="flag" size={18} color="#FFF" />
                <Text style={styles.verifyButtonText}>Dev: Reach Destination</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 4: Completion OTP Verification */}
          {lifecycle === 'completion_otp_required' && (
            <View style={styles.stepCard}>
              <View style={[styles.otpBanner, { backgroundColor: '#7C3AED' }]}>
                <Ionicons name="checkmark-done-circle" size={24} color="#FFF" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.otpBannerTitle}>YOUR RIDE COMPLETION OTP</Text>
                  <Text style={styles.otpBannerCode}>{currentBooking.completionOtp || '7392'}</Text>
                </View>
              </View>
              <Text style={styles.stepHelpText}>
                Share this completion OTP with {ride.riderName} to confirm you reached {currentBooking.passengerDropoff}.
              </Text>

              <View style={styles.divider} />
              <Text style={styles.inputLabelText}>Driver Completion Verification:</Text>
              <View style={styles.otpInputRow}>
                <TextInput
                  style={styles.otpTextInput}
                  placeholder="Enter OTP (7392)"
                  placeholderTextColor={Colors.textMuted}
                  value={inputCompletionOtp}
                  onChangeText={setInputCompletionOtp}
                  keyboardType="numeric"
                  maxLength={4}
                />
                <TouchableOpacity style={[styles.verifyButton, { backgroundColor: '#7C3AED' }]} onPress={handleVerifyCompletion}>
                  <Text style={styles.verifyButtonText}>Verify End</Text>
                </TouchableOpacity>
              </View>
              {currentBooking.otpError && (
                <Text style={styles.otpErrorText}>{currentBooking.otpError}</Text>
              )}
            </View>
          )}

          {/* STEP 5: Payment Screen */}
          {lifecycle === 'payment_pending' && (
            <View style={styles.stepCard}>
              <Text style={styles.cardHeaderTitle}>Ride Fare Breakdown</Text>
              <View style={styles.fareRow}>
                <Text style={styles.fareLabel}>Base Fare</Text>
                <Text style={styles.fareValue}>NPR 100</Text>
              </View>
              <View style={styles.fareRow}>
                <Text style={styles.fareLabel}>Distance Fare (12.4 km)</Text>
                <Text style={styles.fareValue}>NPR 80</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Payable</Text>
                <Text style={styles.totalValue}>NPR {ride.price || 180}</Text>
              </View>

              <Text style={[styles.cardHeaderTitle, { marginTop: 20 }]}>Select Payment Method</Text>

              <TouchableOpacity
                style={[styles.paymentCard, selectedPayment === 'esewa' && styles.selectedPaymentCard]}
                onPress={() => setSelectedPayment('esewa')}
              >
                <Ionicons name="wallet" size={24} color="#60BB46" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.paymentName}>eSewa Digital Wallet</Text>
                  <Text style={styles.paymentSub}>Instant digital payment</Text>
                </View>
                {selectedPayment === 'esewa' && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.paymentCard, selectedPayment === 'khalti' && styles.selectedPaymentCard]}
                onPress={() => setSelectedPayment('khalti')}
              >
                <Ionicons name="card" size={24} color="#5C2D91" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.paymentName}>Khalti Wallet</Text>
                  <Text style={styles.paymentSub}>Fast online checkout</Text>
                </View>
                {selectedPayment === 'khalti' && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.paymentCard, selectedPayment === 'cash' && styles.selectedPaymentCard]}
                onPress={() => setSelectedPayment('cash')}
              >
                <Ionicons name="cash" size={24} color="#16A34A" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.paymentName}>Cash Payment</Text>
                  <Text style={styles.paymentSub}>Pay driver directly in cash</Text>
                </View>
                {selectedPayment === 'cash' && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />}
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionMainButton} onPress={handlePayNow}>
                <Ionicons name="checkmark-done" size={20} color="#FFF" />
                <Text style={styles.actionMainButtonText}>Confirm & Pay NPR {ride.price || 180}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 6: Rating & Review */}
          {lifecycle === 'rating_pending' && (
            <View style={styles.stepCard}>
              <Text style={styles.cardHeaderTitle}>Rate Your Driver</Text>
              <Text style={styles.stepHelpText}>How was your trip with {ride.riderName}?</Text>

              {/* Star Rating Row */}
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map(star => (
                  <TouchableOpacity key={star} onPress={() => setSelectedStars(star)}>
                    <Ionicons
                      name={star <= selectedStars ? 'star' : 'star-outline'}
                      size={36}
                      color="#F59E0B"
                    />
                  </TouchableOpacity>
                ))}
              </View>

              {/* Feedback Tags */}
              <Text style={styles.inputLabelText}>Quick Feedback:</Text>
              <View style={styles.tagsContainer}>
                {['Safe Riding', 'Clean Vehicle', 'Punctual Driver', 'Friendly Behavior', 'Great Route'].map(tag => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <TouchableOpacity
                      key={tag}
                      style={[styles.tagChip, isSelected && styles.selectedTagChip]}
                      onPress={() => toggleTag(tag)}
                    >
                      <Text style={[styles.tagText, isSelected && styles.selectedTagText]}>{tag}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Comment Input */}
              <Text style={styles.inputLabelText}>Optional Comment:</Text>
              <TextInput
                style={styles.commentInput}
                placeholder="Write a comment about your ride experience..."
                placeholderTextColor={Colors.textMuted}
                value={reviewText}
                onChangeText={setReviewText}
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity style={[styles.actionMainButton, { backgroundColor: Colors.success }]} onPress={handleSubmitRating}>
                <Ionicons name="star" size={20} color="#FFF" />
                <Text style={styles.actionMainButtonText}>Submit Rating & Complete</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Participant Summary Footer Panel */}
          <View style={styles.driverPanel}>
            <Image source={{ uri: ride.riderPhoto }} style={styles.driverPhoto} />
            <View style={{ flex: 1 }}>
              <Text style={styles.driverName}>{user?.role === 'driver' ? currentBooking.passengerId.split('@')[0] : ride.riderName}</Text>
              <Text style={styles.vehicleInfo}>{ride.vehicleName} • {ride.vehicleNumber}</Text>
            </View>

            <TouchableOpacity style={styles.callIconButton} onPress={handleCallParticipant}>
              <Ionicons name="call" size={18} color="#FFF" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.sosIconButton} onPress={handleSOS}>
              <Ionicons name="alert-circle" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Floating Minimize Button */}
        <TouchableOpacity style={styles.minimizeButton} onPress={() => router.replace('/(tabs)')}>
          <Ionicons name="grid-outline" size={18} color={Colors.primary} />
          <Text style={styles.minimizeButtonText}>Minimize to App</Text>
        </TouchableOpacity>
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
    padding: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginVertical: 12,
  },
  backButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  backButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  headerSub: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  etaContainer: {
    alignItems: 'flex-end',
  },
  etaLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  etaValue: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.accent,
  },
  mapWrapper: {
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  stepCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  otpBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  otpBannerTitle: {
    fontSize: 10,
    color: '#93C5FD',
    fontWeight: '800',
    letterSpacing: 1,
  },
  otpBannerCode: {
    fontSize: 26,
    color: '#FFFFFF',
    fontWeight: '900',
    letterSpacing: 4,
  },
  stepHelpText: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 10,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 14,
  },
  inputLabelText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  otpInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  otpTextInput: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 16,
    color: Colors.textPrimary,
    fontWeight: 'bold',
  },
  verifyButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 18,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  verifyButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  otpErrorText: {
    color: Colors.error,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  ongoingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ongoingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  ongoingSub: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  progressBadge: {
    backgroundColor: '#DCFCE7',
    color: '#166534',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    fontWeight: 'bold',
    fontSize: 13,
  },
  nudgeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F766E',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  nudgeButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  cardHeaderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  fareLabel: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  fareValue: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.accent,
  },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    gap: 12,
  },
  selectedPaymentCard: {
    borderColor: Colors.primary,
    backgroundColor: '#EFF6FF',
  },
  paymentName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  paymentSub: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  actionMainButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  actionMainButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginVertical: 14,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  tagChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  selectedTagChip: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tagText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  selectedTagText: {
    color: '#FFF',
  },
  commentInput: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    fontSize: 13,
    color: Colors.textPrimary,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  driverPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  driverPhoto: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  driverName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  vehicleInfo: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  callIconButton: {
    backgroundColor: Colors.accent,
    padding: 10,
    borderRadius: 12,
  },
  sosIconButton: {
    backgroundColor: Colors.error,
    padding: 10,
    borderRadius: 12,
  },
  minimizeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
    marginTop: 8,
  },
  minimizeButtonText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
});
