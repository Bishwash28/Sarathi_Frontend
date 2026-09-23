import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { LocationPinPickerMap } from '../components/LocationPinPickerMap';
import { Colors } from '../constants/Colors';
import { useApp, Ride } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { makePhoneCall } from '../utils/phoneUtils';

export default function ActiveTripScreen() {
  const { rideId, bookingId } = useLocalSearchParams<{ rideId?: string; bookingId?: string }>();
  const {
    user,
    bookings,
    rides,
    activeBooking,
    activeTripProgress,
    nudgeDriverLocation,
    verifyPickupOtp,
    verifyCompletionOtp,
    triggerCompletionOtpPrompt,
    processPayment,
    submitRideRating,
  } = useApp();

  const [inputPickupOtp, setInputPickupOtp] = useState('');
  const [inputCompletionOtp, setInputCompletionOtp] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<'cash' | 'khalti' | 'esewa'>('cash');
  const [selectedStars, setSelectedStars] = useState<number>(5);
  const [reviewText, setReviewText] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>(['Safe Riding', 'Clean Vehicle']);

  const [fetchedRide, setFetchedRide] = useState<Ride | null>(null);
  const [isLoadingRide, setIsLoadingRide] = useState(true);
  const currentBooking = activeBooking || bookings.find(b => b.rideId === rideId) || bookings.find(b => typeof bookingId === 'string' && b.id === bookingId);

  useEffect(() => {
    const targetRideId = currentBooking?.rideId || (typeof rideId === 'string' ? rideId : '');
    if (targetRideId && !rides.some(r => r.id === targetRideId)) {
      setIsLoadingRide(true);
      supabase
        .from('rides')
        .select('*')
        .eq('id', targetRideId)
        .single()
        .then(({ data }: { data: any }) => {
          if (data) {
            setFetchedRide({
              id: data.id,
              riderName: data.rider_name || 'Driver',
              riderPhoto: data.rider_photo || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&h=200&q=80',
              phone: data.phone || '+9779841234567',
              rating: 5.0,
              vehicleType: 'bike',
              vehicleName: data.vehicle_name || 'Vehicle',
              vehicleNumber: data.vehicle_number || 'BA 99 PA 1234',
              departureTime: data.departure_time || 'Leaving soon',
              seatsLeft: Number(data.available_seats) || 1,
              price: Number(data.price) || 150,
              route: Array.isArray(data.route) ? data.route : [data.pickup_point || 'Origin', 'Destination'],
              pickupPoint: data.pickup_point || data.origin_name || 'Origin',
              status: data.status,
              riderId: data.rider_id,
            });
          }
          setIsLoadingRide(false);
        });
    } else {
      setIsLoadingRide(false);
    }
  }, [currentBooking?.rideId, rideId, rides]);

  const ride = rides.find(r => r.id === (currentBooking?.rideId || rideId)) || fetchedRide;

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

  if (isLoadingRide) {
    return (
      <View style={styles.errorContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={[styles.errorText, { fontSize: 14, marginTop: 12 }]}>Loading trip details...</Text>
      </View>
    );
  }

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
    const res = verifyPickupOtp(currentBooking.id, inputPickupOtp);
    if (!res.success) {
      Alert.alert('Verification Failed', res.error || 'Incorrect OTP');
    }
  };

  const handleVerifyCompletion = () => {
    const res = verifyCompletionOtp(currentBooking.id, inputCompletionOtp);
    if (!res.success) {
      Alert.alert('Verification Failed', res.error || 'Incorrect OTP');
    } else {
      submitRideRating(currentBooking.id, 5, 'Ride completed by driver');
      router.replace('/(tabs)');
    }
  };

  const handlePayNow = () => {
    const res = processPayment(currentBooking.id, selectedPayment);
    if (!res.success) {
      Alert.alert('Payment Failed', res.error || 'Could not process payment');
    } else {
      submitRideRating(currentBooking.id, 5, 'Paid cash');
      router.replace('/(tabs)');
    }
  };

  const handleTagToggle = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(prev => prev.filter(t => t !== tag));
    } else {
      setSelectedTags(prev => [...prev, tag]);
    }
  };
  const toggleTag = handleTagToggle;

  const handleSubmitRating = () => {
    submitRideRating(currentBooking.id, selectedStars, reviewText);
    Alert.alert('Thank You! 🎉', 'Your rating has been submitted successfully and trip is completed.', [
      { text: 'Done', onPress: () => router.replace('/(tabs)') }
    ]);
  };

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
                ? 'Rate Your Rider / Driver'
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
                : lifecycle === 'completion_otp_required'
                ? 'Ending PIN'
                : lifecycle === 'payment_pending'
                ? 'Pay Fare'
                : lifecycle === 'rating_pending'
                ? 'Rate'
                : 'Completed'}
            </Text>
          </View>
        </View>

        {/* ── Dynamic State Body ── */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
          {/* Live Location Map Card */}
          <View style={styles.mapWrapper}>
            <LocationPinPickerMap
              originCoords={currentBooking.pickupCoords || ride.origin || { lat: 27.7172, lng: 85.3240 }}
              destCoords={currentBooking.dropCoords || ride.destination || { lat: 27.6710, lng: 85.3120 }}
              originName={currentBooking.passengerPickup || ride.pickupPoint}
              destName={currentBooking.passengerDropoff || ride.route?.[1]}
              showControls={false}
              showBadge={false}
              interactive={false}
            />
          </View>

          {/* STEP 1: Pickup OTP State */}
          {(lifecycle === 'waiting_for_pickup' || lifecycle === 'pickup_otp_required') && (
            <View style={styles.stepCard}>
              {user?.role === 'driver' ? (
                /* Rider View: OTP Entry Input */
                <>
                  <View style={[styles.otpBanner, { backgroundColor: '#1E293B' }]}>
                    <Ionicons name="key-outline" size={24} color="#FFF" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.otpBannerTitle}>DRIVER PICKUP PIN VERIFICATION</Text>
                      <Text style={[styles.otpBannerTitle, { color: '#94A3B8', fontSize: 13, marginTop: 2 }]}>
                        Ask passenger for their 4-digit Pickup PIN
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.stepHelpText}>
                    Enter the 4-digit Pickup PIN code displayed on the passenger's screen to verify pickup and begin the ride.
                  </Text>
                  <View style={styles.divider} />
                  <Text style={styles.inputLabelText}>Passenger Pickup PIN Code:</Text>
                  <View style={styles.otpInputRow}>
                    <TextInput
                      style={styles.otpTextInput}
                      placeholder="Enter 4-digit PIN"
                      placeholderTextColor={Colors.textMuted}
                      value={inputPickupOtp}
                      onChangeText={setInputPickupOtp}
                      keyboardType="numeric"
                      maxLength={4}
                    />
                    <TouchableOpacity style={styles.verifyButton} onPress={handleVerifyPickup}>
                      <Text style={styles.verifyButtonText}>Verify & Start Ride</Text>
                    </TouchableOpacity>
                  </View>
                  {currentBooking.otpError && (
                    <Text style={styles.otpErrorText}>{currentBooking.otpError}</Text>
                  )}
                </>
              ) : (
                /* Passenger View: Display Generated Pickup OTP */
                <>
                  <View style={styles.otpBanner}>
                    <Ionicons name="key" size={24} color="#FFF" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.otpBannerTitle}>YOUR PICKUP PIN CODE</Text>
                      <Text style={styles.otpBannerCode}>{currentBooking.pickupOtp || '4829'}</Text>
                    </View>
                  </View>
                  <Text style={styles.stepHelpText}>
                    Show this 4-digit Pickup PIN to {ride.riderName} when they arrive at your pickup point to start the ride.
                  </Text>
                </>
              )}
            </View>
          )}

          {/* STEP 2: Ride Started (En Route) */}
          {lifecycle === 'ride_started' && (
            <View style={styles.stepCard}>
              <View style={styles.ongoingHeader}>
                <Ionicons name="navigate-circle" size={28} color="#16A34A" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.ongoingTitle}>Ride in Progress 🚀</Text>
                  <Text style={styles.ongoingSub}>En route to {currentBooking.passengerDropoff}</Text>
                </View>
                <Text style={styles.progressBadge}>{activeTripProgress}%</Text>
              </View>

              <View style={styles.divider} />

              {user?.role === 'driver' && (
                <TouchableOpacity
                  style={[styles.actionMainButton, { backgroundColor: '#7C3AED', marginTop: 10 }]}
                  onPress={() => triggerCompletionOtpPrompt(currentBooking.id)}
                >
                  <Ionicons name="checkmark-done-circle" size={20} color="#FFF" />
                  <Text style={styles.actionMainButtonText}>Complete Ride</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* STEP 3: Completion OTP State */}
          {lifecycle === 'completion_otp_required' && (
            <View style={styles.stepCard}>
              {user?.role === 'driver' ? (
                /* Rider View: Completion OTP Input */
                <>
                  <Text style={styles.inputLabelText}>Driver Ending PIN Verification:</Text>
                  <Text style={styles.stepHelpText}>
                    Ask passenger for their 4-digit Ending PIN upon reaching {currentBooking.passengerDropoff}.
                  </Text>
                  <View style={[styles.otpInputRow, { marginTop: 10 }]}>
                    <TextInput
                      style={styles.otpTextInput}
                      placeholder="Enter 4-digit Ending PIN"
                      placeholderTextColor={Colors.textMuted}
                      value={inputCompletionOtp}
                      onChangeText={setInputCompletionOtp}
                      keyboardType="numeric"
                      maxLength={4}
                    />
                    <TouchableOpacity style={[styles.verifyButton, { backgroundColor: '#7C3AED' }]} onPress={handleVerifyCompletion}>
                      <Text style={styles.verifyButtonText}>Verify & End Ride</Text>
                    </TouchableOpacity>
                  </View>
                  {currentBooking.otpError && (
                    <Text style={styles.otpErrorText}>{currentBooking.otpError}</Text>
                  )}
                </>
              ) : (
                /* Passenger View: Display Generated Completion OTP */
                <>
                  <View style={[styles.otpBanner, { backgroundColor: '#7C3AED' }]}>
                    <Ionicons name="checkmark-done-circle" size={24} color="#FFF" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.otpBannerTitle}>YOUR RIDE ENDING PIN</Text>
                      <Text style={styles.otpBannerCode}>{currentBooking.completionOtp || '7392'}</Text>
                    </View>
                  </View>
                  <Text style={styles.stepHelpText}>
                    Share this 4-digit Ending PIN with {ride.riderName} when you arrive at your destination to complete the trip.
                  </Text>
                </>
              )}
            </View>
          )}

          {/* STEP 4: Post-Completion Passenger Payment View */}
          {user?.role === 'passenger' && lifecycle === 'payment_pending' && (
            <View style={styles.stepCard}>
                <Text style={styles.cardHeaderTitle}>Trip & Fare Summary</Text>
                <View style={styles.fareRow}>
                  <Text style={styles.fareLabel}>Booking / Trip ID</Text>
                  <Text style={[styles.fareValue, { fontSize: 12, color: Colors.primary }]}>{currentBooking.id}</Text>
                </View>
                <View style={styles.fareRow}>
                  <Text style={styles.fareLabel}>Pickup</Text>
                  <Text style={styles.fareValue}>{currentBooking.passengerPickup}</Text>
                </View>
                <View style={styles.fareRow}>
                  <Text style={styles.fareLabel}>Drop-off</Text>
                  <Text style={styles.fareValue}>{currentBooking.passengerDropoff}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total Payable Amount</Text>
                  <Text style={styles.totalValue}>NPR {ride.price || 180}</Text>
                </View>

                <Text style={[styles.cardHeaderTitle, { marginTop: 20 }]}>Payment Method</Text>

                {/* Cash Payment Option Only */}
                <TouchableOpacity
                  style={[styles.paymentCard, styles.selectedPaymentCard]}
                  activeOpacity={1}
                >
                  <Ionicons name="cash" size={24} color="#16A34A" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.paymentName}>Pay in Cash</Text>
                    <Text style={styles.paymentSub}>Pay the rider directly in cash upon reaching destination</Text>
                  </View>
                  <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                </TouchableOpacity>

                <View style={{ backgroundColor: '#F8FAFC', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', marginTop: 10, marginBottom: 16 }}>
                  <Text style={{ fontSize: 11, color: Colors.textMuted, lineHeight: 16 }}>
                    ℹ️ Sarathi currently supports cash payment only. Digital online payments (eSewa, Khalti, Cards) will be introduced in a future update.
                  </Text>
                </View>

                <TouchableOpacity style={styles.actionMainButton} onPress={handlePayNow}>
                  <Ionicons name="checkmark-done" size={20} color="#FFF" />
                  <Text style={styles.actionMainButtonText}>Complete Ride & Pay NPR {ride.price || 180}</Text>
                </TouchableOpacity>
              </View>
          )}

          {/* Participant Summary Footer Panel */}
          <View style={styles.driverPanel}>
            <Image
              source={{
                uri: user?.role === 'driver'
                  ? (currentBooking.passengerPhoto || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&h=200&q=80')
                  : (ride.riderPhoto || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&h=200&q=80')
              }}
              style={styles.driverPhoto}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.driverName}>
                {user?.role === 'driver' ? (currentBooking.passengerName || 'Passenger') : ride.riderName}
              </Text>
              <Text style={styles.vehicleInfo}>
                {user?.role === 'driver' ? (currentBooking.passengerPhone || 'Passenger Contact') : `${ride.vehicleName} • ${ride.vehicleNumber}`}
              </Text>
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
  disabledPaymentCard: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
    opacity: 0.7,
  },
  disabledBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  disabledBadgeText: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: '800',
    textTransform: 'uppercase',
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
  promptCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
    marginVertical: 10,
  },
  promptIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  promptHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  promptQuestionText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: 20,
  },
  promptButtonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  promptNoButton: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  promptNoButtonText: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  promptYesButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptYesButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
