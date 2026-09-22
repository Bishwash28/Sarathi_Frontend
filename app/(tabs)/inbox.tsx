import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useApp } from '../../context/AppContext';

export default function InboxScreen() {
  const params = useLocalSearchParams<{ rideId?: string }>();
  const { rides, driverMessages, user, bookings, deletedChatRideIds, fetchUserConversations } = useApp();
  const [isLoading, setIsLoading] = useState(true);

  const isDriverMode = user?.role === 'driver';

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await fetchUserConversations();
      setIsLoading(false);
    })();
  }, [user?.id]);

  // Automatically navigate to dedicated chat-room if rideId param passed
  useEffect(() => {
    if (params.rideId) {
      router.push({ pathname: '/chat-room', params: { rideId: params.rideId } });
    }
  }, [params.rideId]);

  // Gather active chat threads strictly from DB driverMessages with messages (NO mock/empty threads)
  const allChatRideIds = Object.keys(driverMessages)
    .filter(id => driverMessages[id] && driverMessages[id].length > 0)
    .filter(rideId => !deletedChatRideIds.includes(rideId));

  const chatListItems = allChatRideIds
    .filter(rideId => {
      const msgs = driverMessages[rideId] || [];
      if (msgs.length === 0) return false;

      // Verify that logged-in user is an active participant in this specific conversation
      const isParticipant = msgs.some(
        m => (user?.id && (m.senderId === user.id || m.receiverId === user.id || m.passengerId === user.id || m.riderId === user.id))
      );

      return isParticipant;
    })
    .map(rideId => {
      const existingRide = rides.find(r => r.id === rideId);
      const booking = bookings.find(b => b.rideId === rideId);
      const msgs = driverMessages[rideId] || [];
      const lastMsg = msgs[msgs.length - 1];

      const passengerMsg = msgs.find(m => (m.sender === 'user' || m.passengerId) && m.senderId !== user?.id && m.senderName !== user?.name);
      const riderMsg = msgs.find(m => (m.sender === 'driver' || m.riderId) && m.senderId !== user?.id && m.senderName !== user?.name);

      const titleName = isDriverMode
        ? (booking?.passengerName || passengerMsg?.senderName || 'Passenger')
        : (existingRide?.riderName || riderMsg?.senderName || 'Driver');

      const photoUrl = isDriverMode
        ? (booking?.passengerPhoto || passengerMsg?.senderPhoto || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&h=200&q=80')
        : (existingRide?.riderPhoto || riderMsg?.senderPhoto || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&h=200&q=80');

      const routeSub = booking?.passengerPickup && booking?.passengerDropoff
        ? `${booking.passengerPickup} → ${booking.passengerDropoff}`
        : (existingRide ? existingRide.route.join(' → ') : 'Sarathi Trip');

      const unreadCount = msgs.filter(m => m.receiverId === user?.id && m.isRead === false).length;

      return {
        rideId,
        titleName,
        photoUrl,
        routeSub,
        lastMsg,
        unreadCount,
      };
    })
    .sort((a, b) => {
      const timeA = a.lastMsg ? new Date(a.lastMsg.timestamp).getTime() : 0;
      const timeB = b.lastMsg ? new Date(b.lastMsg.timestamp).getTime() : 0;
      return timeB - timeA;
    });

  return (
    <View style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Header Title */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {isDriverMode ? 'Passenger Messages' : 'Inbox & Messages'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {isDriverMode
              ? 'Connect directly with passengers requesting your published routes'
              : 'Chat directly with drivers and receive ride updates'}
          </Text>
        </View>

        {/* Driver / Passenger Chat List View */}
        <ScrollView contentContainerStyle={styles.chatListScroll} showsVerticalScrollIndicator={false}>
          {isLoading ? (
            <View style={styles.emptyChatsContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={[styles.emptyChatsTitle, { fontSize: 14, marginTop: 12 }]}>Loading conversations...</Text>
            </View>
          ) : chatListItems.length === 0 ? (
            <View style={styles.emptyChatsContainer}>
              <Ionicons name="chatbubbles-outline" size={48} color={Colors.primary} />
              <Text style={styles.emptyChatsTitle}>No conversations yet</Text>
              <Text style={styles.emptyChatsSub}>
                When you message a rider or passenger regarding a trip, your live conversations will appear here.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.subSectionTitle}>
                {isDriverMode ? 'Passenger Conversations:' : 'Driver Conversations:'}
              </Text>
              {chatListItems.map((item) => {
                const lastMsg = item.lastMsg;

                return (
                  <TouchableOpacity
                    key={item.rideId}
                    style={[styles.driverChatItem, item.unreadCount > 0 && styles.unreadChatItem]}
                    onPress={() => router.push({ pathname: '/chat-room', params: { rideId: item.rideId } })}
                    activeOpacity={0.8}
                  >
                    <Image source={{ uri: item.photoUrl }} style={styles.driverItemPhoto} />
                    <View style={styles.driverItemInfo}>
                      <View style={styles.driverItemHeader}>
                        <Text style={[styles.driverItemName, item.unreadCount > 0 && { color: Colors.primary, fontWeight: '800' }]}>
                          {item.titleName}
                        </Text>
                        {lastMsg && (
                          <Text style={[styles.driverItemTime, item.unreadCount > 0 && { color: Colors.primary, fontWeight: '700' }]}>
                            {new Date(lastMsg.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Text>
                        )}
                      </View>
                      <Text style={styles.driverItemSub}>
                        {item.routeSub}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={[styles.driverLastMsg, item.unreadCount > 0 && { color: Colors.textPrimary, fontWeight: '700' }]} numberOfLines={1}>
                          {lastMsg ? lastMsg.text : 'Tap to view conversation'}
                        </Text>
                        {item.unreadCount > 0 && (
                          <View style={styles.unreadBadgeContainer}>
                            <Text style={styles.unreadBadgeText}>{item.unreadCount}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                );
              })}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  chatListScroll: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingBottom: 120,
  },
  emptyChatsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyChatsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginTop: 12,
    marginBottom: 6,
  },
  emptyChatsSub: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  subSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  driverChatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  unreadChatItem: {
    borderColor: Colors.primary,
    backgroundColor: '#EFF6FF',
  },
  unreadBadgeContainer: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginLeft: 6,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  driverItemPhoto: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  driverItemInfo: {
    flex: 1,
    marginRight: 8,
  },
  driverItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  driverItemName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  driverItemTime: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  driverItemSub: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  driverLastMsg: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
    fontWeight: '500',
  },
});
