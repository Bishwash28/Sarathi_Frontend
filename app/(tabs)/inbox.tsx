import React, { useEffect } from 'react';
import {
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
  const { rides, driverMessages, activeChatRideIds, user, bookings } = useApp();

  const isDriverMode = user?.role === 'driver';

  // Automatically navigate to dedicated chat-room if rideId param passed
  useEffect(() => {
    if (params.rideId) {
      router.push({ pathname: '/chat-room', params: { rideId: params.rideId } });
    }
  }, [params.rideId]);

  // Gather all active chat threads from activeChatRideIds, driverMessages keys, and bookings
  const allChatRideIds = Array.from(new Set([
    ...activeChatRideIds,
    ...Object.keys(driverMessages).filter(id => driverMessages[id] && driverMessages[id].length > 0),
    ...bookings.map(b => b.rideId).filter(Boolean)
  ]));

  const chatListItems = allChatRideIds
    .filter(rideId => {
      const existingRide = rides.find(r => r.id === rideId);
      const msgs = driverMessages[rideId] || [];
      const isRiderOfRide = (existingRide?.riderId && user?.id && existingRide.riderId === user.id) ||
                            (existingRide?.riderName && user?.name && existingRide.riderName === user.name) ||
                            (existingRide?.phone && user?.phone && existingRide.phone === user.phone) ||
                            (msgs.some(m => m.riderId && user?.id && m.riderId === user.id));

      return isDriverMode ? isRiderOfRide : !isRiderOfRide;
    })
    .map(rideId => {
      const existingRide = rides.find(r => r.id === rideId);
      const booking = bookings.find(b => b.rideId === rideId);
      const msgs = driverMessages[rideId] || [];
      const lastMsg = msgs[msgs.length - 1];

      const passengerMsg = msgs.find(m => (m.sender === 'user' || m.passengerId) && m.senderId !== user?.id && m.senderName !== user?.name);
      const riderMsg = msgs.find(m => (m.sender === 'driver' || m.riderId) && m.senderId !== user?.id && m.senderName !== user?.name);

      const titleName = isDriverMode
        ? (booking?.passengerName || passengerMsg?.senderName || 'Passenger Inquirer')
        : (existingRide?.riderName || riderMsg?.senderName || 'Sarathi Rider');

      const photoUrl = isDriverMode
        ? (booking?.passengerPhoto || passengerMsg?.senderPhoto || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&h=200&q=80')
        : (existingRide?.riderPhoto || riderMsg?.senderPhoto || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&h=200&q=80');

      const routeSub = booking?.passengerPickup && booking?.passengerDropoff
        ? `${booking.passengerPickup} → ${booking.passengerDropoff}`
        : (existingRide ? existingRide.route.join(' → ') : 'Sarathi Trip');

      return {
        rideId,
        titleName,
        photoUrl,
        routeSub,
        lastMsg,
      };
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
          {chatListItems.length === 0 ? (
            <View style={styles.emptyChatsContainer}>
              <Ionicons name="chatbubbles-outline" size={48} color={Colors.primary} />
              <Text style={styles.emptyChatsTitle}>No active conversations</Text>
              <Text style={styles.emptyChatsSub}>
                When you request a ride or receive ride requests, your chat conversations will appear here.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.subSectionTitle}>
                {isDriverMode ? 'Passenger Inquiries & Ride Chats:' : 'Active Driver Conversations:'}
              </Text>
              {chatListItems.map((item) => {
                const lastMsg = item.lastMsg;

                return (
                  <TouchableOpacity
                    key={item.rideId}
                    style={styles.driverChatItem}
                    onPress={() => router.push({ pathname: '/chat-room', params: { rideId: item.rideId } })}
                    activeOpacity={0.8}
                  >
                    <Image source={{ uri: item.photoUrl }} style={styles.driverItemPhoto} />
                    <View style={styles.driverItemInfo}>
                      <View style={styles.driverItemHeader}>
                        <Text style={styles.driverItemName}>{item.titleName}</Text>
                        {lastMsg && (
                          <Text style={styles.driverItemTime}>
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
                      <Text style={styles.driverLastMsg} numberOfLines={1}>
                        {lastMsg ? lastMsg.text : 'Tap to start conversation'}
                      </Text>
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
