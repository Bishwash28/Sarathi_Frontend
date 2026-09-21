import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState, useRef } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { useApp, Ride } from '../context/AppContext';
import { querySarathiAI } from '../lib/aiService';
import { renderFormattedText } from '../utils/textUtils';

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
  recommendedRideIds?: string[];
}

export default function AiAssistantScreen() {
  const { rides, addRecentSearch } = useApp();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      sender: 'ai',
      text: `Search available rides, compare prices, or find the best routes by typing your destination or query below:`,
      timestamp: new Date(),
    },
  ]);

  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const handleSend = async (customPrompt?: string) => {
    const textToSend = customPrompt || inputText;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: textToSend.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    // Scroll to bottom
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const response = await querySarathiAI(textToSend, rides, 'Nepal');

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: response.reply,
        timestamp: new Date(),
        recommendedRideIds: response.recommendedRideIds,
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'ai',
          text: 'Sorry, I encountered a temporary connection issue. Please try again!',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 150);
    }
  };

  const handleBookRide = (ride: Ride) => {
    addRecentSearch(ride.pickupPoint || 'Origin', ride.route[ride.route.length - 1] || 'Destination');
    router.push({
      pathname: '/ride-detail',
      params: {
        id: ride.id,
        selectedPickup: ride.pickupPoint,
        selectedDest: ride.route[ride.route.length - 1] || ride.pickupPoint,
        pickupLat: ride.origin?.lat ?? 0,
        pickupLng: ride.origin?.lng ?? 0,
        dropLat: ride.destination?.lat ?? 0,
        dropLng: ride.destination?.lng ?? 0,
        riderName: ride.riderName,
        vehicleName: ride.vehicleName,
        vehicleNumber: ride.vehicleNumber,
        price: ride.price,
        seatsLeft: ride.seatsLeft,
        departureTime: ride.departureTime,
        rating: ride.rating ?? 5,
      },
    });
  };

  const renderRideCard = (rideId: string) => {
    const ride = rides.find(r => r.id === rideId);
    if (!ride) return null;

    return (
      <View key={ride.id} style={styles.inlineRideCard}>
        <View style={styles.cardHeader}>
          <Image source={{ uri: ride.riderPhoto }} style={styles.driverAvatar} />
          <View style={{ flex: 1 }}>
            <Text style={styles.driverName}>{ride.riderName}</Text>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={12} color="#F59E0B" />
              <Text style={styles.ratingText}>{(ride.rating ?? 5).toFixed(1)}</Text>
              <Text style={styles.vehicleText}>• {ride.vehicleName}</Text>
            </View>
          </View>
          <View style={styles.pricePill}>
            <Text style={styles.priceText}>NPR {ride.price}</Text>
          </View>
        </View>

        <View style={styles.routeRow}>
          <Ionicons name="navigate-circle" size={16} color={Colors.primary} />
          <Text style={styles.routeText} numberOfLines={1}>
            {ride.pickupPoint} ➔ {ride.route[ride.route.length - 1] || 'Destination'}
          </Text>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.metaText}>{ride.departureTime}</Text>
            <Text style={styles.metaDot}>•</Text>
            <Text style={styles.seatsText}>{ride.seatsLeft} seat(s) left</Text>
          </View>

          <TouchableOpacity
            style={styles.bookBtn}
            onPress={() => handleBookRide(ride)}
            activeOpacity={0.85}
          >
            <Text style={styles.bookBtnText}>Book Ride</Text>
            <Ionicons name="arrow-forward" size={14} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderMessageItem = ({ item }: { item: ChatMessage }) => {
    const isUser = item.sender === 'user';

    return (
      <View style={[styles.msgContainer, isUser ? styles.userMsgContainer : styles.aiMsgContainer]}>
        {!isUser && (
          <View style={styles.aiBadgeIconCircle}>
            <Ionicons name="sparkles" size={14} color="#FFF" />
          </View>
        )}
        <View style={[styles.msgBubble, isUser ? styles.userBubble : styles.aiBubble]}>
          {renderFormattedText(
            item.text,
            [styles.msgText, isUser ? styles.userMsgText : styles.aiMsgText],
            { fontWeight: 'bold' }
          )}

          {/* Render interactive recommended ride cards if returned by AI */}
          {item.recommendedRideIds && item.recommendedRideIds.length > 0 && (
            <View style={styles.recommendationsSection}>
              <Text style={styles.recommendationsTitle}>Recommended Rides:</Text>
              {item.recommendedRideIds.map(id => renderRideCard(id))}
            </View>
          )}

          <Text style={[styles.timestampText, isUser ? { color: '#93C5FD' } : { color: Colors.textMuted }]}>
            {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <View style={styles.titleRow}>
              <Ionicons name="sparkles" size={18} color={Colors.primary} />
              <Text style={styles.headerTitle}>Sarathi Smart AI</Text>
            </View>
            <Text style={styles.headerSub}>Passenger Ride & Route Assistant</Text>
          </View>

          <View style={styles.aiOnlineBadge}>
            <View style={styles.greenDot} />
            <Text style={styles.aiOnlineText}>Online</Text>
          </View>
        </View>

        {/* Messages List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessageItem}
          ListHeaderComponent={
            <View style={styles.ephemeralNotice}>
              <Ionicons name="information-circle-outline" size={14} color="#64748B" />
              <Text style={styles.ephemeralNoticeText}>
                This AI chat session is temporary and will not be saved.
              </Text>
            </View>
          }
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
        />

        {/* Typing Indicator */}
        {isLoading && (
          <View style={styles.typingContainer}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.typingText}>Sarathi AI is analyzing routes & prices...</Text>
          </View>
        )}

        {/* Input Bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Ask about rides, prices, or routes..."
            placeholderTextColor={Colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={() => handleSend()}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() || isLoading) && { opacity: 0.5 }]}
            onPress={() => handleSend()}
            disabled={!inputText.trim() || isLoading}
          >
            <Ionicons name="send" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    elevation: 2,
  },
  backBtn: {
    padding: 6,
    marginRight: 8,
  },
  headerTitleContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  headerSub: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  aiOnlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  aiOnlineText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  ephemeralNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 12,
    alignSelf: 'center',
  },
  ephemeralNoticeText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  chipsSection: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  chipsScroll: {
    paddingHorizontal: 14,
    gap: 8,
  },
  chipPill: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 24,
  },
  msgContainer: {
    flexDirection: 'row',
    marginBottom: 14,
    maxWidth: '88%',
  },
  userMsgContainer: {
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
  },
  aiMsgContainer: {
    alignSelf: 'flex-start',
    gap: 8,
  },
  aiBadgeIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  msgBubble: {
    borderRadius: 16,
    padding: 12,
  },
  userBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 2,
  },
  aiBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 1,
  },
  msgText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userMsgText: {
    color: '#FFFFFF',
  },
  aiMsgText: {
    color: Colors.textPrimary,
  },
  timestampText: {
    fontSize: 10,
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  recommendationsSection: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  recommendationsTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  inlineRideCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  driverAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
  },
  driverName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  vehicleText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  pricePill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  priceText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#15803D',
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  routeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  metaDot: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  seatsText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  bookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  bookBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  typingText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
