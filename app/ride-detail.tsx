import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LocationPinPickerMap } from '../components/LocationPinPickerMap';
import { Colors } from '../constants/Colors';
import { useApp } from '../context/AppContext';
import { makePhoneCall } from '../utils/phoneUtils';

export default function RideDetailScreen() {
  const params = useLocalSearchParams();
  const { rides, requestBooking, bookings, startRiderChat, getUserRating } = useApp();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Extract params & match with local ride object
  const rideId = typeof params.id === 'string' ? params.id : '';
  const foundRide = rides.find(r => r.id === rideId);
  const riderId = foundRide?.riderId || (params.riderId as string) || '';

  const driverName = foundRide?.riderName || (params.riderName as string) || 'Driver';
  const driverPhotoUrl = foundRide?.riderPhoto || (params.riderPhoto as string) || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&h=200&q=80';
  const riderRatingObj = getUserRating(riderId);
  const driverRatingText = riderRatingObj.hasRatings ? riderRatingObj.average.toFixed(1) : 'New';
  const driverPhone = foundRide?.phone || (params.phone as string) || '+9779841234567';

  const vehicleModel = foundRide?.vehicleName || (params.vehicleName as string) || 'Vehicle';
  const vehiclePlate = foundRide?.vehicleNumber || (params.vehicleNumber as string) || 'BA 99 PA 1234';

  const riderStartPoint =
    (params.riderOrigin && params.riderOrigin !== 'Origin' && params.riderOrigin !== 'Rider Origin' ? (params.riderOrigin as string) : null) ||
    (foundRide?.pickupPoint && foundRide.pickupPoint !== 'Origin' ? foundRide.pickupPoint : null) ||
    (foundRide?.route?.[0] && foundRide.route[0] !== 'Origin' ? foundRide.route[0] : null) ||
    (params.selectedPickup as string) ||
    'Origin';

  const riderEndPoint =
    (params.riderDest && params.riderDest !== 'Destination' && params.riderDest !== 'Rider Destination' ? (params.riderDest as string) : null) ||
    (foundRide?.route && foundRide.route.length > 0 && foundRide.route[foundRide.route.length - 1] !== 'Destination' ? foundRide.route[foundRide.route.length - 1] : null) ||
    (params.selectedDest as string) ||
    riderStartPoint;

  const originName = (params.selectedPickup as string) || riderStartPoint;
  const destName = (params.selectedDest as string) || riderEndPoint;

  const farePrice = foundRide?.price ?? (params.price ? parseFloat(params.price as string) : 150);
  const seatsLeftCount = foundRide?.seatsLeft ?? (params.seatsLeft ? parseInt(params.seatsLeft as string, 10) : 1);
  const departureTimeText = foundRide?.departureTime || (params.departureTime as string) || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Coordinate objects for small box map
  const originCoords = {
    lat: params.pickupLat ? parseFloat(params.pickupLat as string) : (foundRide?.origin?.lat ?? 27.7172),
    lng: params.pickupLng ? parseFloat(params.pickupLng as string) : (foundRide?.origin?.lng ?? 85.3240),
  };
  const destCoords = {
    lat: params.dropLat ? parseFloat(params.dropLat as string) : (foundRide?.destination?.lat ?? 27.7006),
    lng: params.dropLng ? parseFloat(params.dropLng as string) : (foundRide?.destination?.lng ?? 83.4484),
  };

  // Handlers
  const handleBooking = async () => {
    const existingActiveBooking = bookings.find(b => b.status === 'pending' || b.status === 'accepted' || b.status === 'ongoing');
    if (existingActiveBooking) {
      Alert.alert(
        'Active Trip Exists',
        'You already have an active ride request or ongoing trip. Please complete or cancel your current ride before booking a new one.',
        [
          {
            text: 'View Active Trip',
            onPress: () => router.push({ pathname: '/active-trip', params: { rideId: existingActiveBooking.rideId } }),
          },
          { text: 'OK', style: 'cancel' }
        ]
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await requestBooking(
        rideId || `ride-${Date.now()}`,
        originName,
        destName,
        originCoords,
        destCoords,
        riderStartPoint,
        riderEndPoint,
        riderId
      );
      Alert.alert(
        'Request Sent! 🎉',
        'Your ride request has been sent to the driver. You will be notified once accepted.',
        [
          {
            text: 'View Booking Status',
            onPress: () => router.push({ pathname: '/booking-status', params: { rideId: rideId || '1' } }),
          },
        ]
      );
    } catch (err: any) {
      Alert.alert('Booking Request Failed', err?.message || 'Unable to place ride request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCall = () => {
    if (typeof makePhoneCall === 'function') {
      makePhoneCall(driverPhone);
    } else {
      Linking.openURL(`tel:${driverPhone}`);
    }
  };

  const handleMessage = () => {
    startRiderChat(rideId || '1');
    router.push({
      pathname: '/chat-room',
      params: { rideId: rideId || '1' },
    });
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={22} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ride Offer Details</Text>
        <TouchableOpacity style={styles.minimizeHeaderBtn} onPress={() => router.replace('/(tabs)')} activeOpacity={0.8}>
          <Ionicons name="chevron-down-circle-outline" size={18} color={Colors.primary} />
          <Text style={styles.minimizeHeaderText}>Minimize</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. SMALL BOX MAP CARD ── */}
        <View style={styles.mapBoxCard}>
          <LocationPinPickerMap
            originCoords={originCoords}
            destCoords={destCoords}
            originName={originName}
            destName={destName}
            showControls={false}
            showBadge={false}
            interactive={false}
          />
          <View style={styles.mapRouteOverlayBadge}>
            <Ionicons name="navigate" size={14} color={Colors.primary} />
            <Text style={styles.mapRouteOverlayText} numberOfLines={1}>
              {originName} ➔ {destName}
            </Text>
          </View>
        </View>

        {/* ── 2. ROUTE & DEPARTURE DETAILS CARD ── */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>Route Details</Text>

          {/* Rider's Full Travel Corridor */}
          <View style={styles.riderFullRouteBox}>
            <Ionicons name="navigate-circle" size={20} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.riderFullRouteLabel}>Rider's Full Route</Text>
              <Text style={styles.riderFullRouteText}>{riderStartPoint} ➔ {riderEndPoint}</Text>
            </View>
          </View>

          {/* Passenger's Segment Timeline */}
          <Text style={styles.passengerSegmentHeader}>Your Requested Trip Segment</Text>
          <View style={styles.timelineContainer}>
            {/* Pickup */}
            <View style={styles.timelineRow}>
              <View style={styles.greenDotOutline}>
                <View style={styles.greenDotInner} />
              </View>
              <View style={styles.stopTextContainer}>
                <Text style={styles.stopLabelText}>Your Pickup Point</Text>
                <Text style={styles.stopNameText}>{originName}</Text>
              </View>
            </View>

            <View style={styles.timelineLine} />

            {/* Destination */}
            <View style={styles.timelineRow}>
              <View style={styles.redDotOutline}>
                <View style={styles.redDotInner} />
              </View>
              <View style={styles.stopTextContainer}>
                <Text style={styles.stopLabelText}>Your Drop-off Point</Text>
                <Text style={styles.stopNameText}>{destName}</Text>
              </View>
            </View>
          </View>

          {/* Departure & Available Seats Info Pills */}
          <View style={styles.metaRow}>
            <View style={styles.metaBadge}>
              <Ionicons name="time-outline" size={16} color={Colors.primary} />
              <Text style={styles.metaBadgeText}>{departureTimeText}</Text>
            </View>
            <View style={styles.metaBadge}>
              <Ionicons name="people-outline" size={16} color="#16A34A" />
              <Text style={styles.metaBadgeText}>{seatsLeftCount} seat{seatsLeftCount > 1 ? 's' : ''} left</Text>
            </View>
          </View>
        </View>

        {/* ── 3. RIDER & VEHICLE INFO CARD ── */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>Rider & Vehicle</Text>

          <View style={styles.driverProfileRow}>
            <View style={styles.avatarWrapper}>
              <Image source={{ uri: driverPhotoUrl }} style={styles.driverAvatar} />
              <View style={styles.starRatingBadge}>
                <Ionicons name="star" size={10} color="#F59E0B" />
                <Text style={styles.starRatingText}>{driverRatingText}</Text>
              </View>
            </View>

            <View style={styles.driverMetaInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.driverNameText}>{driverName}</Text>
                <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
              </View>
              <Text style={styles.kycVerifiedSub}>Verified Sarathi Rider</Text>

              <View style={styles.vehicleBadgeRow}>
                <Ionicons name="speedometer-outline" size={14} color={Colors.textMuted} />
                <Text style={styles.vehicleText}>{vehicleModel} • {vehiclePlate}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── 4. ACTION BUTTONS: MESSAGE & CALL ── */}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity style={styles.messageActionBtn} onPress={handleMessage} activeOpacity={0.85}>
            <Ionicons name="chatbubble-ellipses" size={20} color={Colors.primary} />
            <Text style={styles.messageActionText}>Message Rider</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.callActionBtn} onPress={handleCall} activeOpacity={0.85}>
            <Ionicons name="call" size={20} color="#16A34A" />
            <Text style={styles.callActionText}>Call Rider</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── 5. STICKY FOOTER CTA: PRICE & REQUEST RIDE ── */}
      <SafeAreaView style={styles.stickyFooterArea} edges={['bottom']}>
        <View style={styles.stickyFooterBar}>
          <View>
            <Text style={styles.fareLabel}>Total Fare</Text>
            <Text style={styles.farePriceText}>NPR {farePrice}</Text>
          </View>

          <TouchableOpacity
            style={[styles.requestRideBtn, isSubmitting && { opacity: 0.7 }]}
            onPress={handleBooking}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.requestRideBtnText}>Request Ride</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  minimizeHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  minimizeHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
    gap: 16,
  },
  // 1. Map Box Card
  mapBoxCard: {
    height: 200,
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    position: 'relative',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  mapRouteOverlayBadge: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    maxWidth: '90%',
  },
  mapRouteOverlayText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  // Cards General
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  cardSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  riderFullRouteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F0F9FF',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    marginBottom: 14,
  },
  riderFullRouteLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369A1',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  riderFullRouteText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.primary,
    marginTop: 1,
  },
  passengerSegmentHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  // Timeline
  timelineContainer: {
    paddingLeft: 4,
    marginBottom: 14,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  greenDotOutline: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  greenDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#16A34A',
  },
  redDotOutline: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  redDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#DC2626',
  },
  timelineLine: {
    width: 2,
    height: 24,
    backgroundColor: '#CBD5E1',
    marginLeft: 9,
    marginVertical: 2,
  },
  stopTextContainer: {
    flex: 1,
  },
  stopLabelText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  stopNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metaBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  // Rider & Vehicle Profile Row
  driverProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarWrapper: {
    position: 'relative',
  },
  driverAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  starRatingBadge: {
    position: 'absolute',
    bottom: -4,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
  },
  starRatingText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  driverMetaInfo: {
    flex: 1,
  },
  driverNameText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  kycVerifiedSub: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
    marginTop: 1,
  },
  vehicleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  vehicleText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  // Action Buttons Row (Message & Call)
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  messageActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.accent + '35',
    borderRadius: 14,
    paddingVertical: 12,
  },
  messageActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  callActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 14,
    paddingVertical: 12,
  },
  callActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#15803D',
  },
  // Sticky Footer CTA Bar
  stickyFooterArea: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  stickyFooterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  fareLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  farePriceText: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.primary,
  },
  requestRideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    elevation: 4,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  requestRideBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
