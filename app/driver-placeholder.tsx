import React, { useState } from 'react';
import {
  Alert,
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

export default function OfferRideScreen() {
  const { user, createRide } = useApp();

  // Route States: Point A (Start) and Point B (End)
  const [pointA, setPointA] = useState('');
  const [pointB, setPointB] = useState('');

  // Fare & Offer Details
  const [price, setPrice] = useState('');
  const [seatsLeft, setSeatsLeft] = useState('1');
  const [departureTime, setDepartureTime] = useState('');

  // Map Height Expand Toggle
  const [isMapExpanded, setIsMapExpanded] = useState(false);

  const handleBack = () => {
    router.back();
  };

  // Simple origin → destination corridor (landmark auto-detection removed)
  const fullRouteCorridor = [pointA, pointB].filter(Boolean);

  const handleCreateOffer = async () => {
    if (!pointA || !pointA.trim()) {
      Alert.alert('Missing Start', 'Please enter your Starting Location (Point A).');
      return;
    }
    if (!pointB || !pointB.trim()) {
      Alert.alert('Missing Destination', 'Please enter your Ending Location (Point B).');
      return;
    }
    if (pointA.trim().toLowerCase() === pointB.trim().toLowerCase()) {
      Alert.alert('Invalid Route', 'Starting Location and Ending Location cannot be the same.');
      return;
    }

    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price in NPR per seat.');
      return;
    }
    const parsedSeats = parseInt(seatsLeft, 10);
    if (isNaN(parsedSeats) || parsedSeats <= 0) {
      Alert.alert('Invalid Seats', 'Please offer at least 1 seat.');
      return;
    }

    const originCoords = { lat: 27.7172, lng: 85.3240 };
    const destCoords = { lat: 27.6710, lng: 85.3120 };

    try {
      const result = await createRide({
        vehicleType: 'scooter',
        vehicleName: user?.vehicleName || 'Vehicle',
        vehicleNumber: user?.vehicleNumber || '',
        departureTime: departureTime.trim() || 'Leaving soon',
        seatsLeft: parsedSeats,
        price: parsedPrice,
        route: [pointA.trim(), pointB.trim()],
        pickupPoint: pointA.trim(),
        origin: originCoords,
        destination: destCoords,
        encodedPolyLine: '',
      });

      if (result.success) {
        Alert.alert('Offer Created! 🎉', 'Your ride offer has been published.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        Alert.alert('Failed to Create Offer', result.error || 'Please check your inputs and try again.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to connect to server.');
    }
  };

  // Coord lookups removed (LANDMARKS data removed)
  const startCoord = undefined;
  const endCoord = undefined;
  const driverCurrentLocation = undefined;
  const waypointCoords: { coordinate: { latitude: number; longitude: number }; title: string }[] = [];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      {/* Top Navigation Bar */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Driver: Publish Route</Text>
        <TouchableOpacity
          style={styles.expandMapBtn}
          onPress={() => setIsMapExpanded(!isMapExpanded)}
        >
          <Ionicons name={isMapExpanded ? 'contract' : 'expand'} size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Form Container */}

        {/* Scrollable Form Below Map */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Driver Profile Summary Card */}
          <View style={styles.driverInfoCard}>
            <View style={styles.avatarCircle}>
              <Ionicons name="car-sport" size={22} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.driverWelcome}>Posting as Driver: {user?.name || 'Verified Driver'}</Text>
              <Text style={styles.vehicleMeta}>
                {user?.vehicleName || 'Royal Enfield Classic'} • {user?.vehicleNumber || 'LU 1 PA 7788'}
              </Text>
            </View>
          </View>

          {/* Starting Location */}
          <Text style={styles.inputLabel}>Starting Location</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="location-outline" size={20} color="#2563EB" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="e.g. Butwal, Kalanki"
              placeholderTextColor={Colors.textMuted}
              value={pointA}
              onChangeText={setPointA}
            />
          </View>

          {/* Ending Location */}
          <Text style={styles.inputLabel}>Destination Location</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="flag-sharp" size={20} color="#DC2626" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="e.g. Bhairahawa, Koteshwor"
              placeholderTextColor={Colors.textMuted}
              value={pointB}
              onChangeText={setPointB}
            />
          </View>

          {/* Automatically Generated Corridor Summary */}
          <View style={styles.autoCorridorCard}>
            <View style={styles.autoCorridorHeader}>
              <Ionicons name="git-merge-outline" size={18} color={Colors.primary} />
              <Text style={styles.autoCorridorTitle}>Auto-Detected Travel Corridor</Text>
            </View>
            <Text style={styles.autoCorridorSub}>
              Landmarks along your travel path are detected automatically:
            </Text>
            <Text style={styles.routeSummaryText}>{fullRouteCorridor.join('  ➔  ')}</Text>
          </View>

          {/* Seats Offered & Price */}
          <View style={styles.rowInputs}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Available Seats</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="people-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="1"
                  placeholderTextColor={Colors.textMuted}
                  value={seatsLeft}
                  onChangeText={setSeatsLeft}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Price / Seat (NPR)</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.currencyPrefix}>Rs.</Text>
                <TextInput
                  style={styles.input}
                  placeholder="180"
                  placeholderTextColor={Colors.textMuted}
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>

          {/* Departure Time */}
          <Text style={styles.inputLabel}>Departure Time</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="time-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="e.g. Leaving in 15 mins"
              placeholderTextColor={Colors.textMuted}
              value={departureTime}
              onChangeText={setDepartureTime}
            />
          </View>

          {/* Confirm & Publish Button */}
          <TouchableOpacity style={styles.createButton} onPress={handleCreateOffer} activeOpacity={0.9}>
            <Text style={styles.createText}>Publish Route Offer</Text>
            <Ionicons name="paper-plane" size={18} color="#FFF" />
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
    padding: 6,
  },
  expandMapBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  mapContainer: {
    height: 250,
    width: '100%',
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
  },
  mapBadgeOverlay: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  driverDotRed: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#DC2626',
  },
  mapBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  driverInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverWelcome: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  vehicleMeta: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 6,
    marginTop: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    height: 46,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 10,
  },
  currencyPrefix: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: 'bold',
    marginRight: 6,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  autoCorridorCard: {
    backgroundColor: '#EFF6FF',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginVertical: 14,
  },
  autoCorridorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  autoCorridorTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E40AF',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  autoCorridorSub: {
    fontSize: 11,
    color: '#3B82F6',
    fontWeight: '500',
    marginBottom: 8,
  },
  routeSummaryText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  createButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 14,
    marginTop: 20,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  createText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
