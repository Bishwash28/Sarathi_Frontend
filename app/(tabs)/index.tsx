import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Image,
  ImageBackground,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Colors } from '../../constants/Colors';
import { useApp } from '../../context/AppContext';

const LANDMARKS = ['Kalanki', 'Balkhu', 'Tripureshwor', 'Putalisadak', 'Chabahil', 'Koteshwor', 'Balkumari', 'Lagankhel'];

// Sample recent searches for passengers
const RECENT_SEARCHES = [
  { from: 'Kalanki', to: 'Koteshwor' },
  { from: 'Balkhu', to: 'Chabahil' },
  { from: 'Tripureshwor', to: 'Putalisadak' },
  { from: 'Kalanki', to: 'Lagankhel' },
];

export default function HomeScreen() {
  const { notifications, user, completeProfile, createRide } = useApp();
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  
  // Passenger states
  const [passengerTab, setPassengerTab] = useState<'recent' | 'saved'>('recent');

  // Driver / Post states
  const [pickup, setPickup] = useState('Kalanki');
  const [destination, setDestination] = useState('');
  const [route, setRoute] = useState<string[]>(['Kalanki']); // Starting landmark automatically added
  const [price, setPrice] = useState('150');
  const [seatsLeft, setSeatsLeft] = useState('1');
  const [departureTime, setDepartureTime] = useState('Leaving in 10 mins');

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

  // Driver Handlers
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
          text: 'OK',
          onPress: () => {
            // Reset fields
            setDestination('');
            setRoute([pickup]);
            // Navigate to Activity tab to see the offer!
            router.push('/activity');
          },
        },
      ]
    );
  };

  return (
    <View style={styles.safeArea}>
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/images/text_logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.modeBadgeText}>
            {user?.role === 'driver' ? 'Driver Mode' : 'Passenger Mode'}
          </Text>
        </View>

        {/* Role switch pill selector */}
        <View style={styles.headerRoleContainer}>
          <TouchableOpacity
            style={[
              styles.headerRolePill,
              user?.role !== 'driver' ? styles.rolePillActive : styles.rolePillInactive
            ]}
            onPress={() => completeProfile({ role: 'passenger' })}
            activeOpacity={0.7}
          >
            <Ionicons name="people-outline" size={14} color={user?.role !== 'driver' ? '#FFFFFF' : Colors.primary} />
            <Text style={[styles.rolePillText, user?.role !== 'driver' && styles.rolePillTextActive]}>Book</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.headerRolePill,
              user?.role === 'driver' ? styles.rolePillActive : styles.rolePillInactive
            ]}
            onPress={() => {
              if (user?.kycVerified !== undefined) {
                completeProfile({ role: 'driver' });
              } else {
                router.push('/kyc');
              }
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="car-outline" size={14} color={user?.role === 'driver' ? '#FFFFFF' : Colors.primary} />
            <Text style={[styles.rolePillText, user?.role === 'driver' && styles.rolePillTextActive]}>Offer</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.notifBellButton}
          onPress={() => setShowNotificationsModal(true)}
        >
          <Ionicons name="notifications-outline" size={22} color={Colors.primary} />
          {notifications.length > 0 && (
            <View style={styles.notifBadgeCircle}>
              <Text style={styles.notifBadgeText}>{notifications.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {user?.role === 'driver' ? (
        user?.kycVerified ? (
          /* ─── DRIVER VIEW: POST RIDE FORM ─── */
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.driverScrollContent}
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

            <View style={{ height: 100 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        /* ─── DRIVER VIEW: KYC PENDING LOCK SCREEN ─── */
        <View style={styles.lockContainer}>
          <Ionicons name="shield-alert-outline" size={64} color={Colors.warning} />
          <Text style={styles.lockTitle}>Verification Required</Text>
          <Text style={styles.lockSub}>
            You are currently in Driver Mode, but you need to complete KYC verification to post or list rides on the platform.
          </Text>
          
          <TouchableOpacity style={styles.verifyBtn} onPress={() => router.push('/kyc')} activeOpacity={0.85}>
            <Text style={styles.verifyBtnText}>Verify KYC Now</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFF" />
          </TouchableOpacity>

          <View style={styles.lockHintBox}>
            <Ionicons name="information-circle-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.lockHintText}>
              You can browse other tabs or switch back to Passenger (Book) mode using the toggle in the header.
            </Text>
          </View>
        </View>
      )
      ) : (
        /* ─── PASSENGER VIEW: HOME BOARD ─── */
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header Hero Section ── */}
          <ImageBackground
            source={require('../../assets/images/home_top1.png')}
            style={styles.heroSection}
            imageStyle={styles.heroImageStyle}
          >
            <View style={styles.heroOverlay} />
            <View style={styles.heroTextContainer}>
              <Text style={styles.heroHeading}>
                Going somewhere?{'\n'}Find someone on{'\n'}the same route.
              </Text>
              <Text style={styles.heroSubtext}>
                Search your route and connect{'\n'}with riders headed your way.
              </Text>
            </View>
          </ImageBackground>

          {/* ── Action Button (Find a Ride) ── */}
          <View style={styles.searchBarSection}>
            <TouchableOpacity
              style={styles.findRideBar}
              onPress={handleFindRide}
              activeOpacity={0.85}
            >
              <Ionicons name="search" size={20} color="#FFF" />
              <Text style={styles.findRideText}>Find a Ride</Text>
            </TouchableOpacity>
          </View>

          {/* ── Tabs Section ── */}
          <View style={styles.tabsSection}>
            <View style={styles.tabToggleContainer}>
              <TouchableOpacity
                style={[styles.tabButton, passengerTab === 'recent' && styles.activeTabButton]}
                onPress={() => setPassengerTab('recent')}
              >
                <Text style={[styles.tabButtonText, passengerTab === 'recent' && styles.activeTabButtonText]}>
                  Recent
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabButton, passengerTab === 'saved' && styles.activeTabButton]}
                onPress={() => setPassengerTab('saved')}
              >
                <Text style={[styles.tabButtonText, passengerTab === 'saved' && styles.activeTabButtonText]}>
                  Saved
                </Text>
              </TouchableOpacity>
            </View>

            {passengerTab === 'recent' ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recentChipsScroll}
              >
                {RECENT_SEARCHES.map((search, index) => (
                  <TouchableOpacity
                    key={`recent-${index}`}
                    style={styles.recentChip}
                    onPress={() => handleRecentSearchTap(search.from, search.to)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.recentChipText}>
                      {search.from} → {search.to}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.savedItemsList}>
                <TouchableOpacity style={styles.savedItemRow} activeOpacity={0.7}>
                  <View style={styles.savedIconContainer}>
                    <Ionicons name="home" size={20} color={Colors.primary} />
                  </View>
                  <Text style={styles.savedItemText}>Add Home</Text>
                </TouchableOpacity>

                <View style={styles.savedDivider} />

                <TouchableOpacity style={styles.savedItemRow} activeOpacity={0.7}>
                  <View style={styles.savedIconContainer}>
                    <Ionicons name="briefcase" size={20} color={Colors.primary} />
                  </View>
                  <Text style={styles.savedItemText}>Add Work</Text>
                </TouchableOpacity>

                <View style={styles.savedDivider} />

                <TouchableOpacity style={styles.savedItemRow} activeOpacity={0.7}>
                  <View style={styles.savedIconContainer}>
                    <Ionicons name="bookmark" size={20} color={Colors.primary} />
                  </View>
                  <Text style={styles.savedItemText}>Add New</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* ── Info Banner ── */}
          <View style={styles.infoBanner}>
            <View style={styles.infoBannerIconCircle}>
              <Ionicons name="information-circle" size={24} color={Colors.primary} />
            </View>
            <View style={styles.infoBannerTextContainer}>
              <Text style={styles.infoBannerText}>
                Sarathi connects you with riders already heading your way — search a route, request to join, and split the cost.
              </Text>
            </View>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
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
    padding: 20,
    paddingBottom: 48,
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
  logoContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  logoImage: {
    width: 80,
    height: 20,
  },
  headerRoleContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 2,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerRolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 18,
    gap: 4,
  },
  rolePillActive: {
    backgroundColor: Colors.primary,
  },
  rolePillInactive: {
    backgroundColor: 'transparent',
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  rolePillTextActive: {
    color: '#FFFFFF',
  },
  notifBellButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    minHeight: 280,
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
    marginBottom: 8,
  },
  heroSubtext: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    fontWeight: '600',
  },
  searchBarSection: {
    marginHorizontal: 16,
    marginTop: -22,
    zIndex: 10,
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
  tabsSection: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  tabToggleContainer: {
    flexDirection: 'row',
    marginBottom: 14,
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
    backgroundColor: Colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.accent + '25',
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
  // Driver Form Styling
  driverInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 6,
    marginTop: 14,
  },
  sectionSubtitle: {
    fontSize: 10,
    color: Colors.textMuted,
    marginBottom: 8,
    marginTop: -2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    height: 46,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  currencyPrefix: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: 'bold',
    marginRight: 6,
  },
  input: {
    flex: 1,
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  landmarksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  landmarkChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  landmarkChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  landmarkChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  landmarkChipTextActive: {
    color: '#FFF',
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
    gap: 6,
    height: 48,
    borderRadius: 14,
    marginTop: 30,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  createText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '75%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  modalScroll: {
    paddingBottom: 20,
  },
  noNotifText: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    marginVertical: 20,
  },
  notifCardItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  notifIconBox: {
    backgroundColor: '#FEF2F2',
    padding: 8,
    borderRadius: 10,
    marginRight: 12,
  },
  notifCardText: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: '600',
    lineHeight: 18,
  },
  notifTimeText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
  },
  modeBadgeText: {
    fontSize: 8,
    color: Colors.textMuted,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  lockContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#F8FAFC',
  },
  lockTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  lockSub: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 24,
    gap: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  verifyBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  lockHintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginTop: 36,
    gap: 8,
  },
  lockHintText: {
    fontSize: 11,
    color: Colors.textMuted,
    lineHeight: 15,
    flex: 1,
  },
});
