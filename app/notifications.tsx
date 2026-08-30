import React, { useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { useApp, DriverNotificationItem } from '../context/AppContext';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function NotificationsScreen() {
  const {
    driverNotifications,
    unreadDriverNotifCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    clearNotification,
  } = useApp();

  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'requests' | 'updates'>('all');

  const filteredNotifications = driverNotifications.filter((n) => {
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

  const renderItem = ({ item }: { item: DriverNotificationItem }) => (
    <TouchableOpacity
      style={[styles.notifCard, !item.isRead && styles.unreadNotifCard]}
      onPress={() => handleNotificationPress(item)}
      activeOpacity={0.8}
    >
      {!item.isRead && <View style={styles.unreadBlueBadge} />}

      <View style={[styles.iconContainer, { backgroundColor: `${item.iconColor}15` }]}>
        <Ionicons name={item.iconName as any} size={22} color={item.iconColor} />
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
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.headerTitle}>Driver Notifications</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
  },
  unreadNotifCard: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  unreadBlueBadge: {
    position: 'absolute',
    top: 14,
    left: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563EB',
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
    fontWeight: 'bold',
    color: '#1E3A8A',
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
