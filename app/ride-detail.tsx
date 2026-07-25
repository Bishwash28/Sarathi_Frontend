import React from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity, ScrollView, Alert, Linking } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { useApp, LANDMARKS } from '../context/AppContext';
import { RouteMap } from '../components/RouteMap';

export default function RideDetailScreen() {
  const { id } = useLocalSearchParams();
  const { rides, requestBooking, bookings, startRiderChat } = useApp();

  const ride = rides.find(r => r.id === id);

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

  const handleBooking = () => {
    const pendingBooking = bookings.find(b => b.status === 'pending' || b.status === 'accepted');
    if (pendingBooking) {
      Alert.alert('Active Booking Exists', 'You already have an active or pending booking. Please manage your active trip first.');
      return;
    }

    requestBooking(ride.id);
    router.push({
      pathname: '/booking-status',
      params: { rideId: ride.id }
    });
  };

  const handleCall = () => {
    Alert.alert('Calling Driver', `Dialing ${ride.riderName}...`);
  };

  const handleChat = () => {
    startRiderChat(ride.id);
    router.push({
      pathname: '/chat-room',
      params: { rideId: ride.id }
    });
  };

  const startLandmark = LANDMARKS[ride.route[0]];
  const endLandmark = LANDMARKS[ride.route[ride.route.length - 1]];

  const startCoord = startLandmark
    ? { latitude: startLandmark.latitude, longitude: startLandmark.longitude }
    : { latitude: 27.6937, longitude: 85.2817 };
  const endCoord = endLandmark
    ? { latitude: endLandmark.latitude, longitude: endLandmark.longitude }
    : { latitude: 27.6756, longitude: 85.3461 };

  return (
    <View style={styles.rootContainer}>
      {/* Full-Screen Map Background */}
      <View style={styles.mapContainer}>
        <RouteMap
          startCoord={startCoord}
          endCoord={endCoord}
          vehicleType={ride.vehicleType}
          strokeColor="#C62026"
          lineDashPattern={[6, 4]}
          showControls={true}
        />
        
        {/* Floating Top Back Button */}
        <SafeAreaView style={styles.floatingHeaderArea} edges={['top']}>
          <TouchableOpacity style={styles.floatingBackButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#1E293B" />
          </TouchableOpacity>
        </SafeAreaView>
      </View>

      {/* Overlaying White Bottom Sheet */}
      <View style={styles.bottomSheetCard}>
        {/* Centered Handle Bar */}
        <View style={styles.handleBar} />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          {/* Pickup to Drop Journey Progress Line */}
          <View style={styles.journeySection}>
            <View style={styles.journeyHeader}>
              <View style={styles.pickupLabelGroup}>
                <View style={styles.pickupSquareIcon}>
                  <View style={styles.blueSquare} />
                  <View style={styles.redSquare} />
                </View>
                <Text style={styles.pickupText}>PICKUP</Text>
              </View>

              <View style={styles.dropLabelGroup}>
                <View style={styles.dropSquareIcon}>
                  <View style={styles.greenSquare} />
                  <View style={styles.yellowSquare} />
                </View>
                <Text style={styles.dropText}>DROP</Text>
              </View>
            </View>

            {/* Line with red progress bar */}
            <View style={styles.journeyTrack}>
              <View style={styles.journeyProgressLine} />
            </View>

            <View style={styles.routeLocationsRow}>
              <Text style={styles.landmarkStartText} numberOfLines={1}>{ride.route[0]}</Text>
              <Text style={styles.landmarkEndText} numberOfLines={1}>{ride.route[ride.route.length - 1]}</Text>
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
                <Ionicons name={ride.vehicleType === 'bike' ? 'bicycle' : 'car'} size={14} color="#64748B" />
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

          {/* Pickup Details Row */}
          <View style={styles.pickupInfoCard}>
            <Ionicons name="location-outline" size={18} color={Colors.accent} />
            <View style={styles.pickupTextCol}>
              <Text style={styles.pickupTitle}>Pickup Point</Text>
              <Text style={styles.pickupSubtitle}>{ride.pickupPoint}</Text>
            </View>
          </View>

          {/* Fare & Request CTA Bar */}
          <View style={styles.bottomCtaRow}>
            <View>
              <Text style={styles.fareLabel}>Total Fare</Text>
              <Text style={styles.fareValue}>NPR {ride.price}</Text>
            </View>
            <TouchableOpacity style={styles.requestButton} onPress={handleBooking}>
              <Text style={styles.requestButtonText}>Request to Book</Text>
              <Ionicons name="chevron-forward" size={18} color="#FFF" />
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -28,
    paddingTop: 12,
    paddingHorizontal: 20,
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
    marginBottom: 16,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  journeySection: {
    marginBottom: 20,
  },
  journeyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pickupLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pickupSquareIcon: {
    flexDirection: 'row',
    gap: 2,
  },
  blueSquare: {
    width: 7,
    height: 12,
    backgroundColor: '#2563EB',
    borderRadius: 1,
  },
  redSquare: {
    width: 7,
    height: 12,
    backgroundColor: '#DC2626',
    borderRadius: 1,
  },
  pickupText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: 0.5,
  },
  dropLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dropSquareIcon: {
    flexDirection: 'row',
    gap: 2,
  },
  greenSquare: {
    width: 7,
    height: 12,
    backgroundColor: '#16A34A',
    borderRadius: 1,
  },
  yellowSquare: {
    width: 7,
    height: 12,
    backgroundColor: '#CA8A04',
    borderRadius: 1,
  },
  dropText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  journeyTrack: {
    height: 3,
    backgroundColor: '#F1F5F9',
    borderRadius: 1.5,
    marginVertical: 4,
    position: 'relative',
  },
  journeyProgressLine: {
    width: '45%',
    height: '100%',
    backgroundColor: '#C62026',
    borderRadius: 1.5,
  },
  routeLocationsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  landmarkStartText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  landmarkEndText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  driverCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    marginBottom: 16,
  },
  photoWrapper: {
    position: 'relative',
    marginRight: 14,
  },
  driverPhoto: {
    width: 52,
    height: 52,
    borderRadius: 16,
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
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
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
    gap: 10,
  },
  chatCircleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callCircleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#C62026',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickupInfoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  pickupTextCol: {
    marginLeft: 10,
    flex: 1,
  },
  pickupTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  pickupSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: 2,
  },
  bottomCtaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
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
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 14,
    gap: 6,
    shadowColor: '#C62026',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  requestButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
