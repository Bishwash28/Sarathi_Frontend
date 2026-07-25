import React, { useEffect } from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { useApp, LANDMARKS } from '../context/AppContext';
import { RouteMap } from '../components/RouteMap';

export default function ActiveTripScreen() {
  const { rideId } = useLocalSearchParams();
  const { bookings, rides, activeTripProgress, nudgeDriverLocation } = useApp();

  const ride = rides.find(r => r.id === rideId);
  const currentBooking = bookings.find(b => b.rideId === rideId);

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

  useEffect(() => {
    // If the booking is completed, show a rating/completion dialog
    if (currentBooking?.status === 'completed') {
      Alert.alert(
        'Trip Completed!',
        'You have arrived at your destination landmark. Thank you for riding with Sarathi!',
        [{ text: 'Return to Home', onPress: () => router.replace('/(tabs)') }]
      );
    }
  }, [currentBooking]);

  if (!ride || !currentBooking) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>No active trip found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.backButtonText}>Go Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleSOS = () => {
    Alert.alert(
      'Emergency SOS',
      'Are you sure you want to trigger SOS? This will alert your emergency contacts and local authorities immediately.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Trigger SOS', onPress: () => Alert.alert('SOS Triggered', 'Emergency services and your contact list have been notified.'), style: 'destructive' }
      ]
    );
  };

  const handleChat = () => {
    Alert.alert('Chat Support', `Messaging channel with ${ride.riderName} is open.`);
  };

  const startLandmark = LANDMARKS[ride.route[0]];
  const endLandmark = LANDMARKS[ride.route[ride.route.length - 1]];

  const startCoord = startLandmark
    ? { latitude: startLandmark.latitude, longitude: startLandmark.longitude }
    : { latitude: 27.6937, longitude: 85.2817 };
  const endCoord = endLandmark
    ? { latitude: endLandmark.latitude, longitude: endLandmark.longitude }
    : { latitude: 27.6756, longitude: 85.3461 };

  const liveCoord = (currentBooking.currentLat && currentBooking.currentLng)
    ? { latitude: currentBooking.currentLat, longitude: currentBooking.currentLng }
    : startCoord;

  const eta = Math.max(1, Math.ceil((100 - activeTripProgress) / 10));

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.container}>
        {/* Top Floating Header */}
        <View style={styles.topHeader}>
          <Text style={styles.headerTitle}>Live Tracking</Text>
          <View style={styles.etaContainer}>
            <Text style={styles.etaLabel}>Arriving in</Text>
            <Text style={styles.etaValue}>{activeTripProgress === 100 ? 'Arrived' : `${eta} mins`}</Text>
          </View>
        </View>

        {/* Live Map View */}
        <View style={styles.mapWrapper}>
          <RouteMap
            startCoord={startCoord}
            endCoord={endCoord}
            liveCoord={liveCoord}
            vehicleType={ride.vehicleType}
          />
        </View>

        {/* Bottom Driver & Action Panel */}
        <View style={styles.bottomPanel}>
          <View style={styles.panelHeader}>
            <Image source={{ uri: ride.riderPhoto }} style={styles.driverPhoto} />
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{ride.riderName}</Text>
              <Text style={styles.vehicleInfo}>{ride.vehicleName} • {ride.vehicleNumber}</Text>
            </View>
            <TouchableOpacity style={styles.chatButton} onPress={handleChat}>
              <Ionicons name="chatbubble-ellipses-outline" size={24} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.panelDivider} />

          <View style={styles.tripStatusRow}>
            <View>
              <Text style={styles.statusLabel}>Destination</Text>
              <Text style={styles.statusValue}>{ride.route[ride.route.length - 1]}</Text>
            </View>
            <View style={styles.progressContainer}>
              <Text style={styles.statusLabel}>Trip Progress</Text>
              <Text style={styles.statusValue}>{activeTripProgress}%</Text>
            </View>
          </View>

          {/* Dev Location Nudge Button */}
          <TouchableOpacity 
            style={styles.nudgeButton}
            onPress={() => nudgeDriverLocation(currentBooking.id)}
          >
            <Ionicons name="navigate" size={16} color="#FFF" />
            <Text style={styles.nudgeButtonText}>Dev: Nudge Rider GPS Location</Text>
          </TouchableOpacity>

          {/* Action Row */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.sosButton} onPress={handleSOS}>
              <Ionicons name="alert-circle" size={20} color="#FFF" />
              <Text style={styles.sosButtonText}>SOS EMERGENCY</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.homeButton} 
              onPress={() => router.replace('/(tabs)')}
            >
              <Text style={styles.homeButtonText}>Minimize</Text>
            </TouchableOpacity>
          </View>
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
    marginBottom: 20,
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
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
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
    fontSize: 16,
    fontWeight: '800',
    color: Colors.accent,
  },
  mapWrapper: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
  },
  bottomPanel: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    padding: 16,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverPhoto: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  vehicleInfo: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  chatButton: {
    backgroundColor: Colors.surface,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  panelDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 12,
  },
  tripStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  statusValue: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '700',
    marginTop: 2,
  },
  progressContainer: {
    alignItems: 'flex-end',
  },
  nudgeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F766E',
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 12,
    gap: 6,
  },
  nudgeButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  sosButton: {
    flex: 1.3,
    backgroundColor: Colors.error,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    shadowColor: Colors.error,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  sosButtonText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 13,
  },
  homeButton: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeButtonText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
});
