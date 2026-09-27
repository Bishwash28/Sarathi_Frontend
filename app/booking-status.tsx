import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { useApp } from '../context/AppContext';

export default function BookingStatusScreen() {
  const { rideId } = useLocalSearchParams();
  const { bookings, rides, cancelBooking, getUserRating } = useApp();

  const ride = rides.find(r => r.id === rideId);
  const currentBooking = bookings.find(b => (b.rideId === rideId || b.id === rideId));

  const driverName = ride?.riderName || currentBooking?.driverName || 'Hello';
  const driverPhoto = ride?.riderPhoto || currentBooking?.driverPhoto;
  const vehicleName = ride?.vehicleName || currentBooking?.vehicleName || 'Dio 125';
  const vehicleType = ride?.vehicleType || 'scooter';
  const vehiclePlate = ride?.vehicleNumber || currentBooking?.vehicleNumber || 'LU 75 PA 2942';
  const driverRatingObj = getUserRating(ride?.riderId || currentBooking?.driverId);
  const ratingDisplayStr = driverRatingObj.hasRatings ? driverRatingObj.average.toFixed(1) : '4.0';

  const driverRouteCorridor = (ride?.route && ride.route.length > 0)
    ? ride.route.join(' → ')
    : (currentBooking?.riderOriginName && currentBooking?.riderDestName && currentBooking.riderOriginName !== 'Rider Origin'
        ? `${currentBooking.riderOriginName} → ${currentBooking.riderDestName}`
        : (currentBooking?.passengerPickup && currentBooking?.passengerDropoff
            ? `${currentBooking.passengerPickup} → ${currentBooking.passengerDropoff}`
            : 'Bardaghat → Sunwal'));

  const passengerPickup = currentBooking?.passengerPickup || 'Bardaghat';
  const passengerDropoff = currentBooking?.passengerDropoff || 'Sunwal';
  const farePriceDisplay = currentBooking?.farePrice ?? ride?.price ?? 200;

  // Continuous spinning loading circle animation
  const spinVal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinVal, {
        toValue: 1,
        duration: 2400,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [spinVal]);

  const spinRotation = spinVal.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  useEffect(() => {
    if (currentBooking && (currentBooking.status === 'accepted' || currentBooking.status === 'ongoing')) {
      const timer = setTimeout(() => {
        router.replace({
          pathname: '/active-trip',
          params: { rideId: currentBooking.rideId || rideId, bookingId: currentBooking.id }
        });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [currentBooking, rideId]);

  if (!currentBooking) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={60} color={Colors.error} />
        <Text style={styles.errorText}>No active booking found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.backButtonText}>Go Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleCancel = () => {
    cancelBooking(currentBooking.id);
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      {/* Top Header Bar */}
      <View style={styles.topHeader}>
        <TouchableOpacity style={styles.backHeaderBtn} onPress={() => router.replace('/(tabs)')} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.topHeaderTitle}>Booking Status</Text>
        <TouchableOpacity style={styles.minimizeBtn} onPress={() => router.replace('/(tabs)')} activeOpacity={0.8}>
          <Ionicons name="chevron-down" size={16} color="#E11D48" />
          <Text style={styles.minimizeText}>Minimize</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Top Loading Animation & Status Section */}
        <View style={styles.spinnerHeroCard}>
          <View style={styles.spinnerOuterContainer}>
            {/* Spinning Dashed Circular Ring */}
            <Animated.View style={[styles.dashedSpinRing, { transform: [{ rotate: spinRotation }] }]} />

            {/* Inner Red Icon Circle */}
            <View style={styles.centerIconCircle}>
              <Ionicons name="bicycle" size={32} color="#FFFFFF" />
            </View>
          </View>

          <Text style={styles.statusTitleText}>
            {currentBooking.status === 'cancelled'
              ? 'Ride Request Cancelled'
              : currentBooking.status === 'accepted'
              ? 'Ride Request Accepted!'
              : 'Waiting for Driver...'}
          </Text>
          <Text style={styles.statusSubtitleText}>
            {currentBooking.status === 'cancelled'
              ? `${driverName} has cancelled this ride request.`
              : currentBooking.status === 'accepted'
              ? `${driverName} accepted your request! Redirecting...`
              : `Sending request to ${driverName}. We'll notify you as soon as they accept.`}
          </Text>
        </View>

        {/* Driver & Vehicle Info Card */}
        <View style={styles.cardContainer}>
          <View style={styles.driverInfoRow}>
            <View style={styles.avatarWrapper}>
              <Image
                source={{
                  uri: driverPhoto || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&h=200&q=80'
                }}
                style={styles.driverAvatarImg}
              />
              <View style={styles.verifiedCheckBadge}>
                <Ionicons name="checkmark" size={10} color="#FFFFFF" />
              </View>
            </View>

            <View style={styles.driverDetailsCol}>
              <View style={styles.nameBadgeRow}>
                <Text style={styles.driverNameText}>{driverName}</Text>
                <View style={styles.verifiedTag}>
                  <Text style={styles.verifiedTagText}>Verified</Text>
                </View>
              </View>
              <View style={styles.ratingVehicleRow}>
                <Ionicons name="star" size={13} color="#F59E0B" />
                <Text style={styles.ratingVehicleText}>
                  {ratingDisplayStr} • {vehicleName} ({vehicleType})
                </Text>
              </View>
            </View>

            {vehiclePlate ? (
              <View style={styles.plateNumberBox}>
                <Text style={styles.plateNumberText}>{vehiclePlate}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Route Corridor & Requested Stops Card */}
        <View style={styles.cardContainer}>
          {/* Driver Route Corridor Header */}
          <View style={styles.cardHeaderRow}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.pinkMapIconBox}>
                <Ionicons name="map-outline" size={14} color="#E11D48" />
              </View>
              <Text style={styles.sectionTitleText}>DRIVER ROUTE CORRIDOR</Text>
            </View>
            <View style={styles.activePathBadge}>
              <Text style={styles.activePathText}>Active Path</Text>
            </View>
          </View>

          <Text style={styles.corridorRouteText}>{driverRouteCorridor}</Text>

          <View style={styles.dividerLine} />

          {/* Passenger Requested Stops */}
          <Text style={styles.stopsSectionHeader}>PASSENGER REQUESTED STOPS</Text>

          <View style={styles.timelineStopsContainer}>
            {/* Pickup */}
            <View style={styles.timelineRow}>
              <View style={styles.greenRingOutline}>
                <View style={styles.greenRingInner} />
              </View>
              <View style={styles.stopDetailCol}>
                <Text style={styles.stopTypeLabel}>PICKUP LOCATION</Text>
                <Text style={styles.stopNameText}>{passengerPickup}</Text>
              </View>
            </View>

            <View style={styles.verticalLineLink} />

            {/* Destination */}
            <View style={styles.timelineRow}>
              <View style={styles.redRingOutline}>
                <View style={styles.redRingInner} />
              </View>
              <View style={styles.stopDetailCol}>
                <Text style={styles.stopTypeLabel}>DESTINATION</Text>
                <Text style={styles.stopNameText}>{passengerDropoff}</Text>
              </View>
            </View>
          </View>

          <View style={styles.dividerLine} />

          {/* Fare Summary */}
          <View style={styles.fareSummaryRow}>
            <View>
              <Text style={styles.fareLabelText}>Estimated Fare</Text>
              <Text style={styles.fareSubLabelText}>Fixed rate via standard corridor</Text>
            </View>
            <Text style={styles.farePriceText}>NPR {farePriceDisplay}</Text>
          </View>
        </View>

        {/* Bottom Actions */}
        {currentBooking.status === 'pending' ? (
          <View style={styles.bottomActionsContainer}>
            <TouchableOpacity style={styles.cancelRequestBtn} onPress={handleCancel} activeOpacity={0.85}>
              <Ionicons name="close-circle-outline" size={18} color="#DC2626" />
              <Text style={styles.cancelRequestBtnText}>Cancel Booking Request</Text>
            </TouchableOpacity>
            <Text style={styles.disclaimerText}>No cancellation fee applies while finding driver.</Text>
          </View>
        ) : currentBooking.status === 'cancelled' ? (
          <View style={styles.bottomActionsContainer}>
            <TouchableOpacity
              style={styles.findAnotherBtn}
              onPress={() => router.replace('/search-ride')}
              activeOpacity={0.85}
            >
              <Ionicons name="search-outline" size={18} color="#FFFFFF" />
              <Text style={styles.findAnotherBtnText}>Find Another Ride</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topHeaderTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  minimizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF1F2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  minimizeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E11D48',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F8FAFC',
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },

  // Spinner Hero Section
  spinnerHeroCard: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  spinnerOuterContainer: {
    width: 130,
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 18,
  },
  dashedSpinRing: {
    position: 'absolute',
    width: 124,
    height: 124,
    borderRadius: 62,
    borderWidth: 2,
    borderColor: '#F43F5E',
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  centerIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#E11D48',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#E11D48',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  statusTitleText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  statusSubtitleText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 24,
  },

  // Shared Cards
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },

  // Driver Card Row
  driverInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  driverAvatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  verifiedCheckBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  driverDetailsCol: {
    flex: 1,
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  driverNameText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  verifiedTag: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  verifiedTagText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#16A34A',
  },
  ratingVehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  ratingVehicleText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  plateNumberBox: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  plateNumberText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
    letterSpacing: 0.5,
  },

  // Route & Stops Card
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pinkMapIconBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#FFF1F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitleText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.4,
  },
  activePathBadge: {
    backgroundColor: '#FFF1F2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  activePathText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#E11D48',
  },
  corridorRouteText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginLeft: 30,
    marginBottom: 12,
  },
  dividerLine: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  stopsSectionHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  timelineStopsContainer: {
    paddingLeft: 4,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  greenRingOutline: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  greenRingInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  redRingOutline: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  redRingInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  verticalLineLink: {
    width: 2,
    height: 22,
    backgroundColor: '#CBD5E1',
    marginLeft: 8,
    marginVertical: 2,
  },
  stopDetailCol: {
    flex: 1,
  },
  stopTypeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.3,
  },
  stopNameText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 1,
  },
  fareSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fareLabelText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  fareSubLabelText: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 1,
  },
  farePriceText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#E11D48',
  },

  // Bottom Actions
  bottomActionsContainer: {
    gap: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  cancelRequestBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    paddingVertical: 13,
    borderRadius: 14,
  },
  cancelRequestBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#DC2626',
  },
  disclaimerText: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
  },
  findAnotherBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
  },
  findAnotherBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
