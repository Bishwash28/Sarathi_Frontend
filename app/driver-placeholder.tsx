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

const LANDMARKS = ['Kalanki', 'Balkhu', 'Tripureshwor', 'Putalisadak', 'Chabahil', 'Koteshwor', 'Balkumari', 'Lagankhel'];

export default function OfferRideScreen() {
  const { user, createRide } = useApp();

  // Form States
  const [pickup, setPickup] = useState('Kalanki');
  const [destination, setDestination] = useState('');
  const [route, setRoute] = useState<string[]>(['Kalanki']); // Starting landmark automatically added
  const [price, setPrice] = useState('150');
  const [seatsLeft, setSeatsLeft] = useState('1');
  const [departureTime, setDepartureTime] = useState('Leaving in 10 mins');

  const handleBack = () => {
    router.back();
  };

  const handleToggleLandmark = (landmark: string) => {
    if (route.includes(landmark)) {
      if (landmark === pickup) return; // Keep pickup in route
      setRoute(prev => prev.filter(l => l !== landmark));
    } else {
      setRoute(prev => [...prev, landmark]);
    }
  };

  const handleCreateOffer = () => {
    if (!pickup) {
      Alert.alert('Missing Field', 'Please set a starting pickup location.');
      return;
    }
    if (!destination) {
      Alert.alert('Missing Field', 'Please enter your destination.');
      return;
    }
    if (route.length < 2) {
      Alert.alert('Incomplete Route', 'Please select at least one more landmark for your route.');
      return;
    }
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price in NPR.');
      return;
    }
    const parsedSeats = parseInt(seatsLeft, 10);
    if (isNaN(parsedSeats) || parsedSeats <= 0) {
      Alert.alert('Invalid Seats', 'Please offer at least 1 seat.');
      return;
    }

    // Insert destination as the last item in the route if not already present
    let finalRoute = [...route];
    if (!finalRoute.includes(destination)) {
      finalRoute.push(destination);
    }

    createRide({
      vehicleType: user?.vehicleType || 'bike',
      vehicleName: user?.vehicleName || 'Pulsar 220F',
      vehicleNumber: user?.vehicleNumber || 'BA 95 PA 8821',
      departureTime,
      seatsLeft: parsedSeats,
      price: parsedPrice,
      route: finalRoute,
      pickupPoint: `${pickup} Chowk (near main gate)`,
    });

    Alert.alert(
      'Ride Created',
      `Your ride offer from ${pickup} to ${destination} is now live!`,
      [
        {
          text: 'Go to Dashboard',
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
        <Text style={styles.headerTitle}>Offer a Ride</Text>
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
          {/* Driver Badge */}
          <View style={styles.driverInfoCard}>
            <View style={styles.avatarCircle}>
              <Ionicons name="car-sport" size={24} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.driverWelcome}>Verified Driver: {user?.name}</Text>
              <Text style={styles.vehicleMeta}>
                {user?.vehicleName} ({user?.vehicleType === 'bike' ? 'Bike' : 'Car'}) • {user?.vehicleNumber}
              </Text>
            </View>
          </View>

          {/* Pickup and Destination */}
          <Text style={styles.inputLabel}>Pickup Landmark</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="disc-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="e.g. Kalanki"
              placeholderTextColor={Colors.textMuted}
              value={pickup}
              onChangeText={(text) => {
                setPickup(text);
                // Keep route starting node in sync
                setRoute(prev => [text, ...prev.slice(1)]);
              }}
            />
          </View>

          <Text style={styles.inputLabel}>Destination Landmark</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="location-sharp" size={20} color={Colors.accent} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="e.g. Koteshwor"
              placeholderTextColor={Colors.textMuted}
              value={destination}
              onChangeText={setDestination}
            />
          </View>

          {/* Select Route Landmarks */}
          <Text style={styles.inputLabel}>Select Your Route Landmarks</Text>
          <Text style={styles.sectionSubtitle}>Tap the landmarks that you will pass through:</Text>
          <View style={styles.landmarksGrid}>
            {LANDMARKS.map(landmark => {
              const isActive = route.includes(landmark);
              return (
                <TouchableOpacity
                  key={landmark}
                  style={[styles.landmarkChip, isActive && styles.landmarkChipActive]}
                  onPress={() => handleToggleLandmark(landmark)}
                >
                  <Text style={[styles.landmarkChipText, isActive && styles.landmarkChipTextActive]}>
                    {landmark}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Price & Seats Container */}
          <View style={styles.rowInputs}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Seats Offered</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="people-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
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
              <Text style={styles.inputLabel}>Price per seat (NPR)</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.currencyPrefix}>Rs.</Text>
                <TextInput
                  style={styles.input}
                  placeholder="150"
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

          {/* Create Button */}
          <TouchableOpacity style={styles.createButton} onPress={handleCreateOffer} activeOpacity={0.9}>
            <Text style={styles.createText}>Post Ride Offer</Text>
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
  driverInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 24,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverWelcome: {
    fontSize: 15,
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
    marginBottom: 8,
    marginTop: 16,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 10,
    marginTop: -4,
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
  currencyPrefix: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: 'bold',
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  landmarksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  landmarkChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  landmarkChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  landmarkChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  landmarkChipTextActive: {
    color: '#FFF',
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 16,
  },
  createButton: {
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
  createText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
