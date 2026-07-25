import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Image, FlatList, ImageBackground, Modal } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Colors } from '../../constants/Colors';
import { useApp, LANDMARKS, Ride } from '../../context/AppContext';

export default function HomeScreen() {
  const { rides, user, notifications } = useApp();
  const [pickupQuery, setPickupQuery] = useState('Kalanki (Current Location)');
  const [destinationQuery, setDestinationQuery] = useState('');
  const [selectedDestination, setSelectedDestination] = useState<string | null>(null);
  const [vehicleFilter, setVehicleFilter] = useState<'all' | 'bike' | 'car'>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | 'soon' | 'later'>('all');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);

  // Auto-detect user location on mount using expo-location
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          if (loc && loc.coords) {
            setPickupQuery('Kalanki (Current Location)');
          }
        }
      } catch (error) {
        setPickupQuery('Kalanki');
      }
    })();
  }, []);

  const landmarksList = Object.keys(LANDMARKS);

  // Filter landmarks for destination suggestions
  const filteredLandmarks = landmarksList.filter(l =>
    l.toLowerCase().includes(destinationQuery.toLowerCase()) &&
    l.toLowerCase() !== selectedDestination?.toLowerCase()
  );

  // Filter rides based on both pickup & destination search queries and filters
  const filteredRides = rides.filter(ride => {
    if (selectedDestination) {
      const destinationInRoute = ride.route.some(
        landmark => landmark.toLowerCase() === selectedDestination.toLowerCase()
      );
      if (!destinationInRoute) return false;
    } else if (destinationQuery.trim()) {
      const destinationInRoute = ride.route.some(
        landmark => landmark.toLowerCase().includes(destinationQuery.toLowerCase().trim())
      );
      if (!destinationInRoute) return false;
    }

    if (pickupQuery.trim() && !pickupQuery.includes('Current Location')) {
      const pickupInRoute = ride.route.some(
        landmark => landmark.toLowerCase().includes(pickupQuery.toLowerCase().trim())
      );
      if (!pickupInRoute) return false;
    }

    if (vehicleFilter !== 'all' && ride.vehicleType !== vehicleFilter) {
      return false;
    }

    if (timeFilter === 'soon') {
      const isSoon = ride.departureTime.includes('5 mins') || ride.departureTime.includes('10 mins');
      if (!isSoon) return false;
    } else if (timeFilter === 'later') {
      const isSoon = ride.departureTime.includes('5 mins') || ride.departureTime.includes('10 mins');
      if (isSoon) return false;
    }

    return true;
  });

  const handleSelectLandmark = (landmarkName: string) => {
    setSelectedDestination(landmarkName);
    setDestinationQuery(landmarkName);
    setShowSuggestions(false);
  };

  const handleClearDestination = () => {
    setSelectedDestination(null);
    setDestinationQuery('');
    setShowSuggestions(false);
  };

  const handleClearPickup = () => {
    setPickupQuery('');
  };

  const renderRideCard = ({ item }: { item: Ride }) => (
    <TouchableOpacity
      style={styles.rideCard}
      onPress={() => router.push({ pathname: '/ride-detail', params: { id: item.id } })}
      activeOpacity={0.9}
    >
      <View style={styles.cardHeader}>
        <Image source={{ uri: item.riderPhoto }} style={styles.driverPhoto} />
        <View style={styles.driverInfo}>
          <Text style={styles.driverName}>{item.riderName}</Text>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={14} color="#F59E0B" />
            <Text style={styles.ratingText}>{item.rating}</Text>
          </View>
        </View>
        <View style={styles.vehicleBadge}>
          <Ionicons
            name={item.vehicleType === 'bike' ? 'bicycle' : 'car'}
            size={18}
            color={Colors.primary}
          />
          <Text style={styles.vehicleLabel}>
            {item.vehicleType.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.routeContainer}>
        <Ionicons name="location-sharp" size={16} color={Colors.accent} />
        <Text style={styles.routeText} numberOfLines={1}>
          {item.route.join(' → ')}
        </Text>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.footerDetail}>
          <Ionicons name="time-outline" size={16} color={Colors.textMuted} />
          <Text style={styles.footerText}>{item.departureTime}</Text>
        </View>
        <View style={styles.footerDetail}>
          <Ionicons name="people-outline" size={16} color={Colors.textMuted} />
          <Text style={styles.footerText}>{item.seatsLeft} seats left</Text>
        </View>
        <Text style={styles.priceText}>NPR {item.price}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.safeArea}>
      <View style={styles.container}>
        
        {/* Top Section with home_top.png Image Background */}
        <ImageBackground
          source={require('../../assets/images/home_top.png')}
          style={styles.headerBackground}
          imageStyle={styles.headerImageStyle}
        >
          {/* Header Banner with Notification Icon */}
          <View style={styles.headerTextGroup}>
            <View style={styles.headerTitleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.welcomeText}>Hello, {user?.name?.split(' ')[0] || 'Passenger'} 👋</Text>
                <Text style={styles.subWelcome}>Let's find your partner for today's ride</Text>
              </View>

              {/* Notification Icon Button on Home Page */}
              <TouchableOpacity
                style={styles.notifBellButton}
                onPress={() => setShowNotificationsModal(true)}
              >
                <Ionicons name="notifications" size={20} color={Colors.primary} />
                {notifications.length > 0 && (
                  <View style={styles.notifBadgeCircle}>
                    <Text style={styles.notifBadgeText}>{notifications.length}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Dual Search Card Box (Pickup & Destination) */}
          <View style={styles.searchCard}>
            {/* Box 1: Starting Location (Pickup) */}
            <View style={styles.inputRow}>
              <View style={styles.iconCircleBlue}>
                <Ionicons name="disc" size={16} color="#2563EB" />
              </View>
              <TextInput
                style={styles.inputField}
                placeholder="Starting location (e.g. Kalanki)..."
                placeholderTextColor={Colors.textMuted}
                value={pickupQuery}
                onChangeText={setPickupQuery}
              />
              {pickupQuery.length > 0 && (
                <TouchableOpacity style={styles.clearIconButton} onPress={handleClearPickup}>
                  <Ionicons name="close-circle" size={18} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>

            {/* Vertical Connector Line */}
            <View style={styles.connectorLineContainer}>
              <View style={styles.connectorDotLine} />
            </View>

            {/* Box 2: Ending Location (Destination) */}
            <View style={styles.inputRow}>
              <View style={styles.iconCircleRed}>
                <Ionicons name="location" size={16} color="#C62026" />
              </View>
              <TextInput
                style={styles.inputField}
                placeholder="Where are you going? (Ending location)..."
                placeholderTextColor={Colors.textMuted}
                value={destinationQuery}
                onChangeText={(text) => {
                  setDestinationQuery(text);
                  setShowSuggestions(true);
                  if (selectedDestination && text !== selectedDestination) {
                    setSelectedDestination(null);
                  }
                }}
                onFocus={() => setShowSuggestions(true)}
              />
              {destinationQuery.length > 0 && (
                <TouchableOpacity style={styles.clearIconButton} onPress={handleClearDestination}>
                  <Ionicons name="close-circle" size={18} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>

            {/* Auto-complete Suggestions Dropdown */}
            {showSuggestions && filteredLandmarks.length > 0 && (
              <View style={styles.suggestionsContainer}>
                <Text style={styles.suggestionsTitle}>Select Landmark:</Text>
                {filteredLandmarks.map((landmark) => (
                  <TouchableOpacity
                    key={landmark}
                    style={styles.suggestionItem}
                    onPress={() => handleSelectLandmark(landmark)}
                  >
                    <Ionicons name="location-outline" size={16} color={Colors.primary} />
                    <Text style={styles.suggestionText}>{landmark}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </ImageBackground>

        {/* Available Rides Section */}
        <View style={styles.listContainer}>
          
          {/* Filters Bar */}
          <View style={styles.filtersRow}>
            {/* Vehicle Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
              <TouchableOpacity
                style={[styles.chip, vehicleFilter === 'all' && styles.chipActive]}
                onPress={() => setVehicleFilter('all')}
              >
                <Text style={[styles.chipText, vehicleFilter === 'all' && styles.chipTextActive]}>All Rides</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, vehicleFilter === 'bike' && styles.chipActive]}
                onPress={() => setVehicleFilter('bike')}
              >
                <Ionicons name="bicycle" size={14} color={vehicleFilter === 'bike' ? '#FFF' : Colors.textPrimary} />
                <Text style={[styles.chipText, vehicleFilter === 'bike' && styles.chipTextActive]}>Bikes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, vehicleFilter === 'car' && styles.chipActive]}
                onPress={() => setVehicleFilter('car')}
              >
                <Ionicons name="car" size={14} color={vehicleFilter === 'car' ? '#FFF' : Colors.textPrimary} />
                <Text style={[styles.chipText, vehicleFilter === 'car' && styles.chipTextActive]}>Cars</Text>
              </TouchableOpacity>

              <View style={styles.filterDivider} />

              {/* Time Chips */}
              <TouchableOpacity
                style={[styles.chip, timeFilter === 'soon' && styles.chipActive]}
                onPress={() => setTimeFilter(timeFilter === 'soon' ? 'all' : 'soon')}
              >
                <Text style={[styles.chipText, timeFilter === 'soon' && styles.chipTextActive]}>⚡ Leaving Soon</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          <Text style={styles.sectionTitle}>
            Available Shared Rides ({filteredRides.length})
          </Text>

          <FlatList
            data={filteredRides}
            keyExtractor={(item) => item.id}
            renderItem={renderRideCard}
            contentContainerStyle={styles.listScroll}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="car-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No rides found</Text>
                <Text style={styles.emptySubtitle}>
                  Try selecting a different landmark or clearing search filters.
                </Text>
                {(selectedDestination || pickupQuery.length > 0) && (
                  <TouchableOpacity style={styles.resetButton} onPress={handleClearDestination}>
                    <Text style={styles.resetButtonText}>Clear Search</Text>
                  </TouchableOpacity>
                )}
              </View>
            }
          />
        </View>

        {/* Notifications Updates Modal */}
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
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
  },
  headerBackground: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  headerImageStyle: {
    resizeMode: 'cover',
    opacity: 0.95,
  },
  headerTextGroup: {
    marginBottom: 16,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  subWelcome: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
    marginTop: 2,
  },
  notifBellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  notifBadgeCircle: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: Colors.accent,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  searchCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  iconCircleBlue: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  iconCircleRed: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  inputField: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  clearIconButton: {
    padding: 2,
  },
  connectorLineContainer: {
    paddingLeft: 24,
    height: 12,
    justifyContent: 'center',
  },
  connectorDotLine: {
    width: 2,
    height: 10,
    backgroundColor: '#CBD5E1',
    borderRadius: 1,
  },
  suggestionsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginTop: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  suggestionsTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.textMuted,
    marginBottom: 6,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
    gap: 8,
  },
  suggestionText: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  filtersRow: {
    marginBottom: 16,
  },
  chipsScroll: {
    alignItems: 'center',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  chipTextActive: {
    color: '#FFF',
  },
  filterDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  listScroll: {
    paddingBottom: 120,
  },
  rideCard: {
    backgroundColor: Colors.background,
    paddingVertical: 16,
    paddingHorizontal: 4,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
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
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 3,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  vehicleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 4,
  },
  vehicleLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  routeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
    gap: 6,
  },
  routeText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  priceText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.accent,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginTop: 12,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  resetButton: {
    backgroundColor: Colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  resetButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.primary,
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
});
