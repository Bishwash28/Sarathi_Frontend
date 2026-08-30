import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { useApp, Booking } from '../../context/AppContext';

export default function ActivityScreen() {
  const { bookings, rides, user } = useApp();
  const [activeSection, setActiveSection] = useState<'ongoing' | 'history'>('ongoing');

  // Filter offered rides by this user (if driver)
  const myOffers = rides.filter(r => r.riderName === user?.name);
  const myOfferIds = myOffers.map(o => o.id);

  // Group bookings based on user role (Passenger vs Driver)
  const ongoingBookings = user?.role === 'driver'
    ? bookings.filter(b => (b.status === 'pending' || b.status === 'accepted') && myOfferIds.includes(b.rideId))
    : bookings.filter(b => b.status === 'pending' || b.status === 'accepted');

  const historyBookings = user?.role === 'driver'
    ? bookings.filter(b => (b.status === 'completed' || b.status === 'cancelled') && myOfferIds.includes(b.rideId))
    : bookings.filter(b => b.status === 'completed' || b.status === 'cancelled');

  const handleBookingPress = (booking: Booking) => {
    if (booking.lifecycleState === 'request_pending') {
      router.push({ pathname: '/booking-status', params: { rideId: booking.rideId } });
    } else {
      router.push({ pathname: '/active-trip', params: { rideId: booking.rideId } });
    }
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

  const currentList = activeSection === 'ongoing' ? ongoingBookings : historyBookings;

  return (
    <View style={styles.safeArea}>
      <View style={styles.container}>
        {/* Screen Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {user?.role === 'driver' ? 'Driver Rides Logs' : 'Your Activity'}
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
          {currentList.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No {activeSection} rides</Text>
              <Text style={styles.emptySubtitle}>
                {user?.role === 'driver'
                  ? 'Your active and past hosted ride offers will appear here.'
                  : 'Your active and past completed bookings will be logged here.'}
              </Text>
            </View>
          ) : (
            currentList.map(renderBookingCard)
          )}
        </ScrollView>
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
});
