import React, { useState } from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity, ScrollView, Alert, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { useApp } from '../context/AppContext';
import { validatePassengerJourney, findLandmarkIndexInRoute } from '../utils/routeValidation';
import { matchPassengerToRoute, calculateProratedFare, RouteMatchResult } from '../utils/routeMatching';

import { makePhoneCall } from '../utils/phoneUtils';

export default function RideDetailScreen() {
  const {
    id, selectedPickup, selectedDest,
    pickupLat, pickupLng, dropLat, dropLng,
    riderName: paramRiderName, vehicleName: paramVehicleName,
    vehicleNumber: paramVehicleNumber, price: paramPrice,
    seatsLeft: paramSeatsLeft, departureTime: paramDepartureTime,
    rating: paramRating,
  } = useLocalSearchParams();
  const { rides, requestBooking, bookings, startRiderChat, deviceLocation } = useApp();

  // Try to find the ride in the local rides array, fall back to params
  const foundRide = rides.find(r => r.id === id);
  const ride = foundRide ?? (id ? {
    id: id as string,
    riderName: (paramRiderName as string) || 'Driver',
    riderPhoto: '',
    phone: undefined,
    rating: parseFloat((paramRating as string) || '5') || 5,
    vehicleType: 'scooter' as const,
    vehicleName: (paramVehicleName as string) || 'Vehicle',
    vehicleNumber: (paramVehicleNumber as string) || '',
    departureTime: (paramDepartureTime as string) || 'Soon',
    seatsLeft: parseInt((paramSeatsLeft as string) || '1', 10),
    price: parseFloat((paramPrice as string) || '0') || 0,
    route: [selectedPickup as string || '', selectedDest as string || ''],
    pickupPoint: (selectedPickup as string) || '',
    origin: pickupLat && pickupLng ? { lat: parseFloat(pickupLat as string), lng: parseFloat(pickupLng as string) } : undefined,
    destination: dropLat && dropLng ? { lat: parseFloat(dropLat as string), lng: parseFloat(dropLng as string) } : undefined,
  } : null);

  if (!ride) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Ride not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Driver Point A (Start) & Point B (End)
  const driverPointA = ride.route[0];
  const driverPointB = ride.route[ride.route.length - 1];

  // Passenger's custom selected Pickup and Drop-off locations
  const initialPickup = typeof selectedPickup === 'string' && selectedPickup.trim() ? selectedPickup : (ride.route[0] || '');
  const initialDropoff = typeof selectedDest === 'string' && selectedDest.trim() ? selectedDest : (ride.route[ride.route.length - 1] || '');

  const [passengerPickup, setPassengerPickup] = useState<string>(initialPickup);
  const [passengerDropoff, setPassengerDropoff] = useState<string>(initialDropoff);

  // Coordinates for Map (landmark lookup removed — use real GPS coords from ride data)
  const startCoord = ride.origin ? { latitude: ride.origin.lat, longitude: ride.origin.lng } : undefined;
  const endCoord = ride.destination ? { latitude: ride.destination.lat, longitude: ride.destination.lng } : undefined;
  const pickupCoord = undefined;
  const dropoffCoord = undefined;

  // Validate passenger journey against driver's published route polyline & sequence
  let validationResult: { isValid: boolean; reason: string } = { isValid: false, reason: '' };
  let calculatedFare = ride.price;

  if (ride.encodedPolyLine && pickupCoord && dropoffCoord) {
    // 1. Live polyline geometrical matching with 1000m threshold
    const polyMatch: RouteMatchResult = matchPassengerToRoute(
      ride.encodedPolyLine,
      pickupCoord,
      dropoffCoord,
      1000
    );

    if (polyMatch.isValid) {
      validationResult = {
        isValid: true,
        reason: `Journey from "${passengerPickup}" to "${passengerDropoff}" is along the driver's polyline route!`,
      };
      // Prorate fare dynamically based on segment distance vs full route distance
      calculatedFare = calculateProratedFare(
        ride.encodedPolyLine,
        pickupCoord,
        dropoffCoord,
        ride.price
      );
    } else {
      validationResult = {
        isValid: false,
        reason: polyMatch.reason || `Drop-off (${passengerDropoff}) must come after pickup (${passengerPickup}) along driver's route direction.`,
      };
    }
  } else {
    // 2. Sequence/landmark index fallback validation
    const fallbackVal = validatePassengerJourney(ride.route, passengerPickup, passengerDropoff);
    validationResult = {
      isValid: fallbackVal.isValid,
      reason: fallbackVal.reason,
    };
    if (fallbackVal.isValid && fallbackVal.pickupIndex !== undefined && fallbackVal.dropoffIndex !== undefined) {
      const totalStops = Math.max(1, ride.route.length - 1);
      const travelledStops = Math.max(1, fallbackVal.dropoffIndex - fallbackVal.pickupIndex);
      calculatedFare = Math.max(30, Math.round((travelledStops / totalStops) * ride.price));
    }
  }

  const handleBooking = async () => {
    const pendingBooking = bookings.find(b => b.status === 'pending' || b.status === 'accepted');
    if (pendingBooking) {
      Alert.alert('Active Booking Exists', 'You already have an active or pending booking. Please manage your active trip first.');
      return;
    }

    // Build pickup/drop coords from navigation params
    const pLat = parseFloat((pickupLat as string) || '0');
    const pLng = parseFloat((pickupLng as string) || '0');
    const dLat = parseFloat((dropLat as string) || '0');
    const dLng = parseFloat((dropLng as string) || '0');

    try {
      await requestBooking(
        ride!.id,
        passengerPickup,
        passengerDropoff,
        pLat && pLng ? { lat: pLat, lng: pLng } : ride?.origin,
        dLat && dLng ? { lat: dLat, lng: dLng } : ride?.destination,
      );
      router.push({
        pathname: '/booking-status',
        params: { rideId: ride!.id }
      });
    } catch (err: any) {
      Alert.alert('Booking Failed', err?.message || 'Could not place booking request.');
    }
  };

  const handleCall = () => {
    makePhoneCall(ride.phone || '+9779841234567');
  };

  const handleChat = () => {
    startRiderChat(ride.id);
    router.push({
      pathname: '/chat-room',
      params: { rideId: ride.id }
    });
  };

  // Driver's location marker
  const driverCurrentLocation = startCoord ? {
    latitude: startCoord.latitude + 0.002,
    longitude: startCoord.longitude + 0.002,
  } : undefined;

  // Waypoints removed (landmark lookup removed)
  const waypoints: { coordinate: { latitude: number; longitude: number }; title: string }[] = [];


  return (
    <View style={styles.rootContainer}>
      {/* Top Navigation Header */}
      <SafeAreaView style={{ backgroundColor: '#FFFFFF' }} edges={['top']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', backgroundColor: '#FFFFFF' }}>
          <TouchableOpacity style={{ padding: 4 }} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: Colors.textPrimary, marginLeft: 12 }}>Ride Offer Details</Text>
        </View>
      </SafeAreaView>

      {/* Overlaying White Bottom Sheet */}
      <View style={styles.bottomSheetCard}>
        {/* Centered Handle Bar */}
        <View style={styles.handleBar} />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          {/* Driver Route Corridor Banner */}
          <View style={styles.corridorBanner}>
            <Ionicons name="git-commit-sharp" size={18} color="#2563EB" />
            <Text style={styles.corridorBannerTitle}>Driver's Published Route Corridor:</Text>
            <Text style={styles.corridorBannerRoute} numberOfLines={1}>
              {ride.route.join(' ➔ ')}
            </Text>
          </View>

          {/* Passenger Selects Custom Pickup & Drop-off Inputs */}
          <View style={styles.passengerSelectBox}>
            <Text style={styles.selectBoxHeading}>Choose Your Pickup & Drop-off Along Route:</Text>
            
            {/* Pickup Row */}
            <View style={styles.inputRow}>
              <Ionicons name="disc-outline" size={18} color="#16A34A" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Pickup location..."
                value={passengerPickup}
                onChangeText={setPassengerPickup}
              />
            </View>

            <View style={styles.inputDivider} />

            {/* Drop-off Row */}
            <View style={styles.inputRow}>
              <Ionicons name="location-sharp" size={18} color="#DC2626" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Drop-off location..."
                value={passengerDropoff}
                onChangeText={setPassengerDropoff}
              />
            </View>

            {/* Suggested Landmark Chips along Driver Route */}
            <Text style={styles.quickSelectSubtext}>Quick select from driver's stops:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
              {ride.route.map((landmark) => (
                <TouchableOpacity
                  key={landmark}
                  style={styles.landmarkChip}
                  onPress={() => {
                    if (!passengerPickup || passengerPickup === landmark) {
                      setPassengerPickup(landmark);
                    } else {
                      setPassengerDropoff(landmark);
                    }
                  }}
                >
                  <Text style={styles.landmarkChipText}>{landmark}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Real-time Validation Result Box */}
          <View
            style={[
              styles.validationCard,
              validationResult.isValid ? styles.validationCardSuccess : styles.validationCardError,
            ]}
          >
            <Ionicons
              name={validationResult.isValid ? 'checkmark-circle' : 'warning'}
              size={22}
              color={validationResult.isValid ? '#16A34A' : '#DC2626'}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.validationTitle,
                  validationResult.isValid ? styles.validationTitleSuccess : styles.validationTitleError,
                ]}
              >
                {validationResult.isValid ? 'Route Compatible ✅' : 'Invalid Journey ❌'}
              </Text>
              <Text
                style={[
                  styles.validationReason,
                  validationResult.isValid ? styles.validationReasonSuccess : styles.validationReasonError,
                ]}
              >
                {validationResult.reason}
              </Text>
            </View>
          </View>

          {/* Driver Profile Row */}
          <View style={styles.driverCardRow}>
            <View style={styles.photoWrapper}>
              <Image source={{ uri: ride.riderPhoto }} style={styles.driverPhoto} />
              <View style={styles.ratingBadgePill}>
                <Ionicons name="star" size={10} color={Colors.warning} />
                <Text style={styles.ratingBadgeText}>{ride.rating}</Text>
              </View>
            </View>

            <View style={styles.driverDetails}>
              <Text style={styles.driverName}>{ride.riderName}</Text>
              <View style={styles.vehicleRow}>
                <Ionicons name={ride.vehicleType === 'bike' ? 'bicycle' : 'speedometer-outline'} size={14} color="#64748B" />
                <Text style={styles.vehicleText} numberOfLines={1}>
                  {ride.vehicleName} • {ride.vehicleNumber}
                </Text>
              </View>
            </View>

            {/* Message & Call Action Buttons */}
            <View style={styles.driverActions}>
              <TouchableOpacity style={styles.chatCircleButton} onPress={handleChat}>
                <Ionicons name="chatbubble-ellipses" size={18} color="#2563EB" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.callCircleButton} onPress={handleCall}>
                <Ionicons name="call" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Fare & Request CTA Bar */}
          <View style={styles.bottomCtaRow}>
            <View>
              <Text style={styles.fareLabel}>Total Fare</Text>
              <Text style={styles.fareValue}>NPR {calculatedFare}</Text>
            </View>
            <TouchableOpacity
              style={[
                styles.requestButton,
                !validationResult.isValid && styles.requestButtonDisabled,
              ]}
              onPress={handleBooking}
              disabled={!validationResult.isValid}
              activeOpacity={validationResult.isValid ? 0.85 : 1}
            >
              <Text style={styles.requestButtonText}>
                {validationResult.isValid ? 'Request to Book' : 'Outside Route'}
              </Text>
              <Ionicons
                name={validationResult.isValid ? 'chevron-forward' : 'lock-closed'}
                size={18}
                color="#FFF"
              />
            </TouchableOpacity>
          </View>

        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  floatingHeaderArea: {
    position: 'absolute',
    top: 10,
    left: 16,
    zIndex: 20,
  },
  floatingBackButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  bottomSheetCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -24,
    paddingTop: 12,
    paddingHorizontal: 16,
    maxHeight: '65%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 10,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 12,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  corridorBanner: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  corridorBannerTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 2,
  },
  corridorBannerRoute: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  passengerSelectBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  selectBoxHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  inputDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 4,
  },
  quickSelectSubtext: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 8,
    marginBottom: 6,
    fontWeight: '600',
  },
  chipsScroll: {
    flexDirection: 'row',
  },
  landmarkChip: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  landmarkChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  validationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    gap: 10,
  },
  validationCardSuccess: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  validationCardError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  validationTitle: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  validationTitleSuccess: {
    color: '#15803D',
  },
  validationTitleError: {
    color: '#B91C1C',
  },
  validationReason: {
    fontSize: 12,
    marginTop: 1,
  },
  validationReasonSuccess: {
    color: '#166534',
  },
  validationReasonError: {
    color: '#991B1B',
  },
  driverCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    marginBottom: 14,
  },
  photoWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  driverPhoto: {
    width: 48,
    height: 48,
    borderRadius: 14,
  },
  ratingBadgePill: {
    position: 'absolute',
    bottom: -4,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 2,
  },
  ratingBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  vehicleText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  driverActions: {
    flexDirection: 'row',
    gap: 8,
  },
  chatCircleButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callCircleButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#C62026',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomCtaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
  },
  fareLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  fareValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.primary,
  },
  requestButton: {
    backgroundColor: '#C62026',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 6,
    shadowColor: '#C62026',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  requestButtonDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
    elevation: 0,
  },
  requestButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
