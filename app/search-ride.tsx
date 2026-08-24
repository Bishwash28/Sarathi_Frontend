import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState, useRef, useEffect } from 'react';
import {
  Animated,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { Colors } from '../constants/Colors';
import { useApp } from '../context/AppContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Landmark locations for nearest match
const MAP_LANDMARKS = {
  'Kalanki': { latitude: 27.6937, longitude: 85.2817 },
  'Balkhu': { latitude: 27.6845, longitude: 85.2907 },
  'Tripureshwor': { latitude: 27.6961, longitude: 85.3121 },
  'Putalisadak': { latitude: 27.7042, longitude: 85.3218 },
  'Chabahil': { latitude: 27.7172, longitude: 85.3496 },
  'Koteshwor': { latitude: 27.6756, longitude: 85.3461 },
  'Balkumari': { latitude: 27.6708, longitude: 85.3418 },
  'Lagankhel': { latitude: 27.6675, longitude: 85.3232 },
};

// Case-insensitive and partial match lookup helper
const findLandmarkByName = (name: string) => {
  if (!name) return null;
  const cleanName = name.trim().toLowerCase();
  
  // Exact match
  for (const [key, value] of Object.entries(MAP_LANDMARKS)) {
    if (key.toLowerCase() === cleanName) {
      return { name: key, ...value };
    }
  }
  // Substring match
  for (const [key, value] of Object.entries(MAP_LANDMARKS)) {
    if (key.toLowerCase().includes(cleanName) || cleanName.includes(key.toLowerCase())) {
      return { name: key, ...value };
    }
  }
  return null;
};

const getNearestLandmarkName = (lat: number, lng: number): string => {
  let minDistance = Infinity;
  let nearestName = 'Kalanki';
  for (const [name, coord] of Object.entries(MAP_LANDMARKS)) {
    const dist = Math.pow(coord.latitude - lat, 2) + Math.pow(coord.longitude - lng, 2);
    if (dist < minDistance) {
      minDistance = dist;
      nearestName = name;
    }
  }
  return nearestName;
};

// Bottom Sheet Snap Points (measured as translateY from top of screen)
const SNAP_POINTS = {
  FULL: SCREEN_HEIGHT * 0.08,   // Almost top
  HALF: SCREEN_HEIGHT * 0.45,  // Middle
  PEEK: SCREEN_HEIGHT * 0.72,  // Bottom peek (default)
};

export default function SearchRideScreen() {
  const { rides, deviceLocation } = useApp();
  const params = useLocalSearchParams();

  // Route States
  const [pickup, setPickup] = useState((params.prefillFrom as string) || deviceLocation || 'Kalanki');
  const [destination, setDestination] = useState((params.prefillTo as string) || '');
  const [activeTab, setActiveTab] = useState<'recent' | 'saved'>('recent');

  // Custom Saved Locations States
  const [savedHome, setSavedHome] = useState<string>('');
  const [savedWork, setSavedWork] = useState<string>('');
  const [savedNewList, setSavedNewList] = useState<{ id: string, name: string }[]>([]);
  const [missingPlaces, setMissingPlaces] = useState<string[]>([]);

  // Map Selection States
  const [isSelectingOnMap, setIsSelectingOnMap] = useState<false | 'pickup' | 'destination'>(false);
  const [mapRegion, setMapRegion] = useState({
    latitude: 27.6937,
    longitude: 85.2817,
    latitudeDelta: 0.04,
    longitudeDelta: 0.04,
  });
  
  // Center coordinates during map selection panning
  const currentMapCenter = useRef({ latitude: 27.6937, longitude: 85.2817 });
  const mapRef = useRef<MapView>(null);

  // Bottom Sheet Drag Animations
  const panY = useRef(new Animated.Value(0)).current;
  const currentSnapY = useRef(SNAP_POINTS.PEEK); // Start in PEEK mode

  // Route path coordinates state
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);

  // Force re-renders for expand button text state updates
  const [, setTick] = useState(0);

  // Snap the sheet to a specific target point helper
  const snapTo = (snapY: number, stateName: 'peek' | 'half' | 'full') => {
    currentSnapY.current = snapY;
    setTick(t => t + 1);
    Animated.spring(panY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 40,
      friction: 8,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderGrant: () => {
        panY.setValue(0);
      },
      onPanResponderMove: (evt, gestureState) => {
        const nextY = currentSnapY.current + gestureState.dy;
        if (nextY >= SNAP_POINTS.FULL && nextY <= SNAP_POINTS.PEEK) {
          panY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        const targetY = currentSnapY.current + gestureState.dy;
        
        let finalSnap = SNAP_POINTS.HALF;
        
        if (targetY < (SNAP_POINTS.FULL + SNAP_POINTS.HALF) / 2) {
          finalSnap = SNAP_POINTS.FULL;
        } else if (targetY > (SNAP_POINTS.HALF + SNAP_POINTS.PEEK) / 2) {
          finalSnap = SNAP_POINTS.PEEK;
        }
        
        currentSnapY.current = finalSnap;
        setTick(t => t + 1);
        
        Animated.spring(panY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 40,
          friction: 8,
        }).start();
      },
    })
  ).current;

  const animatedTranslateY = Animated.add(panY, new Animated.Value(currentSnapY.current));

  // Auto locate user location when map first opens
  useEffect(() => {
    handleCenterOnMyLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch Route line coordinates between matched inputs
  useEffect(() => {
    const fetchRoute = async () => {
      const startCoord = findLandmarkByName(pickup);
      const endCoord = findLandmarkByName(destination);
      if (startCoord && endCoord) {
        try {
          const url = `https://router.project-osrm.org/route/v1/driving/${startCoord.longitude},${startCoord.latitude};${endCoord.longitude},${endCoord.latitude}?overview=full&geometries=geojson`;
          const res = await fetch(url);
          const data = await res.json();
          if (data.routes && data.routes[0]) {
            const coords = data.routes[0].geometry.coordinates.map((coord: [number, number]) => ({
              latitude: coord[1],
              longitude: coord[0],
            }));
            setRouteCoords(coords);
          } else {
            setRouteCoords([startCoord, endCoord]);
          }
        } catch (err) {
          console.warn("Failed to fetch OSRM route:", err);
          setRouteCoords([startCoord, endCoord]);
        }
      } else {
        setRouteCoords([]);
      }
    };
    fetchRoute();
  }, [pickup, destination]);

  // Automatically zoom and fit viewport to show start, end, and route path line
  useEffect(() => {
    if (mapRef.current && !isSelectingOnMap) {
      const startCoord = findLandmarkByName(pickup);
      const endCoord = findLandmarkByName(destination);
      
      if (startCoord && endCoord) {
        const coordsToFit = routeCoords.length > 0 ? routeCoords : [startCoord, endCoord];
        mapRef.current.fitToCoordinates(coordsToFit, {
          edgePadding: { top: 120, right: 80, bottom: SCREEN_HEIGHT * 0.38, left: 80 },
          animated: true,
        });
      }
    }
  }, [pickup, destination, routeCoords, isSelectingOnMap]);

  // Filter rides based on matched route endpoints
  const filteredRides = destination
    ? rides.filter(ride =>
        ride.route.some(landmark =>
          landmark.toLowerCase().includes(destination.toLowerCase())
        )
      )
    : [];

  const handleBack = () => {
    if (isSelectingOnMap) {
      setIsSelectingOnMap(false);
      snapTo(SNAP_POINTS.HALF, 'half');
    } else {
      router.back();
    }
  };

  const handleSelectRecent = (placeName: string) => {
    setDestination(placeName);
    snapTo(SNAP_POINTS.HALF, 'half');
  };

  // Start map selection mode
  const startMapSelection = async (mode: 'pickup' | 'destination') => {
    setIsSelectingOnMap(mode);
    snapTo(SNAP_POINTS.PEEK, 'peek'); // minimize sheet to peek so they can see map
    
    // Centering coordinate logic
    const currentLocName = mode === 'pickup' ? pickup : destination;
    let matchedCoord = findLandmarkByName(currentLocName);
    
    // Fallback if current input isn't a matched predefined landmark
    if (!matchedCoord) {
      matchedCoord = findLandmarkByName(deviceLocation) || MAP_LANDMARKS['Kalanki'];
      
      // Try to center on user's current GPS location first as fallback
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          let location = await Location.getCurrentPositionAsync({});
          matchedCoord = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
        }
      } catch (err) {
        console.warn("Failed to get current GPS coordinate fallback during map selection initialization:", err);
      }
    }

    if (matchedCoord) {
      const region = {
        latitude: matchedCoord.latitude,
        longitude: matchedCoord.longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      };
      setMapRegion(region);
      currentMapCenter.current = { latitude: matchedCoord.latitude, longitude: matchedCoord.longitude };
      
      if (mapRef.current) {
        mapRef.current.animateToRegion(region, 800);
      }
    }
  };

  // Confirm selection from Map Pin
  const handleConfirmMapLocation = () => {
    const nearestName = getNearestLandmarkName(
      currentMapCenter.current.latitude,
      currentMapCenter.current.longitude
    );
    if (isSelectingOnMap === 'pickup') {
      setPickup(nearestName);
    } else if (isSelectingOnMap === 'destination') {
      setDestination(nearestName);
    }
    setIsSelectingOnMap(false);
    snapTo(SNAP_POINTS.HALF, 'half');
  };

  // Map Controls: Zoom
  const handleZoom = (zoomIn: boolean) => {
    const factor = zoomIn ? 0.5 : 2;
    const nextRegion = {
      ...mapRegion,
      latitude: currentMapCenter.current.latitude,
      longitude: currentMapCenter.current.longitude,
      latitudeDelta: Math.max(0.001, Math.min(2.0, mapRegion.latitudeDelta * factor)),
      longitudeDelta: Math.max(0.001, Math.min(2.0, mapRegion.longitudeDelta * factor)),
    };
    setMapRegion(nextRegion);
    if (mapRef.current) {
      mapRef.current.animateToRegion(nextRegion, 300);
    }
  };

  // Map Controls: My Location
  const handleCenterOnMyLocation = async () => {
    let targetCoords = findLandmarkByName(deviceLocation) || MAP_LANDMARKS['Kalanki'];
    
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        let location = await Location.getCurrentPositionAsync({});
        const nextRegion = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        };
        setMapRegion(nextRegion);
        currentMapCenter.current = { latitude: location.coords.latitude, longitude: location.coords.longitude };
        if (mapRef.current) {
          mapRef.current.animateToRegion(nextRegion, 500);
        }
        return;
      }
    } catch (e) {
      console.warn("Failed to get current GPS location, centering on fallback landmark:", e);
    }

    const nextRegion = {
      latitude: targetCoords.latitude,
      longitude: targetCoords.longitude,
      latitudeDelta: 0.015,
      longitudeDelta: 0.015,
    };
    setMapRegion(nextRegion);
    currentMapCenter.current = { latitude: targetCoords.latitude, longitude: targetCoords.longitude };
    if (mapRef.current) {
      mapRef.current.animateToRegion(nextRegion, 500);
    }
  };

  // Handle click on Map to immediately update selection coordinates
  const handleMapPress = (e: any) => {
    if (isSelectingOnMap && e.nativeEvent && e.nativeEvent.coordinate) {
      const { latitude, longitude } = e.nativeEvent.coordinate;
      currentMapCenter.current = { latitude, longitude };
      
      const nextRegion = {
        ...mapRegion,
        latitude,
        longitude,
      };
      setMapRegion(nextRegion);
      if (mapRef.current) {
        mapRef.current.animateToRegion(nextRegion, 300);
      }
    }
  };

  // Action flow to Save a Location
  const handleSaveLocation = (type: 'home' | 'work' | 'custom' | 'missing') => {
    const currentLoc = destination || pickup || 'Kalanki';
    
    if (type === 'home') {
      setSavedHome(currentLoc);
      Alert.alert('Location Saved', `"${currentLoc}" has been saved as your Home location.`);
    } else if (type === 'work') {
      setSavedWork(currentLoc);
      Alert.alert('Location Saved', `"${currentLoc}" has been saved as your Work location.`);
    } else if (type === 'custom') {
      setSavedNewList(prev => [...prev, { id: `custom-${Date.now()}`, name: currentLoc }]);
      Alert.alert('Location Saved', `"${currentLoc}" has been saved as a new favorite.`);
    } else if (type === 'missing') {
      setMissingPlaces(prev => [...prev, currentLoc]);
      Alert.alert('Place Requested', `"${currentLoc}" has been submitted as a missing place.`);
    }
  };

  // Click on a saved location to fill the inputs
  const handleSelectSaved = (name: string) => {
    if (!pickup || pickup === deviceLocation) {
      setPickup(name);
    } else {
      setDestination(name);
    }
    snapTo(SNAP_POINTS.HALF, 'half');
  };

  const toggleExpand = () => {
    if (currentSnapY.current === SNAP_POINTS.PEEK) {
      snapTo(SNAP_POINTS.HALF, 'half');
    } else if (currentSnapY.current === SNAP_POINTS.HALF) {
      snapTo(SNAP_POINTS.FULL, 'full');
    } else {
      snapTo(SNAP_POINTS.PEEK, 'peek');
    }
  };

  // Check dynamically matched landmark coordinate details
  const startLocMatch = findLandmarkByName(pickup);
  const endLocMatch = findLandmarkByName(destination);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      {/* ── Background Map ── */}
      <View style={styles.mapContainer}>
        {Platform.OS === 'web' ? (
          <View style={styles.webMapFallback}>
            <Ionicons name="map" size={48} color={Colors.textMuted} />
            <Text style={styles.webMapText}>Interactive Map View</Text>
            <Text style={styles.webMapSubtext}>Click to select simulation available in native app</Text>
          </View>
        ) : (
          <MapView
            ref={mapRef}
            provider={PROVIDER_DEFAULT}
            style={styles.map}
            initialRegion={mapRegion}
            onRegionChangeComplete={(region) => {
              currentMapCenter.current = {
                latitude: region.latitude,
                longitude: region.longitude,
              };
            }}
            onPress={handleMapPress}
          >
            {/* Show Route path polyline if start and destination are selected */}
            {routeCoords.length > 0 && !isSelectingOnMap && (
              <Polyline
                coordinates={routeCoords}
                strokeColor={Colors.primary}
                strokeWidth={4.5}
              />
            )}

            {/* Show markers if location is known and not selecting */}
            {!isSelectingOnMap && startLocMatch && (
              <Marker
                coordinate={{ latitude: startLocMatch.latitude, longitude: startLocMatch.longitude }}
                title="Start location"
              >
                <View style={styles.pickupMarker} />
              </Marker>
            )}
            {!isSelectingOnMap && endLocMatch && (
              <Marker
                coordinate={{ latitude: endLocMatch.latitude, longitude: endLocMatch.longitude }}
                title="Destination"
              >
                <View style={styles.destinationMarker} />
              </Marker>
            )}
          </MapView>
        )}

        {/* ── Central Pin Overlay for Map Selection ── */}
        {isSelectingOnMap && (
          <View style={styles.centerPinContainer} pointerEvents="none">
            <View style={styles.pinAnimationWrapper}>
              <Ionicons
                name="location"
                size={40}
                color={isSelectingOnMap === 'pickup' ? Colors.primary : Colors.accent}
              />
              <View style={styles.pinShadow} />
            </View>
          </View>
        )}

        {/* ── Map Selection Header Instruction Overlay ── */}
        {isSelectingOnMap && (
          <View style={styles.mapSelectionHeader}>
            <Text style={styles.mapSelectionTitle}>
              Choose {isSelectingOnMap === 'pickup' ? 'Start Location' : 'Destination'}
            </Text>
            <Text style={styles.mapSelectionSubtitle}>
              Tap the map or drag to position pin at nearest landmark
            </Text>
          </View>
        )}

        {/* ── Confirm Pin Button Overlay ── */}
        {isSelectingOnMap && (
          <TouchableOpacity
            style={styles.confirmLocationButton}
            onPress={handleConfirmMapLocation}
          >
            <Text style={styles.confirmLocationText}>Confirm Location</Text>
            <Ionicons name="checkmark-circle" size={20} color="#FFF" />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Floating Controls at Root level to avoid touch blocking (higher zIndex sibling) ── */}
      <View style={styles.floatingControls}>
        <TouchableOpacity style={styles.controlButton} onPress={() => handleZoom(true)}>
          <Ionicons name="add" size={22} color={Colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton} onPress={() => handleZoom(false)}>
          <Ionicons name="remove" size={22} color={Colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton} onPress={handleCenterOnMyLocation}>
          <Ionicons name="locate" size={22} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Floating Back Button (Root level sibling) */}
      <TouchableOpacity style={styles.floatingBackButton} onPress={handleBack}>
        <Ionicons
          name={isSelectingOnMap ? "close" : "arrow-back"}
          size={24}
          color={Colors.primary}
        />
      </TouchableOpacity>

      {/* ── Draggable Bottom Sheet (zIndex: 50 sibling) ── */}
      <Animated.View
        style={[
          styles.bottomSheet,
          { transform: [{ translateY: animatedTranslateY }] }
        ]}
      >
        {/* Handle Bar Area */}
        <View style={styles.dragHandleContainer} {...panResponder.panHandlers}>
          <View style={styles.dragHandle} />
          <TouchableOpacity 
            style={styles.expandButton} 
            onPress={toggleExpand}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          >
            <Ionicons 
              name={currentSnapY.current === SNAP_POINTS.FULL ? "chevron-down" : "chevron-up"} 
              size={18} 
              color={Colors.primary} 
            />
            <Text style={styles.expandButtonText}>
              {currentSnapY.current === SNAP_POINTS.FULL ? "Minimize" : currentSnapY.current === SNAP_POINTS.HALF ? "Full View" : "Expand Options"}
            </Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* ── Header with Input Fields ── */}
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
              <TouchableOpacity
                style={[
                  styles.mapSelectIconBtn,
                  isSelectingOnMap === 'pickup' && styles.mapSelectIconBtnActive
                ]}
                onPress={() => startMapSelection('pickup')}
              >
                <Ionicons name="map-outline" size={18} color={isSelectingOnMap === 'pickup' ? '#FFF' : Colors.primary} />
              </TouchableOpacity>
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
              <TouchableOpacity
                style={[
                  styles.mapSelectIconBtn,
                  isSelectingOnMap === 'destination' && styles.mapSelectIconBtnActive
                ]}
                onPress={() => startMapSelection('destination')}
              >
                <Ionicons name="map-outline" size={18} color={isSelectingOnMap === 'destination' ? '#FFF' : Colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {destination ? (
              <View style={styles.resultsContainer}>
                <Text style={styles.resultsHeading}>Matched Rides going to &quot;{destination}&quot;</Text>
                {filteredRides.length === 0 ? (
                  <View style={styles.noResultsCard}>
                    <Ionicons name="search-outline" size={48} color={Colors.textMuted} />
                    <Text style={styles.noResultsText}>No matched rides found on this route.</Text>
                    <Text style={styles.noResultsSubtext}>Try searching landmarks like &apos;Koteshwor&apos;, &apos;Balkhu&apos;, or &apos;Chabahil&apos;.</Text>
                  </View>
                ) : (
                  filteredRides.map(ride => (
                    <TouchableOpacity
                      key={ride.id}
                      style={styles.rideCard}
                      onPress={() => router.push({ pathname: '/ride-detail', params: { id: ride.id } })}
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
                        <Ionicons name={ride.vehicleType === 'bike' ? 'bicycle' : 'car'} size={14} color={Colors.textMuted} />
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
                    {/* Add Home */}
                    <TouchableOpacity 
                      style={styles.listItemRow} 
                      onPress={() => savedHome ? handleSelectSaved(savedHome) : handleSaveLocation('home')}
                    >
                      <View style={[styles.listIconCircle, styles.savedIconBackground]}>
                        <Ionicons name="home" size={18} color={Colors.primary} />
                      </View>
                      <View style={styles.listItemTextContainer}>
                        <Text style={styles.savedItemText}>
                          {savedHome ? `Home: ${savedHome}` : 'Add Home'}
                        </Text>
                      </View>
                      {savedHome && (
                        <TouchableOpacity style={styles.moreButton} onPress={() => handleSaveLocation('home')}>
                          <Ionicons name="pencil" size={16} color={Colors.textMuted} />
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>

                    {/* Add Work */}
                    <TouchableOpacity 
                      style={styles.listItemRow}
                      onPress={() => savedWork ? handleSelectSaved(savedWork) : handleSaveLocation('work')}
                    >
                      <View style={[styles.listIconCircle, styles.savedIconBackground]}>
                        <Ionicons name="briefcase" size={18} color={Colors.primary} />
                      </View>
                      <View style={styles.listItemTextContainer}>
                        <Text style={styles.savedItemText}>
                          {savedWork ? `Work: ${savedWork}` : 'Add Work'}
                        </Text>
                      </View>
                      {savedWork && (
                        <TouchableOpacity style={styles.moreButton} onPress={() => handleSaveLocation('work')}>
                          <Ionicons name="pencil" size={16} color={Colors.textMuted} />
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>

                    {/* Add Custom / Favorite */}
                    {savedNewList.map(item => (
                      <TouchableOpacity 
                        key={item.id} 
                        style={styles.listItemRow}
                        onPress={() => handleSelectSaved(item.name)}
                      >
                        <View style={[styles.listIconCircle, styles.savedIconBackground]}>
                          <Ionicons name="bookmark" size={18} color={Colors.primary} />
                        </View>
                        <View style={styles.listItemTextContainer}>
                          <Text style={styles.savedItemText}>{item.name}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}

                    <TouchableOpacity style={styles.listItemRow} onPress={() => handleSaveLocation('custom')}>
                      <View style={[styles.listIconCircle, styles.savedIconBackground]}>
                        <Ionicons name="add-circle" size={18} color={Colors.primary} />
                      </View>
                      <View style={styles.listItemTextContainer}>
                        <Text style={styles.savedItemText}>Add New Favorite</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                )}

                {/* ── Add Missing Place ── */}
                <TouchableOpacity style={styles.missingPlaceCard} onPress={() => handleSaveLocation('missing')}>
                  <View style={styles.missingPlaceIconCircle}>
                    <Ionicons name="location" size={20} color="#F59E0B" />
                  </View>
                  <View style={styles.listItemTextContainer}>
                    <Text style={styles.missingPlaceText}>
                      {missingPlaces.length > 0 ? `Missing Places (${missingPlaces.length})` : 'Add Missing Place'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  keyboardView: {
    flex: 1,
  },
  mapContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT,
    zIndex: 1,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  webMapFallback: {
    flex: 1,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webMapText: {
    fontSize: 16,
    color: '#334155',
    fontWeight: 'bold',
    marginTop: 12,
  },
  webMapSubtext: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  pickupMarker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    borderWidth: 3,
    borderColor: '#FFF',
  },
  destinationMarker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.accent,
    borderWidth: 3,
    borderColor: '#FFF',
  },
  floatingBackButton: {
    position: 'absolute',
    top: 24,
    left: 16,
    backgroundColor: '#FFF',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    zIndex: 100,
  },
  floatingControls: {
    position: 'absolute',
    top: 24,
    right: 16,
    gap: 8,
    zIndex: 100,
  },
  controlButton: {
    backgroundColor: '#FFF',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  centerPinContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -20,
    marginTop: -40,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  pinAnimationWrapper: {
    alignItems: 'center',
  },
  pinShadow: {
    width: 12,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 2,
    marginTop: -2,
  },
  mapSelectionHeader: {
    position: 'absolute',
    top: 84,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 10,
  },
  mapSelectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  mapSelectionSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  confirmLocationButton: {
    position: 'absolute',
    bottom: SCREEN_HEIGHT * 0.32, // Positioned well above peek sheet
    alignSelf: 'center',
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 30,
    elevation: 5,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    zIndex: 10,
  },
  confirmLocationText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    zIndex: 50,
  },
  dragHandleContainer: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  dragHandle: {
    width: 48,
    height: 5,
    backgroundColor: '#CBD5E1',
    borderRadius: 3,
    marginBottom: 4,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  expandButtonText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  inputCard: {
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    padding: 8,
    marginHorizontal: 16,
    marginBottom: 12,
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
  mapSelectIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  mapSelectIconBtnActive: {
    backgroundColor: Colors.primary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 250,
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
  missingPlaceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
  },
  missingPlaceIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  missingPlaceText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
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
