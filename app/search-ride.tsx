import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { useApp } from '../context/AppContext';
import { validatePassengerJourney } from '../utils/routeValidation';

export default function SearchRideScreen() {
  const { rides, deviceLocation, addRecentSearch, savedPlaces } = useApp();
  const params = useLocalSearchParams();

  // Route States
  const [pickup, setPickup] = useState((params.prefillFrom as string) || deviceLocation || 'Butwal');
  const [destination, setDestination] = useState((params.prefillTo as string) || '');
  const [activeTab, setActiveTab] = useState<'recent' | 'saved'>('recent');

  const handleBack = () => {
    router.back();
  };

  const handleSelectRecent = (placeName: string) => {
    setDestination(placeName);
  };

  // Click on a saved location to fill the inputs
  const handleSelectSaved = (name: string) => {
    if (!pickup || pickup === deviceLocation) {
      setPickup(name);
    } else {
      setDestination(name);
    }
  };

  // Filter rides based on sequence-based route overlap
  const filteredRides = destination
    ? rides.filter(ride => {
        const startPoint = pickup && pickup.trim() ? pickup : ride.route[0];
        const validation = validatePassengerJourney(ride.route, startPoint, destination);
        return validation.isValid;
      })
    : [];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Find a Ride</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ── Input Fields Card ── */}
        <View style={styles.inputCard}>
          {/* Pickup Row */}
          <View style={styles.inputRow}>
            <Ionicons name="disc-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Start location..."
              placeholderTextColor={Colors.textMuted}
              value={pickup}
              onChangeText={setPickup}
            />
            {pickup ? (
              <TouchableOpacity onPress={() => setPickup('')} style={styles.clearBtn}>
                <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.inputDivider} />

          {/* Destination Row */}
          <View style={styles.inputRow}>
            <Ionicons name="location-sharp" size={20} color={Colors.accent} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Where to? (e.g. Koteshwor, Balkhu)"
              placeholderTextColor={Colors.textMuted}
              value={destination}
              onChangeText={setDestination}
            />
            {destination ? (
              <TouchableOpacity onPress={() => setDestination('')} style={styles.clearBtn}>
                <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {destination ? (
            <View style={styles.resultsContainer}>
              <Text style={styles.resultsHeading}>Matched Rides going to "{destination}"</Text>
              {filteredRides.length === 0 ? (
                <View style={styles.noResultsCard}>
                  <Ionicons name="search-outline" size={48} color={Colors.textMuted} />
                  <Text style={styles.noResultsText}>No matched rides found on this route.</Text>
                  <Text style={styles.noResultsSubtext}>Try searching landmarks like 'Koteshwor', 'Balkhu', or 'Chabahil'.</Text>
                </View>
              ) : (
                filteredRides.map(ride => (
                  <TouchableOpacity
                    key={ride.id}
                    style={styles.rideCard}
                    onPress={() => router.push({ 
                      pathname: '/ride-detail', 
                      params: { 
                        id: ride.id,
                        selectedPickup: pickup,
                        selectedDest: destination
                      } 
                    })}
                    activeOpacity={0.9}
                  >
                    <View style={styles.rideCardHeader}>
                      <View style={styles.driverMeta}>
                        <Text style={styles.driverNameText}>{ride.riderName}</Text>
                        <View style={styles.ratingBadge}>
                          <Ionicons name="star" size={12} color="#F59E0B" />
                          <Text style={styles.ratingText}>{ride.rating}</Text>
                        </View>
                      </View>
                      <Text style={styles.priceText}>NPR {ride.price}</Text>
                    </View>

                    <View style={styles.vehicleInfoRow}>
                      <Ionicons name={ride.vehicleType === 'bike' ? 'bicycle' : 'speedometer-outline'} size={14} color={Colors.textMuted} />
                      <Text style={styles.vehicleNameText}>{ride.vehicleName} • {ride.vehicleNumber}</Text>
                    </View>

                    <View style={styles.routeTrace}>
                      <Ionicons name="arrow-forward-circle" size={16} color={Colors.accent} />
                      <Text style={styles.routeTraceText} numberOfLines={1}>
                        {ride.route.join(' → ')}
                      </Text>
                    </View>

                    <View style={styles.cardFooter}>
                      <Text style={styles.departureText}>{ride.departureTime}</Text>
                      <View style={styles.seatsBadge}>
                        <Text style={styles.seatsText}>{ride.seatsLeft} seat{ride.seatsLeft > 1 ? 's' : ''} left</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          ) : (
            <>
              {/* ── Tabs Toggle ── */}
              <View style={styles.tabsContainer}>
                <TouchableOpacity
                  style={[styles.tabButton, activeTab === 'recent' && styles.activeTabButton]}
                  onPress={() => setActiveTab('recent')}
                >
                  <Text style={[styles.tabButtonText, activeTab === 'recent' && styles.activeTabButtonText]}>
                    Recent
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tabButton, activeTab === 'saved' && styles.activeTabButton]}
                  onPress={() => setActiveTab('saved')}
                >
                  <Text style={[styles.tabButtonText, activeTab === 'saved' && styles.activeTabButtonText]}>
                    Saved
                  </Text>
                </TouchableOpacity>
              </View>

              {/* ── Conditional Tab Content ── */}
              {activeTab === 'recent' ? (
                <View style={styles.listSection}>
                  <TouchableOpacity 
                    style={styles.listItemRow} 
                    onPress={() => handleSelectRecent('Koteshwor')}
                  >
                    <View style={styles.listIconCircle}>
                      <Ionicons name="time-outline" size={20} color={Colors.textMuted} />
                    </View>
                    <View style={styles.listItemTextContainer}>
                      <Text style={styles.listItemTitle} numberOfLines={1}>
                        Koteshwor (Recent search)
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.moreButton}>
                      <Ionicons name="ellipsis-vertical" size={20} color={Colors.textMuted} />
                    </TouchableOpacity>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.listItemRow} 
                    onPress={() => handleSelectRecent('Balkhu')}
                  >
                    <View style={styles.listIconCircle}>
                      <Ionicons name="time-outline" size={20} color={Colors.textMuted} />
                    </View>
                    <View style={styles.listItemTextContainer}>
                      <Text style={styles.listItemTitle} numberOfLines={1}>
                        Balkhu (Recent search)
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.moreButton}>
                      <Ionicons name="ellipsis-vertical" size={20} color={Colors.textMuted} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.listSection}>
                  {savedPlaces.map((place) => (
                    <TouchableOpacity 
                      key={place.id} 
                      style={styles.listItemRow}
                      onPress={() => handleSelectSaved(place.landmark)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.listIconCircle, styles.savedIconBackground]}>
                        <Ionicons name="location" size={18} color={Colors.primary} />
                      </View>
                      <View style={styles.listItemTextContainer}>
                        <Text style={styles.savedItemText}>{place.name}</Text>
                        <Text style={{ fontSize: 11, color: Colors.textMuted }}>{place.landmark}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  keyboardView: {
    flex: 1,
  },
  inputCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    height: 44,
  },
  inputDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 8,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  clearBtn: {
    padding: 4,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 12,
  },
  tabButton: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  activeTabButton: {
    backgroundColor: Colors.surface,
    borderColor: Colors.accent + '25',
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  activeTabButtonText: {
    color: Colors.primary,
  },
  listSection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  listIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  savedIconBackground: {
    backgroundColor: Colors.surface,
  },
  savedItemText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  listItemTextContainer: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  moreButton: {
    padding: 6,
  },
  resultsContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  resultsHeading: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  noResultsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noResultsText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginTop: 12,
    textAlign: 'center',
  },
  noResultsSubtext: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
  rideCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  rideCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  driverMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  driverNameText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    gap: 2,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  priceText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primary,
  },
  vehicleInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  vehicleNameText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  routeTrace: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 8,
    borderRadius: 8,
    gap: 6,
    marginBottom: 12,
  },
  routeTraceText: {
    fontSize: 12,
    color: Colors.textPrimary,
    fontWeight: '600',
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  departureText: {
    fontSize: 12,
    color: Colors.success,
    fontWeight: '700',
  },
  seatsBadge: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  seatsText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
});

