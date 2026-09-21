import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
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
import { useApp } from '../../context/AppContext';
import { useLocationSearch } from '../../hooks/useLocationSearch';
import { LocationPinPickerMap } from '../../components/LocationPinPickerMap';
import { LocationSearchInput } from '../../components/LocationSearchInput';
import { supabase } from '../../lib/supabase';



export interface VehicleData {
  id: string;
  userId?: string;
  vehicleNumber: string;
  vehicleModelName: string;
  vehicleType?: string;
  images?: string[];
}

export default function HomeScreen() {
  const {
    notifications,
    driverNotifications,
    unreadDriverNotifCount,
    user,
    completeProfile,
    createRide,
    updateRide,
    deleteRide,
    rides,
    recentSearches,
    savedPlaces,
    removeSavedPlace,
    activeBooking,
  } = useApp();
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [passengerTab, setPassengerTab] = useState<'recent' | 'saved'>('recent');

  // Driver Route Creation Form States
  const [userVehicles, setUserVehicles] = useState<VehicleData[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleData | null>(null);
  const [isVehicleDropdownOpen, setIsVehicleDropdownOpen] = useState(false);
  const [originName, setOriginName] = useState('');
  const [destName, setDestName] = useState('');
  const [originLat, setOriginLat] = useState('');
  const [originLng, setOriginLng] = useState('');
  const [destLat, setDestLat] = useState('');
  const [destLng, setDestLng] = useState('');
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [encodedPolyLine, setEncodedPolyLine] = useState('');
  const [price, setPrice] = useState('');
  const [seatsLeft, setSeatsLeft] = useState('1');
  const [departureTime, setDepartureTime] = useState('');
  const [isMapExpanded, setIsMapExpanded] = useState(false);

    const {
    origin,
    originSuggestions,
    isSearchingOrigin,
    showOriginNotFound,
    isFetchingOriginGPS,
    handleOriginChange,
    selectOriginSuggestion,
    useCurrentLocationForOrigin,

    destination,
    destSuggestions,
    isSearchingDest,
    showDestNotFound,
    handleDestChange,
    selectDestSuggestion,

    pinPickerModalOpen,
    pinPickerTargetType,
    openPinPicker,
    closePinPicker,
    confirmPinLocation,

    isCalculatingRoute,
    calculateRoute,
    isBothResolved,
    errorMsg: locationErrorMsg,
    routeInfo,
  } = useLocationSearch();

  // Temporary pin drag position for Modal map picker
  const [draggedPinCoords, setDraggedPinCoords] = useState<{ lat: number; lng: number } | null>(null);

  React.useEffect(() => {
    if (pinPickerModalOpen) {
      if (pinPickerTargetType === 'origin' && origin.coords) {
        setDraggedPinCoords(origin.coords);
      } else if (pinPickerTargetType === 'destination' && destination.coords) {
        setDraggedPinCoords(destination.coords);
      } else {
        // Default center for Nepal (Kathmandu / Central Nepal)
        setDraggedPinCoords({ lat: 27.7172, lng: 85.3240 });
      }
    }
  }, [pinPickerModalOpen, pinPickerTargetType]);

  const fetchVehicles = React.useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[index fetchVehicles] Error:', error.message);
        return;
      }

      if (data && data.length > 0) {
        const mapped: VehicleData[] = data.map((v: any) => ({
          id: v.id,
          userId: v.user_id,
          vehicleNumber: v.number_plate || '',
          vehicleModelName: v.vehicle_name || '',
          vehicleType: v.vehicle_type || 'bike',
          images: v.vehicle_image ? [v.vehicle_image] : [],
        }));
        setUserVehicles(mapped);
        setSelectedVehicle(prev => (prev ? prev : mapped[0]));
      } else {
        setUserVehicles([]);
        setSelectedVehicle(null);
      }
    } catch (err) {
      console.error('[index fetchVehicles] Catch:', err);
    }
  }, [user?.id]);

  React.useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  // Edit Ride Modal State
  const [editingRide, setEditingRide] = useState<any | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editSeats, setEditSeats] = useState('');
  const [editDepartureTime, setEditDepartureTime] = useState('');

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
    if (user?.kycVerified === true || user?.kycStatus === 'VERIFIED') {
      Alert.alert(
        'Switch to Driver mode?',
        'You are currently in Rider mode. Are you sure you want to switch to Driver mode?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Switch to Driver',
            style: 'default',
            onPress: () => completeProfile({ role: 'driver' }),
          },
        ]
      );
    } else if (user?.kycStatus === 'REJECTED') {
      const reasonText = user.kycRejectionReason ? `\n\nReason: ${user.kycRejectionReason}` : '';
      Alert.alert(
        'KYC Verification Rejected',
        `Your KYC verification was rejected.${reasonText}\n\nPlease upload proper documents to re-submit your verification.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Re-submit KYC Now',
            onPress: () => router.push('/kyc'),
          },
        ]
      );
    } else if (user?.kycStatus === 'PENDING') {
      Alert.alert(
        'KYC Review Pending',
        'Your KYC verification is currently under review by Admin. You will be able to offer rides once approved.',
        [{ text: 'OK' }]
      );
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
    Alert.alert(
      'Switch to Rider mode?',
      'You are currently in Driver mode. Are you sure you want to switch to Rider mode?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch to Rider',
          style: 'default',
          onPress: () => completeProfile({ role: 'passenger' }),
        },
      ]
    );
  };

  const handleCreateOffer = async () => {
    // Auto select first vehicle if not explicitly chosen but available
    const activeVeh = selectedVehicle || (userVehicles.length > 0 ? userVehicles[0] : null);

    if (!activeVeh) {
      Alert.alert(
        'No Vehicle Selected',
        'Please register or select a vehicle before publishing a ride offer.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add Vehicle', onPress: () => router.push('/vehicles') },
        ]
      );
      return;
    }
    if (!origin.text.trim()) {
      Alert.alert('Missing Starting Location', 'Please enter a starting location.');
      return;
    }
    if (!destination.text.trim()) {
      Alert.alert('Missing Destination', 'Please enter a destination location.');
      return;
    }

    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price in NPR per seat (e.g. 150).');
      return;
    }

    // Auto-derive coords for typed origin/dest if not explicitly set via suggestion
    const finalOriginCoords = origin.coords || { lat: 27.7006, lng: 83.4484 };
    const finalDestCoords = destination.coords || { lat: 27.5333, lng: 83.8000 };
    const finalDepartureTime = departureTime.trim() || 'Leaving soon';

    // Fetch polyline if set
    let polylineString = encodedPolyLine || routeInfo?.encodedPolyline || '';

    // Publish ride to backend
    try {
      const result = await createRide({
        vehicleType: (activeVeh.vehicleType as any) || 'bike',
        vehicleName: activeVeh.vehicleModelName,
        vehicleNumber: activeVeh.vehicleNumber,
        vehicleId: activeVeh.id,
        origin: finalOriginCoords,
        destination: finalDestCoords,
        encodedPolyLine: polylineString,
        departureTime: finalDepartureTime,
        seatsLeft: parseInt(seatsLeft, 10) || 1,
        price: parsedPrice,
        route: [origin.text, destination.text],
        pickupPoint: origin.text,
      });

      if (result.success) {
        Alert.alert('Ride Published! 🎉', 'Your ride offer is now live for passengers to discover.');
        // Reset form
        setPrice('');
        setSeatsLeft('1');
        setDepartureTime('');
        setEncodedPolyLine('');
      } else {
        Alert.alert('Failed to Publish', result.error || 'Please check your inputs and try again.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to publish ride. Please try again.');
    }
  };

  const handleOpenEditRide = (ride: any) => {
    setEditingRide(ride);
    setEditPrice(String(ride.price));
    setEditSeats(String(ride.seatsLeft));
    setEditDepartureTime(ride.departureTime || '');
  };

  const handleSaveEditRide = () => {
    if (!editingRide) return;
    const parsedPrice = parseFloat(editPrice);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price.');
      return;
    }
    const parsedSeats = parseInt(editSeats, 10);
    if (isNaN(parsedSeats) || parsedSeats < 0) {
      Alert.alert('Invalid Seats', 'Please enter valid available seats.');
      return;
    }

    updateRide(editingRide.id, {
      price: parsedPrice,
      seatsLeft: parsedSeats,
      departureTime: editDepartureTime || 'Leaving soon',
    });

    setEditingRide(null);
    Alert.alert('Ride Updated', 'Your ride offer details have been updated.');
  };

  const handleDeleteRide = (rideId: string) => {
    Alert.alert(
      'Delete Ride Offer?',
      'Are you sure you want to cancel and delete this active ride offer?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteRide(rideId);
            Alert.alert('Ride Deleted', 'The ride offer has been removed.');
          },
        },
      ]
    );
  };
  return (
    <View style={styles.safeArea}>
      {/* ── DRIVER MODE WORKSPACE: POST ROUTE SCREEN ── */}
      {isDriverMode ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header Title */}
          <View style={styles.cleanPostHeader}>
            <Text style={styles.cleanPostTitle}>Publish Route Offer</Text>
            <Text style={styles.cleanPostSub}>Post your travel route for passengers along your way</Text>
          </View>

          {/* Post Route Form */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.driverScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.cleanFormCard}>
              {/* 1. Vehicle Selection Dropdown */}
              <Text style={styles.inputLabel}>Vehicle *</Text>
              {userVehicles.length > 0 ? (
                <View style={{ marginBottom: 16 }}>
                  <TouchableOpacity
                    style={[styles.locationInputBoxRow, { justifyContent: 'space-between', paddingRight: 12 }]}
                    onPress={() => setIsVehicleDropdownOpen(!isVehicleDropdownOpen)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
                      <Ionicons name="car-sport" size={20} color={Colors.primary} />
                      <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.textPrimary }} numberOfLines={1}>
                        {selectedVehicle
                          ? `${selectedVehicle.vehicleModelName} (${selectedVehicle.vehicleNumber})`
                          : 'Select a vehicle...'}
                      </Text>
                    </View>
                    <Ionicons
                      name={isVehicleDropdownOpen ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={Colors.textMuted}
                    />
                  </TouchableOpacity>

                  {isVehicleDropdownOpen && (
                    <View style={[styles.autocompleteDropdown, { marginTop: 4 }]}>
                      {userVehicles.map(v => {
                        const isSelected = selectedVehicle?.id === v.id || selectedVehicle?.vehicleNumber === v.vehicleNumber;
                        return (
                          <TouchableOpacity
                            key={v.id || v.vehicleNumber}
                            style={[styles.autocompleteItem, isSelected && { backgroundColor: Colors.surface }]}
                            onPress={() => {
                              setSelectedVehicle(v);
                              setIsVehicleDropdownOpen(false);
                            }}
                            activeOpacity={0.8}
                          >
                            <Ionicons
                              name="car-sport"
                              size={18}
                              color={isSelected ? Colors.primary : Colors.textMuted}
                            />
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.autocompleteMainText, isSelected && { color: Colors.primary, fontWeight: '800' }]}>
                                {v.vehicleModelName}
                              </Text>
                              <Text style={styles.autocompleteSubText}>
                                License Plate: {v.vehicleNumber}
                              </Text>
                            </View>
                            {isSelected && (
                              <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.noVehicleCard, { marginBottom: 16 }]}
                  onPress={() => router.push('/vehicles')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="alert-circle-outline" size={22} color={Colors.warning} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.noVehicleTitle}>No Vehicles Registered</Text>
                    <Text style={styles.noVehicleSub}>Tap here to register your vehicle</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
                </TouchableOpacity>
              )}

              {/* 2. Starting Location */}
              <LocationSearchInput
                label="Starting Location (Origin) *"
                placeholder="Where are you starting from? (e.g. Kalanki)"
                value={origin.text}
                onChangeText={handleOriginChange}
                suggestions={originSuggestions}
                onSelectSuggestion={selectOriginSuggestion}
                isSearching={isSearchingOrigin}
                iconName="disc-outline"
                iconColor="#16A34A"
              />

              {/* 3. Destination Location */}
              <LocationSearchInput
                label="Destination Location *"
                placeholder="Where are you going? (e.g. Butwal)"
                value={destination.text}
                onChangeText={handleDestChange}
                suggestions={destSuggestions}
                onSelectSuggestion={selectDestSuggestion}
                isSearching={isSearchingDest}
                iconName="location-sharp"
                iconColor="#DC2626"
              />

              {/* 4 & 5. Available Seats & Price */}
              <View style={styles.rowInputs}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Seats Available</Text>
                  <View style={[styles.inputContainer, { backgroundColor: '#F8FAFC' }]}>
                    <Ionicons name="person" size={18} color={Colors.primary} style={styles.inputIcon} />
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
                  <Text style={styles.inputLabel}>Price / Seat (NPR) *</Text>
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

              {/* 6. Departure Time */}
              <Text style={styles.inputLabel}>Departure Time *</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="time-outline" size={20} color={Colors.primary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Leaving in 15 mins (09:30 AM)"
                  placeholderTextColor={Colors.textMuted}
                  value={departureTime}
                  onChangeText={setDepartureTime}
                />
              </View>

              {/* 7. Publish Button */}
              {(() => {
                const isValid = Boolean(
                  origin.text.trim() &&
                  destination.text.trim() &&
                  price.trim()
                );
                return (
                  <TouchableOpacity
                    style={[
                      styles.createButton,
                      (!isValid || isCalculatingRoute) && { backgroundColor: '#94A3B8', opacity: 0.75 },
                    ]}
                    onPress={handleCreateOffer}
                    disabled={!isValid || isCalculatingRoute}
                    activeOpacity={0.9}
                  >
                    {isCalculatingRoute ? (
                      <Text style={styles.createText}>Calculating Route...</Text>
                    ) : (
                      <>
                        <Text style={styles.createText}>Publish Route Offer</Text>
                        <Ionicons name="paper-plane" size={18} color="#FFF" />
                      </>
                    )}
                  </TouchableOpacity>
                );
              })()}
            </View>

            {/* Most Recent Offered Ride Card ONLY */}
            {(() => {
              const myAllOffers = rides.filter(r => r.riderName === user?.name || r.phone === user?.phone);
              const latestOffer = myAllOffers.length > 0 ? myAllOffers[0] : null;

              if (!latestOffer) return null;

              return (
                <View style={styles.myOffersSection}>
                  <Text style={styles.myOffersHeading}>Most Recent Active Offer</Text>
                  <View key={latestOffer.id} style={styles.myOfferCard}>
                    <View style={styles.myOfferHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.myOfferRoute} numberOfLines={1}>
                          {latestOffer.route.join(' → ')}
                        </Text>
                        <Text style={styles.myOfferSub}>
                          {latestOffer.vehicleName} • {latestOffer.seatsLeft} seat(s) • NPR {latestOffer.price}/seat
                        </Text>
                        <Text style={styles.myOfferTime}>{latestOffer.departureTime}</Text>
                      </View>
                    </View>
                    <View style={styles.myOfferActions}>
                      <TouchableOpacity
                        style={styles.editOfferBtn}
                        onPress={() => handleOpenEditRide(latestOffer)}
                      >
                        <Ionicons name="create-outline" size={16} color={Colors.primary} />
                        <Text style={styles.editOfferBtnText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deleteOfferBtn}
                        onPress={() => handleDeleteRide(latestOffer.id)}
                      >
                        <Ionicons name="trash-outline" size={16} color="#DC2626" />
                        <Text style={styles.deleteOfferBtnText}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })()}

            <View style={{ height: 100 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        /* ── PASSENGER MODE WORKSPACE ── */
        <>
          {/* Personalized Top Header Bar */}
          <View style={styles.passengerHeaderBar}>
            <View style={styles.userGreetingRow}>
              {user?.photo ? (
                <Image source={{ uri: user.photo }} style={styles.userHeaderAvatar} />
              ) : (
                <View style={styles.userHeaderAvatarPlaceholder}>
                  <Text style={styles.userHeaderAvatarText}>
                    {(user?.name || 'P').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View>
                <Text style={styles.greetingSubText}>
                  {(() => {
                    const hr = new Date().getHours();
                    if (hr < 12) return 'Good Morning ☀️';
                    if (hr < 17) return 'Good Afternoon 🌤️';
                    return 'Good Evening 🌙';
                  })()}
                </Text>
                <Text style={styles.greetingUserName}>{user?.name || 'Passenger'}</Text>
              </View>
            </View>
          </View>

          {/* Main Scroll Content */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* 🚗 UBER/BOLT-STYLE "WHERE TO?" HERO SEARCH CARD ── */}
            <View style={styles.whereToHeroCard}>
              <View style={styles.whereToTextHeader}>
                <Text style={styles.whereToMainTitle}>Where to?</Text>
                <Text style={styles.whereToSubTitle}>Search routes, find drivers or compare prices</Text>
              </View>

              <TouchableOpacity
                style={styles.heroSearchBoxRow}
                onPress={handleFindRide}
                activeOpacity={0.88}
              >
                <Ionicons name="search" size={22} color={Colors.primary} />
                <Text style={styles.heroSearchPlaceholderText}>
                  Enter destination (e.g. Kathmandu, Butwal)...
                </Text>
                <View style={styles.heroLocationIconPill}>
                  <Ionicons name="location-sharp" size={16} color={Colors.primary} />
                </View>
              </TouchableOpacity>
            </View>

            {/* 📍 POPULAR DESTINATIONS SHORTCUTS BAR ── */}
            <View style={styles.popularSection}>
              <Text style={styles.sectionHeadingTitle}>Popular Destinations</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.popularDestScroll}
              >
                {[
                  { name: 'Kathmandu', landmark: 'Kalanki Chowk' },
                  { name: 'Butwal', landmark: 'Bus Park Chowk' },
                  { name: 'Bhairahawa', landmark: 'Airport Road' },
                  { name: 'Pokhara', landmark: 'Prithvi Chowk' },
                  { name: 'Sunwal', landmark: 'Sunwal Bazar' },
                ].map((dest, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.destChipCard}
                    onPress={() => handleRecentSearchTap('Current Location', dest.name)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.destChipIconCircle}>
                      <Ionicons name="location" size={14} color={Colors.primary} />
                    </View>
                    <View>
                      <Text style={styles.destChipTitle}>{dest.name}</Text>
                      <Text style={styles.destChipSub}>{dest.landmark}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* 🚗 ONGOING RIDE PERSISTENT ACTIVITY CARD (IF ACTIVE) ── */}
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

            {/* ⚡ QUICK ACTIONS GRID (2-COLUMN MODERN CARDS) ── */}
            <View style={styles.quickGridSection}>
              <Text style={styles.sectionHeadingTitle}>Quick Actions</Text>
              <View style={styles.gridRowContainer}>
                {/* Find Ride Card */}
                <TouchableOpacity
                  style={[styles.gridActionCard, styles.gridFindRideCard]}
                  onPress={handleFindRide}
                  activeOpacity={0.88}
                >
                  <View style={styles.gridIconCircleBlue}>
                    <Ionicons name="car" size={24} color="#FFFFFF" />
                  </View>
                  <Text style={styles.gridCardTitleBlue}>Find a Ride</Text>
                  <Text style={styles.gridCardSubBlue}>Search active routes</Text>
                </TouchableOpacity>

                {/* Sarathi AI Card */}
                <TouchableOpacity
                  style={[styles.gridActionCard, styles.gridAiCard]}
                  onPress={() => router.push('/ai-assistant')}
                  activeOpacity={0.88}
                >
                  <View style={styles.gridIconCirclePurple}>
                    <Ionicons name="sparkles" size={22} color="#7C3AED" />
                  </View>
                  <View style={styles.aiBadgeTag}>
                    <Text style={styles.aiBadgeTagText}>AI</Text>
                  </View>
                  <Text style={styles.gridCardTitlePurple}>Sarathi AI</Text>
                  <Text style={styles.gridCardSubPurple}>Smart route assistant</Text>
                </TouchableOpacity>
              </View>

              {/* Offer a Ride Card (Driver Mode Toggle) */}
              <TouchableOpacity
                style={styles.gridDriverCard}
                onPress={handleOfferRide}
                activeOpacity={0.88}
              >
                <View style={styles.gridDriverIconCircle}>
                  <Ionicons name="car-sport" size={20} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.gridDriverTitle}>
                    Offer a Ride (Driver Mode) {user?.kycVerified ? '✓' : ''}
                  </Text>
                  <Text style={styles.gridDriverSub}>
                    Publish your travel route for passengers along your way
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
              </TouchableOpacity>
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

      {/* Edit Ride Modal */}
      <Modal
        visible={!!editingRide}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setEditingRide(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Ride Offer</Text>
              <TouchableOpacity onPress={() => setEditingRide(null)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              <Text style={styles.inputLabel}>Price / Seat (NPR)</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.currencyPrefix}>Rs.</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Price per seat"
                  value={editPrice}
                  onChangeText={setEditPrice}
                  keyboardType="numeric"
                />
              </View>

              <Text style={styles.inputLabel}>Available Seats</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="people-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Available seats"
                  value={editSeats}
                  onChangeText={setEditSeats}
                  keyboardType="numeric"
                />
              </View>

              <Text style={styles.inputLabel}>Departure Time</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="time-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Departure time"
                  value={editDepartureTime}
                  onChangeText={setEditDepartureTime}
                />
              </View>

              <TouchableOpacity style={styles.createButton} onPress={handleSaveEditRide} activeOpacity={0.9}>
                <Text style={styles.createText}>Save Changes</Text>
              </TouchableOpacity>
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
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  cleanPostHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cleanPostTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  cleanPostSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  cleanFormCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
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
  passengerHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  userGreetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  userHeaderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  userHeaderAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userHeaderAvatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  greetingSubText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  greetingUserName: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  whereToHeroCard: {
    backgroundColor: Colors.primary,
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 20,
    padding: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  whereToTextHeader: {
    marginBottom: 12,
  },
  whereToMainTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  whereToSubTitle: {
    fontSize: 12,
    color: '#CBD5E1',
    marginTop: 2,
    fontWeight: '500',
  },
  heroSearchBoxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  heroSearchPlaceholderText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  heroLocationIconPill: {
    backgroundColor: Colors.surface,
    padding: 6,
    borderRadius: 10,
  },
  popularSection: {
    marginTop: 16,
    paddingLeft: 16,
  },
  sectionHeadingTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  popularDestScroll: {
    paddingRight: 16,
    gap: 10,
  },
  destChipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
    elevation: 1,
  },
  destChipIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destChipTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  destChipSub: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  quickGridSection: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  gridRowContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  gridActionCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    position: 'relative',
    elevation: 2,
  },
  gridFindRideCard: {
    backgroundColor: Colors.primary,
  },
  gridIconCircleBlue: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  gridCardTitleBlue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  gridCardSubBlue: {
    fontSize: 11,
    color: '#93C5FD',
    marginTop: 2,
  },
  gridAiCard: {
    backgroundColor: '#F3E8FF',
    borderWidth: 1.5,
    borderColor: '#C084FC',
  },
  gridIconCirclePurple: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  aiBadgeTag: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  aiBadgeTagText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  gridCardTitlePurple: {
    fontSize: 15,
    fontWeight: '800',
    color: '#6B21A8',
  },
  gridCardSubPurple: {
    fontSize: 11,
    color: '#7E22CE',
    marginTop: 2,
  },
  gridDriverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  gridDriverIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridDriverTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  gridDriverSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
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
    ...StyleSheet.absoluteFill,
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
  aiAssistantBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3E8FF',
    borderWidth: 1.5,
    borderColor: '#C084FC',
    paddingVertical: 13,
    borderRadius: 14,
    gap: 8,
  },
  aiAssistantText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#6B21A8',
  },
  aiNewPill: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  aiNewText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
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
  vehicleCardPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  vehicleCardPillSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  vehiclePillTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  vehiclePillTitleSelected: {
    color: '#FFFFFF',
  },
  vehiclePillSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  vehiclePillSubSelected: {
    color: '#E2E8F0',
  },
  noVehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },
  noVehicleTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#9F1239',
  },
  noVehicleSub: {
    fontSize: 11,
    color: '#BE123C',
    marginTop: 2,
  },
  locationSelectorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  labelWithActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  liveLocationBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 4,
  },
  liveLocationBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  locationInputBoxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  quickPickModalBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    marginLeft: 8,
  },
  locationCardTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  locationCardSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },
  modalSubheading: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 14,
    lineHeight: 16,
  },
  landmarkOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  landmarkOptionCardSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: Colors.primary,
  },
  landmarkOptionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  landmarkOptionCoords: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  myOffersSection: {
    marginTop: 24,
    gap: 12,
  },
  myOffersHeading: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  myOfferCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  myOfferHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  myOfferRoute: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 4,
  },
  myOfferSub: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  myOfferTime: {
    fontSize: 12,
    color: Colors.success,
    fontWeight: '600',
    marginTop: 2,
  },
  myOfferActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    justifyContent: 'flex-end',
  },
  editOfferBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
  },
  editOfferBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  deleteOfferBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
  },
  deleteOfferBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  autocompleteDropdown: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: -8,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    zIndex: 99,
  },
  autocompleteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
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
  searchingText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '700',
    fontStyle: 'italic',
    paddingRight: 6,
  },
  cantFindBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginTop: -4,
    marginBottom: 14,
  },
  cantFindText: {
    fontSize: 13,
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
