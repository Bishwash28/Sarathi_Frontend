import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
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

const SCREEN_HEIGHT = Dimensions.get('window').height;
const MIN_SHEET_HEIGHT = Math.round(SCREEN_HEIGHT * 0.22); // Map is Full screen (~78%)
const MED_SHEET_HEIGHT = Math.round(SCREEN_HEIGHT * 0.48); // Medium view (~52%)
const MAX_SHEET_HEIGHT = Math.round(SCREEN_HEIGHT * 0.80); // Small map (~20%)

export default function SearchRideScreen() {
  const { rides, addRecentSearch, recentSearches, savedPlaces, getUserRating } = useApp();
  const params = useLocalSearchParams();

  // Search state
  const [candidateRides, setCandidateRides] = useState<Ride[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // UI state: 3-stage map expansion ('small' | 'medium' | 'full') & Active focused input field
  const [mapSize, setMapSize] = useState<'small' | 'medium' | 'full'>('medium');
  const [activeField, setActiveField] = useState<'origin' | 'destination'>('origin');

  // Animated Draggable Sheet Height
  const sheetHeightAnim = useRef(new Animated.Value(MED_SHEET_HEIGHT)).current;
  const lastSheetHeight = useRef(MED_SHEET_HEIGHT);

  const {
    origin,
    originSuggestions,
    isSearchingOrigin,
    handleOriginChange,
    selectOriginSuggestion,
    setOriginDirect,

    destination,
    destSuggestions,
    isSearchingDest,
    handleDestChange,
    selectDestSuggestion,
    setDestDirect,
  } = useLocationSearch();

  const [activeTab, setActiveTab] = useState<'recent' | 'saved'>('recent');

  // Initialize prefilled locations on mount
  useEffect(() => {
    if (params.prefillFrom && typeof params.prefillFrom === 'string' && !params.prefillFrom.includes('+')) {
      handleOriginChange(params.prefillFrom as string);
    }
    if (params.prefillTo && typeof params.prefillTo === 'string' && !params.prefillTo.includes('+')) {
      handleDestChange(params.prefillTo as string);
    }
  }, [params.prefillFrom, params.prefillTo]);

  // Smoothly snap sheet to specific height target
  const snapToHeight = (targetHeight: number) => {
    lastSheetHeight.current = targetHeight;
    Animated.spring(sheetHeightAnim, {
      toValue: targetHeight,
      useNativeDriver: false,
      bounciness: 4,
      speed: 14,
    }).start();

    if (targetHeight === MIN_SHEET_HEIGHT) setMapSize('full');
    else if (targetHeight === MED_SHEET_HEIGHT) setMapSize('medium');
    else setMapSize('small');
  };

  // Setup PanResponder for intuitive vertical drag gesture on handle bar
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 3,
      onPanResponderGrant: () => {
        sheetHeightAnim.stopAnimation();
      },
      onPanResponderMove: (_, gestureState) => {
        const newHeight = lastSheetHeight.current - gestureState.dy;
        const clampedHeight = Math.max(MIN_SHEET_HEIGHT, Math.min(MAX_SHEET_HEIGHT, newHeight));
        sheetHeightAnim.setValue(clampedHeight);
      },
      onPanResponderRelease: (_, gestureState) => {
        const currentHeight = lastSheetHeight.current - gestureState.dy;

        // Fast swipe flicks
        if (gestureState.vy < -0.4) {
          if (lastSheetHeight.current === MIN_SHEET_HEIGHT) snapToHeight(MED_SHEET_HEIGHT);
          else snapToHeight(MAX_SHEET_HEIGHT);
        } else if (gestureState.vy > 0.4) {
          if (lastSheetHeight.current === MAX_SHEET_HEIGHT) snapToHeight(MED_SHEET_HEIGHT);
          else snapToHeight(MIN_SHEET_HEIGHT);
        } else {
          // Snap to nearest anchor
          const distMin = Math.abs(currentHeight - MIN_SHEET_HEIGHT);
          const distMed = Math.abs(currentHeight - MED_SHEET_HEIGHT);
          const distMax = Math.abs(currentHeight - MAX_SHEET_HEIGHT);

          if (distMin <= distMed && distMin <= distMax) snapToHeight(MIN_SHEET_HEIGHT);
          else if (distMax <= distMed && distMax <= distMin) snapToHeight(MAX_SHEET_HEIGHT);
          else snapToHeight(MED_SHEET_HEIGHT);
        }
      },
    })
  ).current;

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleSelectRecent = (placeName: string) => {
    handleDestChange(placeName);
    addRecentSearch(origin.text || 'Current Location', placeName);
  };

  const handleSelectSaved = (name: string) => {
    if (!origin.text) {
      handleOriginChange(name);
    } else {
      handleDestChange(name);
    }
  };

  // Cycle through map size stages: small -> medium -> full -> small
  const cycleMapSize = () => {
    if (mapSize === 'small') snapToHeight(MED_SHEET_HEIGHT);
    else if (mapSize === 'medium') snapToHeight(MIN_SHEET_HEIGHT);
    else snapToHeight(MAX_SHEET_HEIGHT);
  };

  // Handle direct map selection (tap or drag on the unified map)
  const handleMapSelectCoords = (coords: { lat: number; lng: number }) => {
    const placeName = `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
    if (activeField === 'origin') {
      setOriginDirect(placeName, coords);
    } else {
      setDestDirect(placeName, coords);
    }
  };

  const tokenizeLocation = (str: string): string[] => {
    if (!str) return [];
    const ignoreWords = new Set([
      'nepal', 'province', 'district', 'municipality', 'city', 'vdc', 'ward',
      'bagmati', 'gandaki', 'lumbini', 'koshi', 'madhesh', 'karnali', 'sudurpashchim'
    ]);
    return str
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 2 && !ignoreWords.has(w));
  };

  const isRideMatching = (
    r: Ride,
    origQuery: string,
    destQuery: string,
    origCoords?: { lat: number; lng: number } | null,
    destCoords?: { lat: number; lng: number } | null
  ): boolean => {
    if (r.seatsLeft <= 0 || (r.status && r.status !== 'active')) return false;

    // Build normalized list of stop names along the rider's route
    const rStops = [
      r.pickupPoint || '',
      ...(r.route || []),
    ].filter(Boolean);

    const findStopIndex = (query: string): number => {
      if (!query) return -1;
      const q = query.toLowerCase().trim();
      if (!q) return -1;

      // 1. Direct substring match
      const directIdx = rStops.findIndex(stop => {
        const s = stop.toLowerCase().trim();
        if (!s) return false;
        return s.includes(q) || q.includes(s);
      });
      if (directIdx >= 0) return directIdx;

      // 2. Tokenized partial match
      const qTokens = tokenizeLocation(q);
      if (qTokens.length === 0) return -1;

      return rStops.findIndex(stop => {
        const stopTokens = tokenizeLocation(stop);
        if (stopTokens.length === 0) return false;
        return qTokens.some(qt => stopTokens.some(st => st.includes(qt) || qt.includes(st)));
      });
    };

    const origIdx = findStopIndex(origQuery);
    const destIdx = findStopIndex(destQuery);

    // 1. Text-based route corridor matching
    if (origQuery && destQuery) {
      if (origIdx >= 0 && destIdx >= 0) {
        // Both stops present on rider's route. Pickup MUST be before dropoff (forward direction)
        return origIdx < destIdx;
      }
      // Note: If text matching is incomplete, do NOT return false immediately.
      // Let coordinate geometry matching evaluate if coordinates are available.
    }

    // 2. Coordinate geometry matching (if coordinates exist for passenger origin & destination)
    if (origCoords && destCoords && r.origin && r.destination) {
      const A = r.origin;
      const B = r.destination;
      const P = origCoords;
      const Q = destCoords;

      const dLat = B.lat - A.lat;
      const dLng = B.lng - A.lng;
      const lenSq = dLat * dLat + dLng * dLng;

      if (lenSq > 0.000001) {
        const t_P = ((P.lat - A.lat) * dLat + (P.lng - A.lng) * dLng) / lenSq;
        const t_Q = ((Q.lat - A.lat) * dLat + (Q.lng - A.lng) * dLng) / lenSq;

        const perp_P = Math.abs((P.lat - A.lat) * dLng - (P.lng - A.lng) * dLat) / Math.sqrt(lenSq);
        const perp_Q = Math.abs((Q.lat - A.lat) * dLng - (Q.lng - A.lng) * dLat) / Math.sqrt(lenSq);

        const distPtoA = Math.hypot(P.lat - A.lat, P.lng - A.lng);
        const distQtoB = Math.hypot(Q.lat - B.lat, Q.lng - B.lng);

        // Within ~18km (0.18 deg) corridor off straight line, or close to endpoints
        const isPValid = (perp_P <= 0.18 && t_P >= -0.25 && t_P <= 1.25) || distPtoA <= 0.18 || origIdx >= 0;
        const isQValid = (perp_Q <= 0.18 && t_Q >= -0.25 && t_Q <= 1.25) || distQtoB <= 0.18 || destIdx >= 0;
        const isForwardDirection = t_P < t_Q || (origIdx >= 0 && destIdx >= 0 && origIdx < destIdx);

        if (isPValid && isQValid && isForwardDirection) {
          return true;
        }
      }
    }

    // 3. Single location search (if passenger specified ONLY pickup OR ONLY destination)
    if (origQuery && !destQuery) {
      if (origIdx >= 0) return true;
      if (origCoords && r.origin) {
        const dist = Math.hypot(origCoords.lat - r.origin.lat, origCoords.lng - r.origin.lng);
        if (dist <= 0.18) return true;
      }
      return false;
    }

    if (!origQuery && destQuery) {
      if (destIdx >= 0) return true;
      if (destCoords && r.destination) {
        const dist = Math.hypot(destCoords.lat - r.destination.lat, destCoords.lng - r.destination.lng);
        if (dist <= 0.18) return true;
      }
      return false;
    }

    return false;
  };

  const handleSearchRides = async () => {
    if (!origin.text && !destination.text) {
      Alert.alert('Missing Location', 'Please select both origin and destination.');
      return;
    }
    setIsSearching(true);
    setHasSearched(true);
    setSearchError(null);

    try {
      let rpcRides: Ride[] = [];

      // 1. Primary Search: PostGIS Corridor Buffer if valid non-zero coordinates exist
      if (origin.coords && destination.coords) {
        const { data, error } = await supabase.rpc('search_matching_rides', {
          p_origin_lat: origin.coords.lat,
          p_origin_lng: origin.coords.lng,
          p_dest_lat: destination.coords.lat,
          p_dest_lng: destination.coords.lng,
          p_seats_needed: 1,
          p_buffer_meters: 15000.0,
        });

        if (!error && data && data.length > 0) {
          rpcRides = data.map((item: any) => ({
            id: item.ride_id,
            riderId: item.rider_id || item.user_id,
            riderName: item.rider_name || 'Rider',
            riderPhoto: item.rider_photo || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&h=200&q=80',
            vehicleType: 'scooter',
            vehicleName: item.vehicle_name || 'Vehicle',
            vehicleNumber: item.number_plate || '',
            departureTime: item.departure_time ? new Date(item.departure_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            seatsLeft: item.available_seats || 1,
            price: Number(item.price_per_seat) || 0,
            route: [item.origin_name, item.destination_name],
            pickupPoint: item.origin_name,
            encodedPolyLine: item.encoded_polyline,
            origin: { lat: Number(item.origin_lat), lng: Number(item.origin_lng) },
            destination: { lat: Number(item.destination_lat), lng: Number(item.destination_lng) },
            status: item.status || 'active',
          }));
        }
      }

      // 2. Client-side Corridor & Proximity matching across context rides
      const origQuery = (origin.text || '').toLowerCase().trim();
      const destQuery = (destination.text || '').toLowerCase().trim();

      const matchedFallback = rides.filter(r => {
        return isRideMatching(r, origQuery, destQuery, origin.coords, destination.coords);
      });

      // Combine RPC rides and fallback rides without duplicates
      const rideMap = new Map<string, Ride>();
      rpcRides.forEach(r => rideMap.set(r.id, r));
      matchedFallback.forEach(r => {
        if (!rideMap.has(r.id)) rideMap.set(r.id, r);
      });

      const combinedRides = Array.from(rideMap.values());
      setCandidateRides(combinedRides);
      setIsSearching(false);
      snapToHeight(MAX_SHEET_HEIGHT);
    } catch (err: any) {
      setIsSearching(false);
      setCandidateRides([]);
      setSearchError(null);
      snapToHeight(MAX_SHEET_HEIGHT);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.mainContainer}>
        {/* ── 🗺️ FULL SCREEN BACKGROUND INTERACTIVE MAP ── */}
        <View style={styles.fullScreenMapContainer}>
          <LocationPinPickerMap
            originCoords={origin.coords}
            destCoords={destination.coords}
            originName={origin.text}
            destName={destination.text}
            activeTarget={activeField}
            onSelectCoords={handleMapSelectCoords}
          />
        </View>

        {/* ── 🔍 COMPACT FLOATING HEADER BAR ── */}
        <View style={styles.transparentHeader}>
          <TouchableOpacity style={styles.floatingHeaderPill} onPress={handleBack} activeOpacity={0.85}>
            <Ionicons name="arrow-back" size={20} color={Colors.primary} />
            <Text style={styles.headerTitleText}>Find a Ride</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.floatingAiPill}
            onPress={() => router.push('/ai-assistant')}
            activeOpacity={0.85}
          >
            <Ionicons name="sparkles" size={16} color="#7C3AED" />
            <Text style={styles.floatingAiText}>Ask AI</Text>
          </TouchableOpacity>
        </View>

        {/* ── 📱 SMOOTH DRAGGABLE BOTTOM SHEET WINDOW ── */}
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Animated.View style={[styles.bottomSheetCard, { height: sheetHeightAnim }]}>
            {/* Draggable Handle Bar Touch Area */}
            <View style={styles.handleBarContainer} {...panResponder.panHandlers}>
              <View style={styles.handlePill} />
              <View style={styles.handleLabelRow}>
                <Ionicons
                  name={mapSize === 'full' ? 'chevron-down-circle-outline' : mapSize === 'medium' ? 'swap-vertical-outline' : 'chevron-up-circle-outline'}
                  size={14}
                  color={Colors.primary}
                />
                <Text style={styles.handleLabel}>
                  Drag up or down to resize (<Text style={{ fontWeight: '800', color: Colors.primary }}>{mapSize.toUpperCase()} MAP</Text>)
                </Text>
              </View>
            </View>

            {/* ── Input Fields Card ── */}
            <View style={styles.inputCard}>
              {/* Pickup Location Input */}
              <LocationSearchInput
                label="Pickup Location"
                placeholder="Start location..."
                value={origin.text}
                onChangeText={handleOriginChange}
                suggestions={originSuggestions}
                onSelectSuggestion={(s) => {
                  selectOriginSuggestion(s);
                  setActiveField('origin');
                }}
                isSearching={isSearchingOrigin}
                onFocus={() => {
                  setActiveField('origin');
                  if (mapSize === 'full') snapToHeight(MED_SHEET_HEIGHT);
                }}
                iconName="disc-outline"
                iconColor="#16A34A"
              />

              <View style={styles.inputDivider} />

              {/* Destination Location Input */}
              <LocationSearchInput
                label="Destination"
                placeholder="Where to? Enter location"
                value={destination.text}
                onChangeText={handleDestChange}
                suggestions={destSuggestions}
                onSelectSuggestion={(s) => {
                  selectDestSuggestion(s);
                  setActiveField('destination');
                }}
                isSearching={isSearchingDest}
                onFocus={() => {
                  setActiveField('destination');
                  if (mapSize === 'full') snapToHeight(MED_SHEET_HEIGHT);
                }}
                iconName="location-sharp"
                iconColor="#DC2626"
              />
            </View>

            {/* ── Search Rides Button ── */}
            {(Boolean(origin.text.trim()) || Boolean(destination.text.trim())) && (
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

            {/* ── Results / Tabs Section (visible in Medium & Small map modes) ── */}
            {mapSize !== 'full' && (
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
                                riderOrigin: ride.pickupPoint || (ride.route ? ride.route[0] : ''),
                                riderDest: (ride.route && ride.route.length > 0) ? ride.route[ride.route.length - 1] : ride.pickupPoint,
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
                                <Text style={styles.ratingText}>
                                  {getUserRating(ride.riderId).hasRatings ? getUserRating(ride.riderId).average.toFixed(1) : 'New'}
                                </Text>
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
                    {/* Tabs Toggle */}
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

                    {/* Conditional Tab Content */}
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
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  mainContainer: {
    flex: 1,
    position: 'relative',
  },
  // Full Screen Background Map
  fullScreenMapContainer: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
  },
  // Compact Transparent Floating Header Bar
  transparentHeader: {
    position: 'absolute',
    top: 10,
    left: 14,
    right: 14,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  floatingHeaderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerTitleText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  floatingAiPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
    elevation: 4,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#C084FC',
  },
  floatingAiText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6B21A8',
  },
  keyboardView: {
    ...StyleSheet.absoluteFill,
    zIndex: 10,
    justifyContent: 'flex-end',
    pointerEvents: 'box-none',
  },
  // Bottom Sheet Card
  bottomSheetCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    width: '100%',
  },
  handleBarContainer: {
    alignItems: 'center',
    paddingVertical: 8,
    gap: 4,
    backgroundColor: 'transparent',
  },
  handlePill: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
  },
  handleLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  handleLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  inputCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  inputDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 8,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingTop: 8,
    gap: 12,
  },
  tabButton: {
    paddingVertical: 6,
    paddingHorizontal: 16,
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
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  activeTabButtonText: {
    color: Colors.primary,
  },
  listSection: {
    backgroundColor: '#FFFFFF',
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  listIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
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
  resultsContainer: {
    paddingTop: 12,
  },
  resultsHeading: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
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
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noResultsText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginTop: 10,
    textAlign: 'center',
  },
  noResultsSubtext: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 16,
  },
  rideCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 10,
  },
  rideCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  driverMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  driverNameText: {
    fontSize: 14,
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
    fontSize: 15,
    fontWeight: '800',
    color: Colors.primary,
  },
  vehicleInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  vehicleNameText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
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
