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
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useApp, DriverNotificationItem } from '../../context/AppContext';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function NotificationsScreen() {
  const {
    driverNotifications,
    unreadDriverNotifCount,
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

  const unreadCount = userRoleNotifications.filter((n) => !n.isRead).length;

  const filteredNotifications = userRoleNotifications.filter((n) => {
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
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    return `${days} days ago`;
  };

  const renderItem = ({ item }: { item: DriverNotificationItem }) => {
    const isRideReq = item.type === 'ride_request';
    const params = item.targetParams || {};
    const booking = bookings.find(b => b.id === params.bookingId);
    const ride = rides.find(r => r.id === (params.rideId || booking?.rideId));

    // Ownership & Authorization check: Is current user the driver owner of this ride offer?
    const isRiderOwner = Boolean(
      user?.role === 'driver' &&
      ((ride?.riderId && user?.id && ride.riderId === user.id) ||
       (ride?.riderName && user?.name && ride.riderName === user.name) ||
       (ride?.phone && user?.phone && ride.phone === user.phone))
    );

    const bookingStatus = booking?.status || 'pending';
    const isPending = bookingStatus === 'pending';

    const handleMessagePassenger = () => {
      const targetRideId = params.rideId || booking?.rideId;
      if (targetRideId) {
        router.push({ pathname: '/chat-room', params: { rideId: targetRideId } });
      } else {
        Alert.alert('Chat Unavailable', 'Chat room is not accessible for this notification.');
      }
    };

    return (
      <View style={[styles.notifCard, !item.isRead && styles.unreadNotifCard]}>
        {!item.isRead && <View style={styles.unreadBlueBadge} />}

        <View style={styles.cardMainHeader}>
          <View style={[styles.iconContainer, { backgroundColor: `${item.iconColor}15` }]}>
            <Ionicons name={item.iconName as any} size={20} color={item.iconColor} />
          </View>

          <View style={styles.textContainer}>
            <View style={styles.titleRow}>
              <Text style={[styles.notifTitle, !item.isRead && styles.unreadTitle]}>{item.title}</Text>
              <Text style={styles.timestampText}>{formatTimeAgo(item.timestamp)}</Text>
            </View>
            <Text style={styles.notifDesc} numberOfLines={2}>
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
        </View>

        {/* Compact Passenger Request Details & Action Grid */}
        {isRideReq && (
          <View style={styles.passengerDetailsCard}>
            <View style={styles.passengerProfileRow}>
              <Image
                source={{ uri: params.passengerPhoto || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&h=200&q=80' }}
                style={styles.passengerAvatarImg}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.passengerNameText}>{params.passengerName || 'Sarathi Passenger'}</Text>
                <Text style={styles.routePointItem}>
                  📍 <Text style={{ fontWeight: '700', color: Colors.textPrimary }}>{params.passengerPickup || 'Pickup'}</Text> → <Text style={{ fontWeight: '700', color: Colors.textPrimary }}>{params.passengerDropoff || 'Drop-off'}</Text>
                </Text>
              </View>
            </View>

            {/* Quick Action Grid: Call, Message, Accept, Decline */}
            <View style={styles.actionGridContainer}>
              <View style={styles.contactRow}>
                <TouchableOpacity
                  style={styles.contactBtn}
                  onPress={() => handleCallPassenger(params.passengerPhone)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="call-outline" size={14} color="#15803D" />
                  <Text style={styles.contactBtnText}>Call</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.contactBtn, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}
                  onPress={handleMessagePassenger}
                  activeOpacity={0.8}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={14} color="#1D4ED8" />
                  <Text style={[styles.contactBtnText, { color: '#1D4ED8' }]}>Message</Text>
                </TouchableOpacity>
              </View>

              {isRiderOwner && isPending ? (
                <View style={styles.actionButtonsRow}>
                  <TouchableOpacity
                    style={styles.acceptBtn}
                    onPress={() => handleAcceptRequest(params.bookingId, item.id)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="checkmark-circle" size={15} color="#FFF" />
                    <Text style={styles.acceptBtnText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.declineBtn}
                    onPress={() => handleDeclineRequest(params.bookingId, item.id)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="close-circle-outline" size={15} color="#DC2626" />
                    <Text style={styles.declineBtnText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center' }}>
                  <View
                    style={[
                      styles.statusChip,
                      bookingStatus === 'accepted'
                        ? { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' }
                        : bookingStatus === 'ongoing'
                        ? { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }
                        : bookingStatus === 'completed'
                        ? { backgroundColor: '#F3E8FF', borderColor: '#D8B4FE' }
                        : bookingStatus === 'cancelled'
                        ? { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }
                        : { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' },
                    ]}
                  >
                    <Ionicons
                      name={
                        bookingStatus === 'accepted' || bookingStatus === 'ongoing' || bookingStatus === 'completed'
                          ? 'checkmark-circle'
                          : bookingStatus === 'cancelled'
                          ? 'close-circle'
                          : 'time-outline'
                      }
                      size={13}
                      color={
                        bookingStatus === 'accepted'
                          ? '#16A34A'
                          : bookingStatus === 'ongoing'
                          ? '#2563EB'
                          : bookingStatus === 'completed'
                          ? '#7C3AED'
                          : bookingStatus === 'cancelled'
                          ? '#DC2626'
                          : '#D97706'
                      }
                    />
                    <Text
                      style={[
                        styles.statusChipText,
                        {
                          color:
                            bookingStatus === 'accepted'
                              ? '#15803D'
                              : bookingStatus === 'ongoing'
                              ? '#1D4ED8'
                              : bookingStatus === 'completed'
                              ? '#6B21A8'
                              : bookingStatus === 'cancelled'
                              ? '#B91C1C'
                              : '#B45309',
                        },
                      ]}
                    >
                      {bookingStatus === 'accepted'
                        ? 'ACCEPTED'
                        : bookingStatus === 'ongoing'
                        ? 'IN PROGRESS'
                        : bookingStatus === 'completed'
                        ? 'COMPLETED'
                        : bookingStatus === 'cancelled'
                        ? 'REJECTED'
                        : 'PENDING'}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
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
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, activeFilter === 'all' && styles.activeFilterChip]}
          onPress={() => setActiveFilter('all')}
        >
          <Text style={[styles.filterChipText, activeFilter === 'all' && styles.activeFilterChipText]}>
            All ({userRoleNotifications.length})
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    padding: 6,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
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
    padding: 16,
    gap: 10,
  },
  notifCard: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  cardMainHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
  },
  unreadNotifCard: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
  },
  unreadBlueBadge: {
    position: 'absolute',
    top: 14,
    left: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  unreadTitle: {
    fontWeight: '800',
    color: Colors.primary,
  },
  timestampText: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  notifDesc: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 16,
  },
  deleteButton: {
    padding: 6,
    marginLeft: 6,
  },
  passengerDetailsCard: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    width: '100%',
  },
  passengerProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  passengerAvatarImg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  passengerNameText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  passengerPhoneText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  callPassBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  callPassBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#15803D',
  },
  routePointsBox: {
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
    marginBottom: 12,
  },
  routePointItem: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  actionGridContainer: {
    gap: 8,
    marginTop: 8,
  },
  contactRow: {
    flexDirection: 'row',
    gap: 8,
  },
  contactBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#DCFCE7',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  contactBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#15803D',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#16A34A',
    paddingVertical: 8,
    borderRadius: 8,
  },
  acceptBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  declineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  declineBtnText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: 'bold',
  },
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
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
