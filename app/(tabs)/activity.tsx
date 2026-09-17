import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Image, Alert, Modal, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../../constants/Colors';
import { useApp, Booking, Ride } from '../../context/AppContext';
import { getBookingsApi, BookRideResponseData } from '../../services/bookingService';
import { getAllRidesApi, backendRideToLocal } from '../../services/rideService';

export default function ActivityScreen() {
  const { bookings, rides, user, updateRide, deleteRide } = useApp();
  const [activeSection, setActiveSection] = useState<'ongoing' | 'history' | 'my_offers'>('ongoing');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refresh bookings and rides from backend when the tab is focused
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        setIsRefreshing(true);
        try {
          const storedToken =
            (await AsyncStorage.getItem('@sarathi_token')) ||
            (await AsyncStorage.getItem('@sarathi_auth_token'));
          const storedRole = (await AsyncStorage.getItem('@sarathi_active_role')) || '';
          const bookingRole = storedRole === 'driver' ? 'RIDER' : 'PASSENGER';
          await getBookingsApi({ role: bookingRole }, storedToken ?? undefined);
          await getAllRidesApi(storedToken ?? undefined);
        } catch (err) {
          // ignore — stale data is better than error
        } finally {
          if (active) setIsRefreshing(false);
        }
      })();
      return () => { active = false; };
    }, [])
  );

  // Edit Ride Modal State
  const [editingRide, setEditingRide] = useState<Ride | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editSeats, setEditSeats] = useState('');
  const [editDepartureTime, setEditDepartureTime] = useState('');

  // Filter offered rides by this user (if driver/rider)
  const myOffers = rides.filter(r =>
    r.riderName === user?.name ||
    (user?.phone && r.phone === user?.phone) ||
    r.riderName === 'Sarathi Driver' ||
    user?.role === 'driver'
  );
  const myOfferIds = myOffers.map(o => o.id);

  // Group bookings based on user role (Passenger vs Driver)
  const isDriver = user?.role === 'driver';
  const ongoingBookings = isDriver
    ? bookings.filter(b => (b.status === 'pending' || b.status === 'accepted') && (myOfferIds.length === 0 || myOfferIds.includes(b.rideId)))
    : bookings.filter(b => b.status === 'pending' || b.status === 'accepted');

  const historyBookings = isDriver
    ? bookings.filter(b => (b.status === 'completed' || b.status === 'cancelled') && (myOfferIds.length === 0 || myOfferIds.includes(b.rideId)))
    : bookings.filter(b => b.status === 'completed' || b.status === 'cancelled');

  const handleBookingPress = (booking: Booking) => {
    if (booking.lifecycleState === 'request_pending') {
      router.push({ pathname: '/booking-status', params: { rideId: booking.rideId } });
    } else {
      router.push({ pathname: '/active-trip', params: { rideId: booking.rideId } });
    }
  };

  const handleOpenEditRide = (ride: Ride) => {
    setEditingRide(ride);
    setEditPrice(String(ride.price));
    setEditSeats(String(ride.seatsLeft));
    setEditDepartureTime(ride.departureTime || '');
  };

  const handleSaveEditRide = () => {
    if (!editingRide) return;
    const parsedPrice = parseFloat(editPrice);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price in NPR.');
      return;
    }
    const parsedSeats = parseInt(editSeats, 10);
    if (isNaN(parsedSeats) || parsedSeats < 0) {
      Alert.alert('Invalid Seats', 'Please enter valid seats.');
      return;
    }

    updateRide(editingRide.id, {
      price: parsedPrice,
      seatsLeft: parsedSeats,
      departureTime: editDepartureTime || 'Leaving soon',
    });

    setEditingRide(null);
    Alert.alert('Offer Updated', 'Your offered ride has been updated successfully.');
  };

  const handleDeleteOffer = (rideId: string) => {
    Alert.alert(
      'Delete Ride Offer',
      'Are you sure you want to cancel and remove this ride offer?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteRide(rideId);
            Alert.alert('Offer Removed', 'The ride offer was deleted.');
          },
        },
      ]
    );
  };

  const getStatusColor = (status: Booking['status']) => {
    switch (status) {
      case 'pending': return Colors.warning;
      case 'accepted': return Colors.success;
      case 'completed': return Colors.accent;
      case 'cancelled': return Colors.error;
      default: return Colors.textMuted;
    }
  };

  const renderBookingCard = (item: Booking) => {
    const ride = rides.find(r => r.id === item.rideId);
    if (!ride) return null;

    const isDriver = user?.role === 'driver';
    const titleName = isDriver ? item.passengerId.split('@')[0] : ride.riderName;
    const subText = isDriver ? `Passenger requesting to join` : `${ride.vehicleName} • ${ride.vehicleNumber}`;
    const avatarUrl = isDriver 
      ? 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&h=200&q=80'
      : ride.riderPhoto;

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.activityCard}
        onPress={() => !isDriver && handleBookingPress(item)}
        activeOpacity={isDriver ? 1.0 : 0.8}
      >
        <View style={styles.cardHeader}>
          <Image source={{ uri: avatarUrl }} style={styles.driverPhoto} />
          <View style={styles.driverInfo}>
            <Text style={styles.driverName}>{titleName}</Text>
            <Text style={styles.vehicleText}>{subText}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(item.status)}15` }]}>
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.routeContainer}>
          <Ionicons name="location-outline" size={16} color={Colors.textMuted} />
          <Text style={styles.routeText} numberOfLines={1}>
            {ride.route.join(' → ')}
          </Text>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.dateText}>
            {new Date(item.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </Text>
          <Text style={styles.priceText}>NPR {ride.price}</Text>
        </View>

        {!isDriver && (item.status === 'pending' || item.status === 'accepted') && (
          <View style={styles.trackingHint}>
            <Ionicons name="navigate-circle" size={16} color={Colors.accent} />
            <Text style={styles.trackingHintText}>
              {item.status === 'pending' ? 'View waiting queue' : 'Tap to track driver live'}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderOfferCard = (ride: Ride) => (
    <View key={ride.id} style={styles.offerCard}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.driverName} numberOfLines={1}>{ride.route.join(' → ')}</Text>
          <Text style={styles.vehicleText}>{ride.vehicleName} • {ride.seatsLeft} seat(s) left</Text>
        </View>
        <Text style={styles.priceText}>NPR {ride.price}</Text>
      </View>
      <Text style={styles.dateText}>Departure: {ride.departureTime}</Text>

      <View style={styles.offerActionsRow}>
        <TouchableOpacity style={styles.editBtn} onPress={() => handleOpenEditRide(ride)}>
          <Ionicons name="create-outline" size={16} color={Colors.primary} />
          <Text style={styles.editBtnText}>Edit Offer</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteOffer(ride.id)}>
          <Ionicons name="trash-outline" size={16} color="#DC2626" />
          <Text style={styles.deleteBtnText}>Delete Offer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.safeArea}>
      <View style={styles.container}>
        {/* Screen Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {user?.role === 'driver' ? 'Driver Activity & Rides' : 'Your Activity'}
          </Text>
        </View>

        {/* Tab Selector */}
        <View style={styles.tabSelector}>
          <TouchableOpacity
            style={styles.tabButton}
            onPress={() => setActiveSection('ongoing')}
          >
            <Text style={[styles.tabButtonText, activeSection === 'ongoing' && styles.tabButtonTextActive]}>
              Ongoing ({ongoingBookings.length})
            </Text>
            {activeSection === 'ongoing' && <View style={styles.activeTabIndicator} />}
          </TouchableOpacity>

          {(user?.role === 'driver' || myOffers.length > 0) && (
            <TouchableOpacity
              style={styles.tabButton}
              onPress={() => setActiveSection('my_offers')}
            >
              <Text style={[styles.tabButtonText, activeSection === 'my_offers' && styles.tabButtonTextActive]}>
                My Offers ({myOffers.length})
              </Text>
              {activeSection === 'my_offers' && <View style={styles.activeTabIndicator} />}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.tabButton}
            onPress={() => setActiveSection('history')}
          >
            <Text style={[styles.tabButtonText, activeSection === 'history' && styles.tabButtonTextActive]}>
              History ({historyBookings.length})
            </Text>
            {activeSection === 'history' && <View style={styles.activeTabIndicator} />}
          </TouchableOpacity>
        </View>

        {/* Activity List */}
        <ScrollView contentContainerStyle={styles.listScroll} showsVerticalScrollIndicator={false}>
          {activeSection === 'my_offers' ? (
            myOffers.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="car-sport-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No active ride offers</Text>
                <Text style={styles.emptySubtitle}>
                  You haven't posted any active ride offers yet. Publish a route offer from Home screen!
                </Text>
              </View>
            ) : (
              myOffers.map(renderOfferCard)
            )
          ) : activeSection === 'ongoing' ? (
            (ongoingBookings.length === 0 && myOffers.length === 0) ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="receipt-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No ongoing rides</Text>
                <Text style={styles.emptySubtitle}>
                  {user?.role === 'driver'
                    ? 'Incoming passenger ride requests and your active published rides will appear here.'
                    : 'Your active ride requests will be logged here.'}
                </Text>
              </View>
            ) : (
              <>
                {ongoingBookings.map(renderBookingCard)}
                {isDriver && ongoingBookings.length === 0 && myOffers.map(offer => (
                  <TouchableOpacity
                    key={`active-ride-${offer.id}`}
                    style={styles.activityCard}
                    onPress={() => router.push({ pathname: '/active-trip', params: { rideId: offer.id } })}
                    activeOpacity={0.85}
                  >
                    <View style={styles.cardHeader}>
                      <Image source={{ uri: offer.riderPhoto }} style={styles.driverPhoto} />
                      <View style={styles.driverInfo}>
                        <Text style={styles.driverName}>Active Published Route</Text>
                        <Text style={styles.vehicleText}>{offer.vehicleName} • {offer.vehicleNumber}</Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: `${Colors.success}15` }]}>
                        <Text style={[styles.statusText, { color: Colors.success }]}>LIVE</Text>
                      </View>
                    </View>

                    <View style={styles.routeContainer}>
                      <Ionicons name="location-outline" size={16} color={Colors.textMuted} />
                      <Text style={styles.routeText} numberOfLines={1}>
                        {offer.route.join(' → ')}
                      </Text>
                    </View>

                    <View style={styles.cardFooter}>
                      <Text style={styles.dateText}>{offer.departureTime}</Text>
                      <Text style={styles.priceText}>NPR {offer.price}/seat</Text>
                    </View>

                    <View style={styles.trackingHint}>
                      <Ionicons name="navigate-circle" size={16} color={Colors.accent} />
                      <Text style={styles.trackingHintText}>Tap to manage live trip & passenger requests</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )
          ) : (
            historyBookings.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="time-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No past rides</Text>
                <Text style={styles.emptySubtitle}>Completed and cancelled ride logs will be kept here.</Text>
              </View>
            ) : (
              historyBookings.map(renderBookingCard)
            )
          )}
        </ScrollView>

        {/* Edit Offered Ride Modal */}
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

              <Text style={styles.inputLabel}>Price / Seat (NPR)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Price per seat"
                value={editPrice}
                onChangeText={setEditPrice}
                keyboardType="numeric"
              />

              <Text style={styles.inputLabel}>Available Seats</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Available seats"
                value={editSeats}
                onChangeText={setEditSeats}
                keyboardType="numeric"
              />

              <Text style={styles.inputLabel}>Departure Time</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Departure time"
                value={editDepartureTime}
                onChangeText={setEditDepartureTime}
              />

              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveEditRide}>
                <Text style={styles.saveBtnText}>Save Offer Changes</Text>
              </TouchableOpacity>
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  tabSelector: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#4A5568',
  },
  tabButtonTextActive: {
    color: Colors.accent,
    fontWeight: '700',
  },
  activeTabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2.5,
    backgroundColor: Colors.accent,
  },
  listScroll: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  activityCard: {
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
    width: 40,
    height: 40,
    borderRadius: 20,
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
  vehicleText: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  routeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    gap: 6,
  },
  routeText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  priceText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.accent,
  },
  trackingHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 6,
  },
  trackingHintText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.accent,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  offerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  offerActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    justifyContent: 'flex-end',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
  },
  deleteBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
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
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 10,
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
