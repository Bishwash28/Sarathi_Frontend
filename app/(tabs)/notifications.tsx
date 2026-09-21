import React, { useState } from 'react';
import {
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
    user,
  } = useApp();

  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'requests' | 'updates'>('all');

  const isDriverMode = user?.role === 'driver' || user?.kycVerified === true;
  const currentRole = isDriverMode ? 'driver' : 'passenger';

  const filteredNotifications = driverNotifications.filter((n) => {
    if (n.targetRole && n.targetRole !== currentRole) {
      // Allow ride_request notifications to be visible to riders even if active mode is passenger
      if (n.type === 'ride_request' && isDriverMode) {
        // Allow through
      } else {
        return false;
      }
    }
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
    Alert.alert('Ride Request Accepted! 🎉', 'You have accepted the passenger request. Navigate to Active Trip to view status.');
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

    return (
      <View style={[styles.notifCard, !item.isRead && styles.unreadNotifCard]}>
        {!item.isRead && <View style={styles.unreadBlueBadge} />}

        <View style={styles.cardMainHeader}>
          <View style={[styles.iconContainer, { backgroundColor: `${item.iconColor}15` }]}>
            <Ionicons name={item.iconName as any} size={22} color={item.iconColor} />
          </View>

          <View style={styles.textContainer}>
            <View style={styles.titleRow}>
              <Text style={[styles.notifTitle, !item.isRead && styles.unreadTitle]}>{item.title}</Text>
              <Text style={styles.timestampText}>{formatTimeAgo(item.timestamp)}</Text>
            </View>
            <Text style={styles.notifDesc} numberOfLines={3}>
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

        {/* Detailed Passenger Request Card (Shown for ride_request notifications) */}
        {isRideReq && (
          <View style={styles.passengerDetailsCard}>
            <View style={styles.passengerProfileRow}>
              <Image
                source={{ uri: params.passengerPhoto || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&h=200&q=80' }}
                style={styles.passengerAvatarImg}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.passengerNameText}>{params.passengerName || 'Sarathi Passenger'}</Text>
                <Text style={styles.passengerPhoneText}>{params.passengerPhone || '+977 9841234567'}</Text>
              </View>
              <TouchableOpacity
                style={styles.callPassBtn}
                onPress={() => handleCallPassenger(params.passengerPhone)}
                activeOpacity={0.8}
              >
                <Ionicons name="call" size={14} color="#16A34A" />
                <Text style={styles.callPassBtnText}>Call</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.routePointsBox}>
              <Text style={styles.routePointItem}>
                📍 Pickup: <Text style={{ fontWeight: '800', color: Colors.textPrimary }}>{params.passengerPickup || 'Pickup Point'}</Text>
              </Text>
              <Text style={styles.routePointItem}>
                🏁 Drop-off: <Text style={{ fontWeight: '800', color: Colors.textPrimary }}>{params.passengerDropoff || 'Destination Point'}</Text>
              </Text>
            </View>

            <View style={styles.actionButtonsRow}>
              <TouchableOpacity
                style={styles.acceptBtn}
                onPress={() => handleAcceptRequest(params.bookingId, item.id)}
                activeOpacity={0.85}
              >
                <Ionicons name="checkmark-circle" size={16} color="#FFF" />
                <Text style={styles.acceptBtnText}>Accept Request</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.declineBtn}
                onPress={() => clearNotification(item.id)}
                activeOpacity={0.85}
              >
                <Text style={styles.declineBtnText}>Decline</Text>
              </TouchableOpacity>
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
          {unreadDriverNotifCount > 0 && (
            <View style={styles.unreadCountBadge}>
              <Text style={styles.unreadCountText}>{unreadDriverNotifCount} New</Text>
            </View>
          )}
        </View>
        {unreadDriverNotifCount > 0 ? (
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
            All ({driverNotifications.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterChip, activeFilter === 'unread' && styles.activeFilterChip]}
          onPress={() => setActiveFilter('unread')}
        >
          <Text style={[styles.filterChipText, activeFilter === 'unread' && styles.activeFilterChipText]}>
            Unread ({unreadDriverNotifCount})
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
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No Notifications</Text>
            <Text style={styles.emptySubtitle}>You are all caught up! New passenger ride requests will appear here.</Text>
          </View>
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
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  acceptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#16A34A',
    paddingVertical: 10,
    borderRadius: 10,
  },
  acceptBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  declineBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineBtnText: {
    color: Colors.textMuted,
    fontSize: 13,
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
});
