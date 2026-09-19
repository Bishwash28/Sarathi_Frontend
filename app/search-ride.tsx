import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
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
import { useApp, Ride } from '../context/AppContext';
import { supabase } from '../lib/supabase';

import { useLocationSearch } from '../hooks/useLocationSearch';
import { LocationPinPickerMap } from '../components/LocationPinPickerMap';
import { LocationSearchInput } from '../components/LocationSearchInput';

export default function SearchRideScreen() {
  const { rides, deviceLocation, addRecentSearch, recentSearches, savedPlaces, requestBooking } = useApp();
  const params = useLocalSearchParams();

  // Search state
  const [candidateRides, setCandidateRides] = useState<Ride[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const {
    origin,
    originSuggestions,
    isSearchingOrigin,
    showOriginNotFound,
    isFetchingOriginGPS,
    handleOriginChange,
    selectOriginSuggestion,
    useCurrentLocationForOrigin,
    setOriginDirect,

    destination,
    destSuggestions,
    isSearchingDest,
    showDestNotFound,
    handleDestChange,
    selectDestSuggestion,
    setDestDirect,

    pinPickerModalOpen,
    pinPickerTargetType,
    openPinPicker,
    closePinPicker,
    confirmPinLocation,

    routeInfo,
  } = useLocationSearch();

  const [activeTab, setActiveTab] = useState<'recent' | 'saved'>('recent');

  // Dragged pin coords for modal
  const [draggedPinCoords, setDraggedPinCoords] = useState<{ lat: number; lng: number } | null>(null);

  React.useEffect(() => {
    if (pinPickerModalOpen) {
      if (pinPickerTargetType === 'origin' && origin.coords) {
        setDraggedPinCoords(origin.coords);
      } else if (pinPickerTargetType === 'destination' && destination.coords) {
        setDraggedPinCoords(destination.coords);
      } else {
        setDraggedPinCoords({ lat: 27.7172, lng: 85.3240 });
      }
    }
  }, [pinPickerModalOpen, pinPickerTargetType]);

  // Initialize prefilled locations on mount
  React.useEffect(() => {
    if (params.prefillFrom) {
      handleOriginChange(params.prefillFrom as string);
    } else if (deviceLocation) {
      handleOriginChange(deviceLocation);
    }
    if (params.prefillTo) {
      handleDestChange(params.prefillTo as string);
    }
  }, [params.prefillFrom, params.prefillTo, deviceLocation]);

  const handleBack = () => {
    router.back();
  };

  const handleSelectRecent = (placeName: string) => {
    handleDestChange(placeName);
    addRecentSearch(origin.text || 'Current Location', placeName);
  };

  // Click on a saved location to fill the inputs
  const handleSelectSaved = (name: string) => {
    if (!origin.text) {
      handleOriginChange(name);
    } else {
      handleDestChange(name);
    }
  };

  // candidateRides — populated via backend search below

  const handleSearchRides = async () => {
    if (!origin.text && !destination.text) {
      Alert.alert('Missing Location', 'Please select both origin and destination.');
      return;
    }
    setIsSearching(true);
    setHasSearched(true);
    setSearchError(null);

    try {
      const origLat = origin.coords?.lat || 27.7172;
      const origLng = origin.coords?.lng || 85.3240;
      const destLat = destination.coords?.lat || 27.7006;
      const destLng = destination.coords?.lng || 83.4484;

      const { data, error } = await supabase.rpc('search_matching_rides', {
        p_origin_lat: origLat,
        p_origin_lng: origLng,
        p_dest_lat: destLat,
        p_dest_lng: destLng,
        p_seats_needed: 1,
        p_buffer_meters: 800.0,
      });

      setIsSearching(false);

      if (error) {
        setSearchError(error.message);
        return;
      }

      if (data && data.length > 0) {
        const mappedRides: Ride[] = data.map((item: any) => ({
          id: item.ride_id,
          riderName: item.rider_name || 'Rider',
          riderPhoto: item.rider_photo || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&h=200&q=80',
          rating: 5.0,
          vehicleType: 'scooter',
          vehicleName: item.vehicle_name || 'Vehicle',
          vehicleNumber: item.number_plate || '',
          departureTime: item.departure_time ? new Date(item.departure_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Leaving soon',
          seatsLeft: item.available_seats || 1,
          price: Number(item.price_per_seat) || 0,
          route: [item.origin_name, item.destination_name],
          pickupPoint: item.origin_name,
          encodedPolyLine: item.encoded_polyline,
        }));
        setCandidateRides(mappedRides);
      } else {
        setCandidateRides([]);
      }
    } catch (err: any) {
      setIsSearching(false);
      setSearchError(err.message || 'Search failed');
    }
  };


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
        {/* ── Input Fields Card with Autocomplete ── */}
        <View style={styles.inputCard}>
          {/* Pickup Input */}
          <LocationSearchInput
            label="Pickup Location"
            placeholder="Start location..."
            value={origin.text}
            onChangeText={handleOriginChange}
            suggestions={originSuggestions}
            onSelectSuggestion={selectOriginSuggestion}
            isSearching={isSearchingOrigin}
            showNotFound={showOriginNotFound}
            onOpenPinPicker={() => openPinPicker('origin')}
            iconName="disc-outline"
            iconColor={Colors.textMuted}
            useGpsButton={true}
            isFetchingGPS={isFetchingOriginGPS}
            onUseGpsLocation={useCurrentLocationForOrigin}
          />

          <View style={styles.inputDivider} />

          {/* Destination Input */}
          <LocationSearchInput
            label="Destination"
            placeholder="Where to? Enter landmark or location"
            value={destination.text}
            onChangeText={handleDestChange}
            suggestions={destSuggestions}
            onSelectSuggestion={selectDestSuggestion}
            isSearching={isSearchingDest}
            showNotFound={showDestNotFound}
            onOpenPinPicker={() => openPinPicker('destination')}
            iconName="location-sharp"
            iconColor={Colors.accent}
          />
        </View>

        {/* ── Search Rides Button ── */}
        {origin.coords && destination.coords && (
          <TouchableOpacity
            style={[styles.searchBtn, isSearching && { opacity: 0.7 }]}
            onPress={handleSearchRides}
            disabled={isSearching}
            activeOpacity={0.85}
          >
            {isSearching ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="search" size={18} color="#fff" />
            )}
            <Text style={styles.searchBtnText}>
              {isSearching ? 'Searching...' : 'Search Rides'}
            </Text>
          </TouchableOpacity>
        )}


        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {destination.text ? (
            <View style={styles.resultsContainer}>
              <Text style={styles.resultsHeading}>Matched Rides to "{destination.text}"</Text>
              {isSearching ? (
                <View style={styles.noResultsCard}>
                  <ActivityIndicator size="large" color={Colors.primary} />
                  <Text style={{ marginTop: 12, color: Colors.textMuted, fontSize: 14 }}>Searching for rides...</Text>
                </View>
              ) : searchError ? (
                <View style={styles.noResultsCard}>
                  <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
                  <Text style={styles.noResultsText}>Search error</Text>
                  <Text style={styles.noResultsSubtext}>{searchError}</Text>
                </View>
              ) : !hasSearched ? (
                <View style={styles.noResultsCard}>
                  <Ionicons name="search-outline" size={48} color={Colors.textMuted} />
                  <Text style={styles.noResultsText}>Tap "Search Rides" above</Text>
                  <Text style={styles.noResultsSubtext}>Enter both locations, then tap Search Rides to find available drivers.</Text>
                </View>
              ) : candidateRides.length === 0 ? (
                <View style={styles.noResultsCard}>
                  <Ionicons name="car-outline" size={48} color={Colors.textMuted} />
                  <Text style={styles.noResultsText}>No rides found on this route</Text>
                  <Text style={styles.noResultsSubtext}>No drivers are currently heading along this route.</Text>
                </View>
              ) : (
                candidateRides.map(ride => (
                  <TouchableOpacity
                    key={ride.id}
                    style={styles.rideCard}
                    onPress={() => {
                      addRecentSearch(origin.text || 'Origin', destination.text);
                      router.push({
                        pathname: '/ride-detail',
                        params: {
                          id: ride.id,
                          selectedPickup: origin.text,
                          selectedDest: destination.text,
                          pickupLat: origin.coords?.lat ?? 0,
                          pickupLng: origin.coords?.lng ?? 0,
                          dropLat: destination.coords?.lat ?? 0,
                          dropLng: destination.coords?.lng ?? 0,
                          riderName: ride.riderName,
                          vehicleName: ride.vehicleName,
                          vehicleNumber: ride.vehicleNumber,
                          price: ride.price,
                          seatsLeft: ride.seatsLeft,
                          departureTime: ride.departureTime,
                          rating: ride.rating ?? 5,
                        },
                      });
                    }}
                    activeOpacity={0.9}
                  >
                    <View style={styles.rideCardHeader}>
                      <View style={styles.driverMeta}>
                        <Text style={styles.driverNameText}>{ride.riderName}</Text>
                        <View style={styles.ratingBadge}>
                          <Ionicons name="star" size={12} color="#F59E0B" />
                          <Text style={styles.ratingText}>{(ride.rating ?? 5).toFixed(1)}</Text>
                        </View>
                      </View>
                      <Text style={styles.priceText}>NPR {ride.price}</Text>
                    </View>

                    <View style={styles.vehicleInfoRow}>
                      <Ionicons name="speedometer-outline" size={14} color={Colors.textMuted} />
                      <Text style={styles.vehicleNameText}>{ride.vehicleName} • {ride.vehicleNumber}</Text>
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
                  {recentSearches.length === 0 ? (
                    <View style={{ padding: 20, alignItems: 'center' }}>
                      <Text style={{ fontSize: 13, color: Colors.textMuted }}>No recent search history.</Text>
                    </View>
                  ) : (
                    recentSearches.map(item => (
                      <TouchableOpacity 
                        key={item.id}
                        style={styles.listItemRow} 
                        onPress={() => handleSelectRecent(item.to)}
                      >
                        <View style={styles.listIconCircle}>
                          <Ionicons name="time-outline" size={20} color={Colors.textMuted} />
                        </View>
                        <View style={styles.listItemTextContainer}>
                          <Text style={styles.listItemTitle} numberOfLines={1}>
                            {item.from} → {item.to}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              ) : (
                <View style={styles.listSection}>
                  {savedPlaces.length === 0 ? (
                    <View style={{ padding: 20, alignItems: 'center' }}>
                      <Text style={{ fontSize: 13, color: Colors.textMuted }}>No saved places yet.</Text>
                    </View>
                  ) : (
                    savedPlaces.map((place) => (
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
                    ))
                  )}
                </View>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── 📍 FULL SCREEN PIN PICKER FALLBACK MAP MODAL ── */}
      <Modal
        visible={pinPickerModalOpen}
        animationType="slide"
        transparent={false}
        onRequestClose={closePinPicker}
      >
        <View style={styles.pinPickerContainer}>
          <View style={styles.pinPickerHeader}>
            <TouchableOpacity onPress={closePinPicker} style={styles.pinPickerBackBtn}>
              <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.pinPickerTitle}>
                Set {pinPickerTargetType === 'origin' ? 'Pickup' : 'Destination'} Pin
              </Text>
              <Text style={styles.pinPickerSub}>Drag or tap on map to confirm exact location</Text>
            </View>
          </View>

          {/* Pin Picker Content Body */}
          <View style={{ flex: 1, position: 'relative' }}>
            {/* Quick Location Chips */}
            <View style={styles.pinQuickChipsRow}>
              <Text style={styles.quickChipHeading}>Quick Locations in Nepal:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {[
                  { name: 'Kathmandu Center', lat: 27.7172, lng: 85.3240 },
                  { name: 'Kalanki Chok', lat: 27.6938, lng: 85.2817 },
                  { name: 'Butwal Highway', lat: 27.7006, lng: 83.4484 },
                  { name: 'Bhairahawa Station', lat: 27.5065, lng: 83.4485 },
                  { name: 'Harkatta Chok', lat: 27.6500, lng: 83.5000 },
                ].map(item => (
                  <TouchableOpacity
                    key={item.name}
                    style={styles.pinQuickChip}
                    onPress={() => setDraggedPinCoords({ lat: item.lat, lng: item.lng })}
                  >
                    <Ionicons name="location" size={14} color={Colors.primary} />
                    <Text style={styles.pinQuickChipText}>{item.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Interactive Map View */}
            <LocationPinPickerMap
              initialLocation={draggedPinCoords}
              targetType={pinPickerTargetType}
              onConfirmPin={(coords, placeName) => {
                setDraggedPinCoords(prev => {
                  const next = { ...coords };
                  if (placeName) {
                    (next as any).placeName = placeName;
                  } else if (prev && (prev as any).placeName) {
                    (next as any).placeName = (prev as any).placeName;
                  }
                  return next;
                });
              }}
              quickLocations={[
                { name: 'Kathmandu Center', lat: 27.7172, lng: 85.3240 },
                { name: 'Kalanki Chok', lat: 27.6938, lng: 85.2817 },
                { name: 'Butwal Highway', lat: 27.7006, lng: 83.4484 },
                { name: 'Bhairahawa Station', lat: 27.5065, lng: 83.4485 },
                { name: 'Harkatta Chok', lat: 27.6500, lng: 83.5000 },
              ]}
            />
          </View>

          <View style={styles.pinPickerFooter}>
            <TouchableOpacity
              style={styles.confirmPinBtn}
              onPress={() => {
                if (draggedPinCoords) {
                  const placeName = (draggedPinCoords as any).placeName || `Pin (${draggedPinCoords.lat.toFixed(4)}, ${draggedPinCoords.lng.toFixed(4)})`;
                  confirmPinLocation(draggedPinCoords, placeName);
                }
              }}
            >
              <Text style={styles.confirmPinBtnText}>Confirm Location Pin</Text>
              <Ionicons name="checkmark-circle" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  searchBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
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
  autocompleteDropdown: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    marginTop: 4,
    marginBottom: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 99,
  },
  autocompleteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 10,
  },
  autocompleteMainText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  autocompleteSubText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  inputHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 2,
  },
  inputLabelSmall: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  gpsBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  searchingText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '700',
    fontStyle: 'italic',
    marginRight: 6,
  },
  cantFindBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginHorizontal: 8,
    marginTop: 4,
    marginBottom: 8,
  },
  cantFindText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  pinPickerContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  pinPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  pinPickerBackBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  pinPickerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  pinPickerSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  pinPickerMapArea: {
    flex: 1,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2E8F0',
  },
  mapMockBackground: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapMockTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#475569',
    marginTop: 8,
  },
  mapMockCoords: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
    marginTop: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pinQuickChipsRow: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quickChipHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 8,
  },
  pinQuickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  pinQuickChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  floatingCenterPin: {
    position: 'absolute',
    top: '44%',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  pinPickerFooter: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  confirmPinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmPinBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
});

