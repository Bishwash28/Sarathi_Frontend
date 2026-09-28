import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '../../constants/Colors';
import { DriverNotificationItem, useApp } from '../../context/AppContext';

export default function NotificationsScreen() {
  const {
    driverNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    clearNotification,
    acceptBooking,
    declineBooking,
    bookings,
    rides,
    user,
  } = useApp();

  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'requests' | 'updates'>('all');
  const [isLoading, setIsLoading] = useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 300);
    return () => clearTimeout(timer);
  }, []);

  const isDriverMode = user?.role === 'driver' || user?.kycVerified === true;
  const currentRole = isDriverMode ? 'driver' : 'passenger';

  const userRoleNotifications = driverNotifications.filter((n) => {
    if (n.targetRole && n.targetRole !== currentRole) {
      if (n.type === 'ride_request' && isDriverMode) {
        return true;
      }
      return false;
    }
    return true;
  });

  const deduplicateNotifications = (list: DriverNotificationItem[]) => {
    const seenBookingIds = new Set<string>();
    const deduplicated: DriverNotificationItem[] = [];

    for (const notif of list) {
      const bId = notif.targetParams?.bookingId;
      if (bId) {
        if (seenBookingIds.has(bId)) {
          continue;
        }
        seenBookingIds.add(bId);
      }
      deduplicated.push(notif);
    }

    return deduplicated;
  };

  const allRoleNotifications = deduplicateNotifications(userRoleNotifications);
  const unreadCount = allRoleNotifications.filter((n) => !n.isRead).length;

  const filteredNotifications = allRoleNotifications.filter((n) => {
    if (activeFilter === 'unread') return !n.isRead;
    if (activeFilter === 'requests') return n.type === 'ride_request' || n.type === 'request_status';
    if (activeFilter === 'updates') return n.type === 'kyc' || n.type === 'announcement' || n.type === 'payment';
    return true;
  });

  const handleNotificationPress = (item: DriverNotificationItem) => {
    markNotificationAsRead(item.id);
    if (item.targetScreen) {
      router.push({
        pathname: item.targetScreen as any,
        params: item.targetParams,
      });
    }
  };

  const handleAcceptRequest = (bookingId?: string, notifId?: string) => {
    if (bookingId) {
      acceptBooking(bookingId);
    }
    if (notifId) {
      markNotificationAsRead(notifId);
    }
    const booking = bookings.find(b => b.id === bookingId);
    router.replace({
      pathname: '/active-trip',
      params: { rideId: booking?.rideId, bookingId }
    });
  };

  const handleDeclineRequest = (bookingId?: string, notifId?: string) => {
    if (bookingId) {
      declineBooking(bookingId);
    }
    if (notifId) {
      markNotificationAsRead(notifId);
    }
    Alert.alert('Request Declined ✕', 'You have declined this passenger request.');
  };

  const handleCallPassenger = (phone?: string) => {
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    } else {
      Alert.alert('No Phone', 'Passenger phone number is unavailable.');
    }
  };

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const renderItem = ({ item }: { item: DriverNotificationItem }) => {
    const isRideReq = item.type === 'ride_request' || item.type === 'request_status';
    const params = item.targetParams || {};
    const booking = bookings.find(b => b.id === params.bookingId);
    const ride = rides.find(r => r.id === (params.rideId || booking?.rideId));

    if (booking && user?.id) {
      const belongsToMe = isDriverMode
        ? booking.driverId === user.id
        : (booking.passengerId === user.id || booking.passengerId === user.email);
      if (!belongsToMe) return null;
    }

    const passengerName = params.passengerName || booking?.passengerName || 'User';
    const passengerPhoto = params.passengerPhoto || booking?.passengerPhoto || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&h=200&q=80';
    const passengerPhone = params.passengerPhone || booking?.passengerPhone || '';
    const passengerRating = params.passengerRating || '0';

    const pickupName = params.passengerPickup || booking?.passengerPickup || 'Sunwal Chowk';
    const dropName = params.passengerDropoff || booking?.passengerDropoff || 'Bhumahi Hwy';
    const fareAmount = params.fareAmount || booking?.farePrice || (ride?.price ? ride.price : 180);
    const distanceKm = params.distanceKm || '2.1';

    const bookingId = params.bookingId || booking?.id;
    const rideId = params.rideId || booking?.rideId;

    // Determine current booking/request card state
    const rawStatus = (booking?.status || params.status || (item.type === 'ride_request' ? 'pending' : '')).toLowerCase();

    // Check if declined by driver
    const isDeclinedByRider =
      booking?.cancelledBy === 'rider' ||
      params.rejectedBy === 'rider' ||
      item.title?.toLowerCase().includes('declined') ||
      item.title?.toLowerCase().includes('rejected') ||
      item.description?.toLowerCase().includes('declined');

    const handleMessagePassenger = () => {
      const targetRideId = rideId;
      if (targetRideId) {
        router.push({ pathname: '/chat-room', params: { rideId: targetRideId } });
      } else {
        Alert.alert('Chat Unavailable', 'Chat room is not accessible for this notification.');
      }
    };

    // If notification is a ride request or status update card, render custom role card states matching design
    if (isRideReq || booking) {
      // STATE 1: INCOMING REQUEST (Pending)
      if (rawStatus === 'pending') {
        return (
          <View style={styles.incomingCard}>
            {/* Header Row */}
            <View style={styles.cardHeaderRow}>
              <View style={styles.avatarWrapper}>
                <Image source={{ uri: passengerPhoto }} style={styles.avatarImg} />
                <View style={styles.onlineDot} />
              </View>

              <View style={styles.passengerHeaderMeta}>
                <View style={styles.nameRatingRow}>
                  <Text style={styles.passengerNameText} numberOfLines={1}>{passengerName}</Text>
                  <View style={styles.ratingBadge}>
                    <Text style={styles.ratingBadgeStar}>★</Text>
                    <Text style={styles.ratingBadgeText}>{passengerRating}</Text>
                  </View>
                  <Text style={styles.timeAgoText}>• {formatTimeAgo(item.timestamp)}</Text>
                </View>
              </View>

              <View style={styles.pricePillGreen}>
                <Text style={styles.pricePillGreenText}>Rs. {fareAmount}</Text>
              </View>
            </View>

            {/* Route Box */}
            <View style={styles.routeBoxPill}>
              <View style={styles.routePillLeft}>
                <View style={styles.greenDotDot} />
                <Text style={styles.routePillPointText} numberOfLines={1}>{pickupName}</Text>
                <Text style={styles.routePillArrow}>→</Text>
                <View style={styles.redDotDot} />
                <Text style={styles.routePillPointText} numberOfLines={1}>{dropName}</Text>
              </View>
              {distanceKm ? (
                <Text style={styles.routeDistanceText}>{distanceKm} km</Text>
              ) : null}
            </View>

            {/* Actions Row */}
            <View style={styles.cardActionsRow}>
              <TouchableOpacity
                style={styles.iconSquareBtn}
                onPress={() => handleCallPassenger(passengerPhone)}
                activeOpacity={0.8}
              >
                <Ionicons name="call" size={18} color="#334155" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.declineBtnLight}
                onPress={() => handleDeclineRequest(bookingId, item.id)}
                activeOpacity={0.85}
              >
                <Text style={styles.declineBtnLightText}>Decline</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.acceptBtnEmerald}
                onPress={() => handleAcceptRequest(bookingId, item.id)}
                activeOpacity={0.85}
              >
                <Text style={styles.acceptBtnEmeraldText}>Accept Request</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      }

      // STATE 2: ACCEPTED / IN PROGRESS
      if (rawStatus === 'accepted' || rawStatus === 'ongoing') {
        return (
          <View style={styles.acceptedCard}>
            {/* Header Row */}
            <View style={styles.cardHeaderRow}>
              <View style={styles.avatarWrapper}>
                <Image source={{ uri: passengerPhoto }} style={styles.avatarImg} />
                <View style={styles.onlineDot} />
              </View>

              <View style={styles.passengerHeaderMeta}>
                <View style={styles.nameRatingRow}>
                  <Text style={styles.passengerNameText} numberOfLines={1}>{passengerName}</Text>
                  <View style={styles.acceptedBadge}>
                    <Text style={styles.acceptedBadgeText}>Accepted</Text>
                  </View>
                </View>
                <Text style={styles.pickupSubtext} numberOfLines={1}>
                  Pickup in 6m • {pickupName}
                </Text>
              </View>

              <View style={styles.pricePillNeutral}>
                <Text style={styles.pricePillNeutralText}>Rs. {fareAmount}</Text>
              </View>
            </View>

            {/* Actions Row */}
            <View style={styles.cardActionsRow}>
              <TouchableOpacity
                style={styles.iconSquareBtn}
                onPress={() => handleCallPassenger(passengerPhone)}
                activeOpacity={0.8}
              >
                <Ionicons name="call" size={18} color="#334155" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.iconSquareBtn}
                onPress={handleMessagePassenger}
                activeOpacity={0.8}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={18} color="#334155" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.startNavBtnDark}
                onPress={() => router.push({ pathname: '/active-trip', params: { rideId, bookingId } })}
                activeOpacity={0.85}
              >
                <Ionicons name="navigate" size={16} color="#FFF" />
                <Text style={styles.startNavBtnDarkText}>Start Navigation</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      }

      // STATE 4: DECLINED / REJECTED BY YOU
      if (isDeclinedByRider) {
        return (
          <View style={styles.declinedCard}>
            <View style={styles.statusIconCircleGrey}>
              <Ionicons name="close-circle-outline" size={18} color="#94A3B8" />
            </View>

            <View style={styles.cardContentCol}>
              <View style={styles.nameBadgeRow}>
                <Text style={styles.passengerNameText} numberOfLines={1}>{passengerName}</Text>
                <View style={styles.declinedBadgeOrange}>
                  <Text style={styles.declinedBadgeOrangeText}>Declined by You</Text>
                </View>
              </View>

              <Text style={styles.routeTimeSubtext} numberOfLines={1}>
                {pickupName} to {dropName} • {formatTimeAgo(item.timestamp)}
              </Text>
            </View>

            <View style={styles.rightSideCol}>
              <Text style={styles.strikethroughPriceText}>Rs. {fareAmount}</Text>
              <TouchableOpacity
                onPress={() => clearNotification(item.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.dismissBtnText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      }

      // STATE 3: CANCELLED BY PASSENGER
      if (rawStatus === 'cancelled') {
        return (
          <View style={styles.cancelledCard}>
            <View style={styles.statusIconCircleRed}>
              <Ionicons name="close" size={18} color="#EF4444" />
            </View>

            <View style={styles.cardContentCol}>
              <View style={styles.nameBadgeRow}>
                <Text style={styles.passengerNameText} numberOfLines={1}>{passengerName}</Text>
                <View style={styles.cancelledBadgeRed}>
                  <Text style={styles.cancelledBadgeRedText}>Cancelled by Passenger</Text>
                </View>
              </View>

              <Text style={styles.routeTimeSubtext} numberOfLines={1}>
                {pickupName} to {dropName} • {formatTimeAgo(item.timestamp)}
              </Text>
            </View>

            <View style={styles.rightSideCol}>
              <Text style={styles.strikethroughPriceText}>Rs. {fareAmount}</Text>
              <TouchableOpacity
                onPress={() => clearNotification(item.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.dismissBtnText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      }

      // STATE 5: COMPLETED
      if (rawStatus === 'completed') {
        const titleText = isDriverMode ? `${passengerName} has completed the ride` : 'Your ride is completed';
        const displayPhoto = isDriverMode ? passengerPhoto : (ride?.riderPhoto || passengerPhoto);

        return (
          <View style={styles.completedCard}>
            <View style={styles.avatarWrapper}>
              <Image source={{ uri: displayPhoto }} style={styles.avatarImg} />
              <View style={[styles.statusCheckBadge, { backgroundColor: '#16A34A' }]}>
                <Ionicons name="checkmark" size={10} color="#FFF" />
              </View>
            </View>

            <View style={styles.cardContentCol}>
              <View style={styles.nameBadgeRow}>
                <Text style={styles.passengerNameText} numberOfLines={1}>{titleText}</Text>
                <View style={styles.completedBadgeGreen}>
                  <Text style={styles.completedBadgeGreenText}>Completed</Text>
                </View>
              </View>

              <Text style={styles.routeTimeSubtext} numberOfLines={1}>
                {pickupName} to {dropName}
              </Text>
            </View>
          </View>
        );
      }
    }

    // FALLBACK: Generic notification card for non-request alerts
    return (
      <TouchableOpacity
        style={[styles.genericCard, !item.isRead && styles.unreadGenericCard]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.88}
      >
        {!item.isRead && <View style={styles.unreadBlueBadge} />}
        <View style={[styles.genericIconContainer, { backgroundColor: `${item.iconColor}15` }]}>
          <Ionicons name={item.iconName as any} size={20} color={item.iconColor} />
        </View>

        <View style={styles.genericTextCol}>
          <View style={styles.genericTitleRow}>
            <Text style={[styles.genericTitle, !item.isRead && styles.unreadGenericTitle]}>
              {item.title}
            </Text>
            <Text style={styles.genericTimeText}>{formatTimeAgo(item.timestamp)}</Text>
          </View>
          <Text style={styles.genericDesc} numberOfLines={2}>
            {item.description}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => clearNotification(item.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="trash-outline" size={16} color={Colors.textMuted} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadCountBadge}>
              <Text style={styles.unreadCountText}>{unreadCount} New</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={markAllNotificationsAsRead}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, activeFilter === 'all' && styles.activeFilterChip]}
          onPress={() => setActiveFilter('all')}
        >
          <Text style={[styles.filterChipText, activeFilter === 'all' && styles.activeFilterChipText]}>
            All ({allRoleNotifications.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterChip, activeFilter === 'unread' && styles.activeFilterChip]}
          onPress={() => setActiveFilter('unread')}
        >
          <Text style={[styles.filterChipText, activeFilter === 'unread' && styles.activeFilterChipText]}>
            Unread ({unreadCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterChip, activeFilter === 'requests' && styles.activeFilterChip]}
          onPress={() => setActiveFilter('requests')}
        >
          <Text style={[styles.filterChipText, activeFilter === 'requests' && styles.activeFilterChipText]}>
            Ride Requests
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterChip, activeFilter === 'updates' && styles.activeFilterChip]}
          onPress={() => setActiveFilter('updates')}
        >
          <Text style={[styles.filterChipText, activeFilter === 'updates' && styles.activeFilterChipText]}>
            Updates
          </Text>
        </TouchableOpacity>
      </View>

      {/* Notification List */}
      <FlatList
        data={filteredNotifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={[styles.emptyTitle, { fontSize: 14 }]}>Loading notifications...</Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No Notifications</Text>
              <Text style={styles.emptySubtitle}>You are all caught up! New passenger ride requests will appear here.</Text>
            </View>
          )
        }
      />
    </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  unreadCountBadge: {
    backgroundColor: '#DC2626',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  unreadCountText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  markAllText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  activeFilterChip: {
    backgroundColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  activeFilterChipText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  listContent: {
    padding: 14,
    gap: 12,
  },

  // ── COMMON CARD BASE STYLES ──
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 10,
  },
  avatarImg: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  statusCheckBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  passengerHeaderMeta: {
    flex: 1,
  },
  nameRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  passengerNameText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  ratingBadgeStar: {
    fontSize: 10,
    color: '#F59E0B',
  },
  ratingBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#D97706',
  },
  timeAgoText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },

  // ── STATE 1: INCOMING REQUEST CARD ──
  incomingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  pricePillGreen: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  pricePillGreenText: {
    color: '#059669',
    fontSize: 14,
    fontWeight: '800',
  },
  routeBoxPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  routePillLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  greenDotDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  redDotDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#EF4444',
  },
  routePillPointText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  routePillArrow: {
    fontSize: 11,
    color: '#94A3B8',
  },
  routeDistanceText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconSquareBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineBtnLight: {
    paddingHorizontal: 18,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineBtnLightText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  acceptBtnEmerald: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtnEmeraldText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },

  // ── STATE 2: ACCEPTED CARD ──
  acceptedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#D1FAE5',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  acceptedBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  acceptedBadgeText: {
    color: '#059669',
    fontSize: 10,
    fontWeight: 'bold',
  },
  pickupSubtext: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
    marginTop: 2,
  },
  pricePillNeutral: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  pricePillNeutralText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: 'bold',
  },
  startNavBtnDark: {
    flex: 1,
    flexDirection: 'row',
    height: 38,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  startNavBtnDarkText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },

  // ── STATE 3: CANCELLED BY PASSENGER CARD ──
  cancelledCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  statusIconCircleRed: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cancelledBadgeRed: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cancelledBadgeRedText: {
    color: '#DC2626',
    fontSize: 10,
    fontWeight: 'bold',
  },

  // ── STATE 4: DECLINED BY YOU CARD ──
  declinedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusIconCircleGrey: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  declinedBadgeOrange: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  declinedBadgeOrangeText: {
    color: '#D97706',
    fontSize: 10,
    fontWeight: 'bold',
  },

  // ── STATE 5: COMPLETED CARD ──
  completedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  statusIconCircleGreen: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  completedBadgeGreen: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  completedBadgeGreenText: {
    color: '#059669',
    fontSize: 10,
    fontWeight: 'bold',
  },
  pricePillCompleted: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pricePillCompletedText: {
    color: '#059669',
    fontSize: 13,
    fontWeight: '800',
  },

  // ── SHARED COMPACT CARD ELEMENTS ──
  cardContentCol: {
    flex: 1,
    marginRight: 8,
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  routeTimeSubtext: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 3,
    fontWeight: '500',
  },
  rightSideCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
  },
  strikethroughPriceText: {
    fontSize: 12,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
    fontWeight: '600',
  },
  dismissBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },

  // ── GENERIC NOTIFICATION CARD ──
  genericCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
  },
  unreadGenericCard: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
  },
  unreadBlueBadge: {
    position: 'absolute',
    top: 12,
    left: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  genericIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  genericTextCol: {
    flex: 1,
  },
  genericTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  genericTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  unreadGenericTitle: {
    fontWeight: '800',
    color: Colors.primary,
  },
  genericTimeText: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  genericDesc: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  deleteButton: {
    padding: 6,
    marginLeft: 6,
  },

  // ── EMPTY STATE ──
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
});
