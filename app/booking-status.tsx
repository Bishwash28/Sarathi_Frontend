import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, TouchableOpacity, Image } from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { useApp } from '../context/AppContext';

export default function BookingStatusScreen() {
  const { rideId } = useLocalSearchParams();
  const { bookings, rides, cancelBooking, acceptBooking } = useApp();

  const ride = rides.find(r => r.id === rideId);
  const currentBooking = bookings.find(b => b.rideId === rideId && (b.status === 'pending' || b.status === 'accepted'));

  useEffect(() => {
    // If the booking gets accepted, automatically redirect to active trip
    if (currentBooking && (currentBooking.status === 'accepted' || currentBooking.status === 'ongoing')) {
      const timer = setTimeout(() => {
        router.replace({
          pathname: '/active-trip',
          params: { rideId, bookingId: currentBooking.id }
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

  const handleAcceptDemo = () => {
    acceptBooking(currentBooking.id);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.topHeader}>
        <TouchableOpacity style={styles.backHeaderBtn} onPress={() => router.replace('/(tabs)')} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={22} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.topHeaderTitle}>Booking Status</Text>
        <TouchableOpacity style={styles.minimizeBtn} onPress={() => router.replace('/(tabs)')} activeOpacity={0.8}>
          <Ionicons name="chevron-down-circle-outline" size={18} color={Colors.primary} />
          <Text style={styles.minimizeText}>Minimize</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.container}>
        {/* Status Indicator */}
        <View style={styles.statusBox}>
          {currentBooking.status === 'pending' ? (
            <>
              <ActivityIndicator size="large" color={Colors.accent} style={styles.spinner} />
              <Text style={styles.statusTitle}>Waiting for Driver</Text>
              <Text style={styles.statusSubtitle}>
                Sending request to {ride?.riderName || 'your driver'}. We will notify you when they respond.
              </Text>
            </>
          ) : (
            <>
              <View style={styles.acceptedIconContainer}>
                <Ionicons name="checkmark-circle" size={80} color={Colors.success} />
              </View>
              <Text style={[styles.statusTitle, { color: Colors.success }]}>Ride Accepted!</Text>
              <Text style={styles.statusSubtitle}>
                {ride?.riderName || 'Your driver'} has confirmed your ride request! Redirecting to live tracking...
              </Text>
            </>
          )}
        </View>

        {/* Card for Rider Info */}
        <View style={styles.driverCard}>
          {ride?.riderPhoto ? (
            <Image source={{ uri: ride.riderPhoto }} style={styles.driverPhoto} />
          ) : (
            <View style={[styles.driverPhoto, { backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="person-circle" size={40} color={Colors.textMuted} />
            </View>
          )}
          <View style={styles.driverInfo}>
            <Text style={styles.driverName}>{ride?.riderName || 'Driver'}</Text>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={14} color="#F59E0B" />
              <Text style={styles.ratingText}>{ride?.rating ?? 5} • {ride?.vehicleName || 'Vehicle'}</Text>
            </View>
          </View>
        </View>

        {/* Journey Details */}
        <View style={styles.detailsBox}>
          <View style={styles.routeRow}>
            <Ionicons name="git-commit-outline" size={18} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: Colors.textMuted, fontWeight: '700' }}>DRIVER ROUTE CORRIDOR</Text>
              <Text style={styles.routeText}>{ride?.route?.join(' → ') || (currentBooking.passengerPickup && currentBooking.passengerDropoff ? `${currentBooking.passengerPickup} → ${currentBooking.passengerDropoff}` : 'En route...')}</Text>
            </View>
          </View>
          
          {(currentBooking.passengerPickup || currentBooking.passengerDropoff) && (
            <>
              <View style={styles.divider} />
              <View style={styles.routeRow}>
                <Ionicons name="navigate-circle-outline" size={20} color="#16A34A" />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, color: Colors.textMuted, fontWeight: '700' }}>PASSENGER REQUESTED STOPS</Text>
                  <Text style={[styles.routeText, { color: Colors.primary }]}>
                    Pickup: {currentBooking.passengerPickup || ride?.route?.[0] || ''} → Dropoff: {currentBooking.passengerDropoff || ride?.route?.[ride.route.length - 1] || ''}
                  </Text>
                </View>
              </View>
            </>
          )}

          <View style={styles.divider} />
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Estimated Price</Text>
            <Text style={styles.priceValue}>NPR {ride?.price ?? 'N/A'}</Text>
          </View>
        </View>

        {/* Action Buttons */}
        {currentBooking.status === 'pending' && (
          <View style={{ width: '100%', gap: 10 }}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <Ionicons name="close-circle-outline" size={20} color={Colors.error} />
              <Text style={styles.cancelButtonText}>Cancel Booking Request</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backHeaderBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topHeaderTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  minimizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  minimizeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
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
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  statusBox: {
    alignItems: 'center',
    marginBottom: 40,
  },
  spinner: {
    marginBottom: 20,
    transform: [{ scale: 1.2 }],
  },
  acceptedIconContainer: {
    marginBottom: 20,
  },
  statusTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  statusSubtitle: {
    fontSize: 15,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    marginBottom: 20,
  },
  driverPhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 14,
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  ratingText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  detailsBox: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    marginBottom: 40,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeText: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '600',
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 12,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  priceValue: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.accent,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.error,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 6,
  },
  cancelButtonText: {
    color: Colors.error,
    fontSize: 15,
    fontWeight: 'bold',
  },
});
