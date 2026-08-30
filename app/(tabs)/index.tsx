import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Image,
  ImageBackground,
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
import { Colors } from '../../constants/Colors';
import { useApp, LANDMARKS } from '../../context/AppContext';
import { RouteMap } from '../../components/RouteMap';
import { getAutoRouteCorridor } from '../../utils/routeValidation';



export default function HomeScreen() {
  const {
    notifications,
    driverNotifications,
    unreadDriverNotifCount,
    user,
    completeProfile,
    createRide,
    recentSearches,
    savedPlaces,
    removeSavedPlace,
    activeBooking,
  } = useApp();
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [passengerTab, setPassengerTab] = useState<'recent' | 'saved'>('recent');

  // Driver Route Creation Form States
  const [pointA, setPointA] = useState('Butwal');
  const [pointB, setPointB] = useState('Bhairahawa');
  const [price, setPrice] = useState('180');
  const [seatsLeft, setSeatsLeft] = useState('2');
  const [departureTime, setDepartureTime] = useState('Leaving in 15 mins');
  const [isMapExpanded, setIsMapExpanded] = useState(false);

  const isDriverMode = user?.role === 'driver' && user?.kycVerified === true;

  // Passenger Handlers
  const handleRecentSearchTap = (from: string, to: string) => {
    router.push({
      pathname: '/search-ride',
      params: { prefillFrom: from, prefillTo: to },
    });
  };

  const handleFindRide = () => {
    router.push('/search-ride');
  };

  // Driver Access Check Handler
  const handleOfferRide = () => {
    if (user?.kycVerified === true) {
      completeProfile({ role: 'driver' });
    } else {
      Alert.alert(
        'Driver KYC Verification Required',
        'You must complete driver KYC verification (ID & vehicle details) before offering rides on Sarathi.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Verify KYC Now',
            onPress: () => router.push('/kyc'),
          },
        ]
      );
    }
  };

  const handleSwitchToPassenger = () => {
    completeProfile({ role: 'passenger' });
  };

  // Auto-calculated Route Corridor for Driver Post
  const fullRouteCorridor = getAutoRouteCorridor(pointA, pointB, LANDMARKS);

  const handleCreateOffer = () => {
    if (!pointA || !pointA.trim()) {
      Alert.alert('Missing Start', 'Please enter your Starting Location.');
      return;
    }
    if (!pointB || !pointB.trim()) {
      Alert.alert('Missing Destination', 'Please enter your Destination Location.');
      return;
    }
    if (pointA.trim().toLowerCase() === pointB.trim().toLowerCase()) {
      Alert.alert('Invalid Route', 'Starting Location and Destination cannot be the same.');
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

    createRide({
      vehicleType: user?.vehicleType || 'bike',
      vehicleName: user?.vehicleName || 'Royal Enfield Classic 350',
      vehicleNumber: user?.vehicleNumber || 'LU 1 PA 7788',
      departureTime: departureTime || 'Leaving soon',
      seatsLeft: parsedSeats,
      price: parsedPrice,
      route: fullRouteCorridor,
      pickupPoint: `${pointA} Main Stop`,
    });

    Alert.alert(
      'Route Offer Live! 🎉',
      `Your route offer from ${pointA} to ${pointB} (${fullRouteCorridor.join(' → ')}) is now live for passenger matching!`,
      [
        {
          text: 'View Driver Activity',
          onPress: () => router.push('/activity'),
        },
      ]
    );
  };

  // Map Coordinates Helper
  const resolveLandmarkCoord = (name: string, fallbackName: string) => {
    const cleanName = name.trim().toLowerCase();
    const matched = Object.entries(LANDMARKS).find(([key]) =>
      key.toLowerCase().includes(cleanName) || cleanName.includes(key.toLowerCase())
    );
    if (matched) return { latitude: matched[1].latitude, longitude: matched[1].longitude };
    const fallback = LANDMARKS[fallbackName] || LANDMARKS['Butwal'] || LANDMARKS['Kalanki'];
    return { latitude: fallback.latitude, longitude: fallback.longitude };
  };

  const startCoord = resolveLandmarkCoord(pointA, 'Butwal');
  const endCoord = resolveLandmarkCoord(pointB, 'Bhairahawa');
  const driverCurrentLocation = {
    latitude: startCoord.latitude + 0.002,
    longitude: startCoord.longitude + 0.002,
  };
  const waypointCoords = fullRouteCorridor
    .slice(1, -1)
    .map((name) => ({
      coordinate: resolveLandmarkCoord(name, 'Tilottama'),
      title: name,
    }));

  return (
    <View style={styles.safeArea}>
      {/* ── DRIVER MODE WORKSPACE: POST ROUTE SCREEN ── */}
      {isDriverMode ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Driver Mode Header Bar */}
          <View style={styles.driverHeaderBar}>
            <View style={styles.driverBadgePill}>
              <Ionicons name="car-sport" size={16} color="#FFF" />
              <Text style={styles.driverBadgeTitle}>Driver Workspace</Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TouchableOpacity
                style={styles.driverNotifBell}
                onPress={() => router.push('/notifications')}
              >
                <Ionicons name="notifications-outline" size={20} color="#FFF" />
                {unreadDriverNotifCount > 0 && (
                  <View style={styles.driverNotifBadge}>
                    <Text style={styles.driverNotifBadgeText}>{unreadDriverNotifCount}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.switchModePill}
                onPress={handleSwitchToPassenger}
              >
                <Ionicons name="swap-horizontal" size={16} color={Colors.primary} />
                <Text style={styles.switchModeText}>Passenger Mode</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Interactive Map View */}
          <View style={[styles.mapContainer, isMapExpanded && { height: 380 }]}>
            <RouteMap
              startCoord={startCoord}
              endCoord={endCoord}
              startTitle={pointA}
              endTitle={pointB}
              driverLocation={driverCurrentLocation}
              waypoints={waypointCoords}
              vehicleType={user?.vehicleType || 'bike'}
              strokeColor="#C62026"
              showControls={true}
            />

            <View style={styles.mapBadgeOverlay}>
              <View style={styles.driverDotRed} />
              <Text style={styles.mapBadgeText} numberOfLines={1}>
                Driver Route Corridor: {fullRouteCorridor.join(' → ')}
              </Text>
              <TouchableOpacity onPress={() => setIsMapExpanded(!isMapExpanded)}>
                <Ionicons name={isMapExpanded ? 'contract' : 'expand'} size={18} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Post Route Form */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.driverScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.driverInfoCard}>
              <View style={styles.avatarCircle}>
                <Ionicons name="shield-checkmark" size={22} color={Colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.driverWelcome}>Verified Driver: {user?.name || 'Driver'}</Text>
                <Text style={styles.vehicleMeta}>
                  {user?.vehicleName || 'Vehicle'} • {user?.vehicleNumber || 'Plate Number'}
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

            {/* Destination Location */}
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

            {/* Auto Corridor Summary */}
            <View style={styles.autoCorridorCard}>
              <View style={styles.autoCorridorHeader}>
                <Ionicons name="git-merge-outline" size={18} color={Colors.primary} />
                <Text style={styles.autoCorridorTitle}>Auto-Detected Corridor</Text>
              </View>
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

            <View style={{ height: 100 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        /* ── PASSENGER MODE WORKSPACE ── */
        <>
          {/* Header Bar */}
          <View style={styles.headerBar}>
            <View style={styles.logoContainer}>
              <Image
                source={require('../../assets/images/text_logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>

            <TouchableOpacity
              style={styles.notifBellButton}
              onPress={() => router.push('/notifications')}
            >
              <Ionicons name="notifications-outline" size={22} color={Colors.primary} />
              {notifications.length > 0 && (
                <View style={styles.notifBadgeCircle}>
                  <Text style={styles.notifBadgeText}>{notifications.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Main Home Screen Board */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Header Hero Section */}
            <ImageBackground
              source={require('../../assets/images/home_top1.png')}
              style={styles.heroSection}
              imageStyle={styles.heroImageStyle}
            >
              <View style={styles.heroOverlay} />
              <View style={styles.heroTextContainer}>
                <Text style={styles.heroHeading}>
                  Going somewhere?{'\n'}Find or share a route.
                </Text>
                <Text style={styles.heroSubtext}>
                  Connect with riders traveling along your exact path.
                </Text>
              </View>
            </ImageBackground>

            {/* 🚗 ONGOING RIDE PERSISTENT ACTIVITY CARD ── */}
            {activeBooking && (
              <TouchableOpacity
                style={styles.ongoingRideCard}
                activeOpacity={0.9}
                onPress={() => {
                  if (activeBooking.lifecycleState === 'request_pending') {
                    router.push({ pathname: '/booking-status', params: { rideId: activeBooking.rideId } });
                  } else {
                    router.push({ pathname: '/active-trip', params: { rideId: activeBooking.rideId } });
                  }
                }}
              >
                <View style={styles.ongoingBadgeRow}>
                  <View style={styles.livePulseDot} />
                  <Text style={styles.ongoingBadgeTitle}>
                    {activeBooking.lifecycleState === 'request_pending'
                      ? 'RIDE REQUEST PENDING'
                      : activeBooking.lifecycleState === 'waiting_for_pickup' || activeBooking.lifecycleState === 'pickup_otp_required'
                      ? 'DRIVER ARRIVING AT PICKUP'
                      : activeBooking.lifecycleState === 'ride_started'
                      ? 'LIVE RIDE IN PROGRESS'
                      : activeBooking.lifecycleState === 'completion_otp_required'
                      ? 'ARRIVED AT DESTINATION'
                      : activeBooking.lifecycleState === 'payment_pending'
                      ? 'PAYMENT PENDING'
                      : 'RATE YOUR DRIVER'}
                  </Text>
                </View>

                <Text style={styles.ongoingRouteTitle}>
                  {activeBooking.passengerPickup || 'Butwal'} ➔ {activeBooking.passengerDropoff || 'Bhairahawa'}
                </Text>

                <View style={styles.ongoingCardFooter}>
                  <Text style={styles.ongoingSubtext}>
                    {activeBooking.lifecycleState === 'request_pending'
                      ? 'Waiting for driver response...'
                      : activeBooking.lifecycleState === 'pickup_otp_required'
                      ? 'Pickup OTP: 4821'
                      : activeBooking.lifecycleState === 'completion_otp_required'
                      ? 'Completion OTP: 7392'
                      : 'Tap to continue active ride'}
                  </Text>
                  <View style={styles.continueButton}>
                    <Text style={styles.continueButtonText}>Continue Ride →</Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}

            {/* Action Buttons: Find a Ride & Offer a Ride (Driver) */}
            <View style={styles.actionButtonsSection}>
              <TouchableOpacity
                style={styles.findRideBar}
                onPress={handleFindRide}
                activeOpacity={0.85}
              >
                <Ionicons name="search" size={20} color="#FFF" />
                <Text style={styles.findRideText}>Find a Ride</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.offerRideBar}
                onPress={handleOfferRide}
                activeOpacity={0.85}
              >
                <Ionicons name="car-sport" size={20} color={Colors.primary} />
                <Text style={styles.offerRideText}>
                  Offer a Ride (Driver) {user?.kycVerified ? '✓' : ''}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Tabs Section */}
            <View style={styles.tabsSection}>
              <View style={styles.tabToggleContainer}>
                <TouchableOpacity
                  style={[styles.tabButton, passengerTab === 'recent' && styles.activeTabButton]}
                  onPress={() => setPassengerTab('recent')}
                >
                  <Text style={[styles.tabButtonText, passengerTab === 'recent' && styles.activeTabButtonText]}>
                    Recent Routes
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tabButton, passengerTab === 'saved' && styles.activeTabButton]}
                  onPress={() => setPassengerTab('saved')}
                >
                  <Text style={[styles.tabButtonText, passengerTab === 'saved' && styles.activeTabButtonText]}>
                    Saved Places
                  </Text>
                </TouchableOpacity>
              </View>

              {passengerTab === 'recent' ? (
                recentSearches.length === 0 ? (
                  <View style={styles.emptyTabCard}>
                    <Ionicons name="time-outline" size={24} color={Colors.textMuted} />
                    <Text style={styles.emptyTabText}>No recent route searches yet.</Text>
                    <Text style={styles.emptyTabSub}>Search a ride to automatically save recent routes here.</Text>
                  </View>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.recentChipsScroll}
                  >
                    {recentSearches.map((search) => (
                      <TouchableOpacity
                        key={search.id}
                        style={styles.recentChip}
                        onPress={() => handleRecentSearchTap(search.from, search.to)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="navigate-outline" size={14} color={Colors.primary} />
                        <Text style={styles.recentChipText}>
                          {search.from} → {search.to}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )
              ) : (
                <View style={styles.savedItemsList}>
                  {savedPlaces.length === 0 ? (
                    <View style={styles.emptyTabCard}>
                      <Ionicons name="bookmark-outline" size={24} color={Colors.textMuted} />
                      <Text style={styles.emptyTabText}>No saved places yet.</Text>
                      <Text style={styles.emptyTabSub}>Save your favorite pickup & destination locations from search.</Text>
                    </View>
                  ) : (
                    savedPlaces.map((place, idx) => (
                      <React.Fragment key={place.id}>
                        {idx > 0 && <View style={styles.savedDivider} />}
                        <TouchableOpacity
                          style={styles.savedItemRow}
                          activeOpacity={0.7}
                          onPress={() => handleRecentSearchTap(place.landmark, 'Kalanki')}
                        >
                          <View style={styles.savedIconContainer}>
                            <Ionicons name="location" size={18} color={Colors.primary} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.savedItemText}>{place.name}</Text>
                            <Text style={{ fontSize: 11, color: Colors.textMuted }}>{place.landmark}</Text>
                          </View>
                          <TouchableOpacity onPress={() => removeSavedPlace(place.id)}>
                            <Ionicons name="close-circle-outline" size={18} color={Colors.textMuted} />
                          </TouchableOpacity>
                        </TouchableOpacity>
                      </React.Fragment>
                    ))
                  )}
                </View>
              )}
            </View>

            {/* Info Banner */}
            <View style={styles.infoBanner}>
              <View style={styles.infoBannerIconCircle}>
                <Ionicons name="information-circle" size={24} color={Colors.primary} />
              </View>
              <View style={styles.infoBannerTextContainer}>
                <Text style={styles.infoBannerText}>
                  Sarathi connects drivers and passengers on the exact same route. Drivers publish their travel route, and passengers select pickup/drop-off stops along that path!
                </Text>
              </View>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </>
      )}

      {/* Notifications Modal */}
      <Modal
        visible={showNotificationsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowNotificationsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Updates & Notifications</Text>
              <TouchableOpacity onPress={() => setShowNotificationsModal(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              {notifications.length === 0 ? (
                <Text style={styles.noNotifText}>No notifications yet.</Text>
              ) : (
                notifications.map((notif, index) => (
                  <View key={`notif-${index}`} style={styles.notifCardItem}>
                    <View style={styles.notifIconBox}>
                      <Ionicons name="notifications" size={16} color={Colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.notifCardText}>{notif}</Text>
                      <Text style={styles.notifTimeText}>Just now</Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  driverScrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  driverHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.primary,
  },
  driverBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  driverBadgeTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  driverNotifBell: {
    position: 'relative',
    padding: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  driverNotifBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#DC2626',
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFF',
  },
  driverNotifBadgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  switchModePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    gap: 4,
  },
  switchModeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  logoContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  logoImage: {
    width: 84,
    height: 22,
  },
  notifBellButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  notifBadgeCircle: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: Colors.accent,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBadgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  heroSection: {
    width: '100%',
    overflow: 'hidden',
    paddingTop: 8,
    paddingBottom: 40,
    minHeight: 220,
    justifyContent: 'flex-start',
  },
  heroImageStyle: {
    resizeMode: 'cover',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
  heroTextContainer: {
    zIndex: 1,
    paddingHorizontal: 20,
    marginTop: 20,
  },
  heroHeading: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.primary,
    lineHeight: 32,
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  heroSubtext: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    fontWeight: '600',
  },
  actionButtonsSection: {
    marginHorizontal: 16,
    marginTop: -22,
    zIndex: 10,
    gap: 10,
  },
  findRideBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  findRideText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  offerRideBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  offerRideText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary,
  },
  tabsSection: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  tabToggleContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 8,
  },
  tabButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 18,
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
  recentChipsScroll: {
    gap: 8,
    paddingRight: 20,
  },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.accent + '25',
  },
  emptyTabCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTabText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginTop: 6,
  },
  emptyTabSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  recentChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  savedItemsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  savedItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  savedIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  savedItemText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  savedDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    marginTop: 20,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.accent + '15',
    gap: 10,
  },
  infoBannerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBannerTextContainer: {
    flex: 1,
  },
  infoBannerText: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 17,
    fontWeight: '500',
  },
  // Driver Form & Map Styles
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
    backgroundColor: '#F0FDF4',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '60%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  modalScroll: {
    flex: 1,
  },
  noNotifText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    marginVertical: 20,
  },
  notifCardItem: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  notifIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifCardText: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  notifTimeText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  ongoingRideCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    marginVertical: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  ongoingBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  ongoingBadgeTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#86EFAC',
    letterSpacing: 1,
  },
  ongoingRouteTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  ongoingCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 10,
  },
  ongoingSubtext: {
    fontSize: 12,
    color: '#94A3B8',
    flex: 1,
  },
  continueButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
