import React, { useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { useApp, Message, Ride } from '../../context/AppContext';

export default function InboxScreen() {
  const params = useLocalSearchParams<{ rideId?: string }>();
  const { rides, messages, driverMessages, activeChatRideIds, sendChatMessage } = useApp();
  const [activeSection, setActiveSection] = React.useState<'chats' | 'ai'>('chats');
  const [inputText, setInputText] = React.useState('');

  // Automatically navigate to dedicated chat-room if rideId param passed
  useEffect(() => {
    if (params.rideId) {
      router.push({ pathname: '/chat-room', params: { rideId: params.rideId } });
    }
  }, [params.rideId]);

  const activeRiderChats = rides.filter(r => activeChatRideIds.includes(r.id));

  const handleSendAiMessage = () => {
    if (!inputText.trim()) return;
    sendChatMessage(inputText.trim());
    setInputText('');
  };

  const renderSuggestedRideCard = (rideId: string) => {
    const ride = rides.find(r => r.id === rideId);
    if (!ride) return null;

    return (
      <TouchableOpacity
        key={rideId}
        style={styles.suggestionCard}
        onPress={() => router.push({ pathname: '/ride-detail', params: { id: ride.id } })}
      >
        <Image source={{ uri: ride.riderPhoto }} style={styles.suggestedDriverPhoto} />
        <View style={styles.suggestedInfo}>
          <Text style={styles.suggestedDriverName}>{ride.riderName}</Text>
          <Text style={styles.suggestedVehicle} numberOfLines={1}>
            {ride.vehicleName} • NPR {ride.price}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.accent} />
      </TouchableOpacity>
    );
  };

  const renderAiMessageItem = (item: Message) => {
    const isUser = item.sender === 'user';
    return (
      <View key={item.id} style={[styles.messageRow, isUser ? styles.userRow : styles.aiRow]}>
        {!isUser && (
          <View style={styles.aiAvatar}>
            <Ionicons name="sparkles" size={14} color="#FFF" />
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
          <Text style={[styles.messageText, isUser ? styles.userMessageText : styles.aiMessageText]}>
            {item.text}
          </Text>
          {item.suggestedRides && item.suggestedRides.length > 0 && (
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsHeader}>Suggested Options:</Text>
              {item.suggestedRides.map(renderSuggestedRideCard)}
            </View>
          )}
          <Text style={styles.timestampText}>
            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Header Title */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Inbox & Messages</Text>
        </View>

        {/* Tab Selector: Rider Chats vs AI Assistant */}
        <View style={styles.tabSelector}>
          <TouchableOpacity
            style={styles.tabButton}
            onPress={() => setActiveSection('chats')}
          >
            <Text style={[styles.tabButtonText, activeSection === 'chats' && styles.tabButtonTextActive]}>
              Rider Chats ({activeRiderChats.length})
            </Text>
            {activeSection === 'chats' && <View style={styles.activeTabIndicator} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tabButton}
            onPress={() => setActiveSection('ai')}
          >
            <Text style={[styles.tabButtonText, activeSection === 'ai' && styles.tabButtonTextActive]}>
              AI Assistant
            </Text>
            {activeSection === 'ai' && <View style={styles.activeTabIndicator} />}
          </TouchableOpacity>
        </View>

        {/* Section Body */}
        {activeSection === 'chats' ? (
          /* Rider Chat List View */
          <ScrollView contentContainerStyle={styles.chatListScroll} showsVerticalScrollIndicator={false}>
            {activeRiderChats.length === 0 ? (
              <View style={styles.emptyChatsContainer}>
                <Ionicons name="chatbubbles-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.emptyChatsTitle}>No active rider chats</Text>
                <Text style={styles.emptyChatsSub}>
                  To start a chat with a rider, open any ride details page from the home screen and tap the message button.
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.subSectionTitle}>Active Rider Conversations:</Text>
                {activeRiderChats.map(ride => {
                  const msgs = driverMessages[ride.id] || [];
                  const lastMsg = msgs[msgs.length - 1];

                  return (
                    <TouchableOpacity
                      key={ride.id}
                      style={styles.driverChatItem}
                      onPress={() => router.push({ pathname: '/chat-room', params: { rideId: ride.id } })}
                      activeOpacity={0.8}
                    >
                      <Image source={{ uri: ride.riderPhoto }} style={styles.driverItemPhoto} />
                      <View style={styles.driverItemInfo}>
                        <View style={styles.driverItemHeader}>
                          <Text style={styles.driverItemName}>{ride.riderName}</Text>
                          {lastMsg && (
                            <Text style={styles.driverItemTime}>
                              {new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                          )}
                        </View>
                        <Text style={styles.driverItemSub}>{ride.vehicleName} • {ride.departureTime}</Text>
                        <Text style={styles.driverLastMsg} numberOfLines={1}>
                          {lastMsg ? lastMsg.text : 'Tap to open chat conversation'}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
          </ScrollView>
        ) : (
          /* AI Assistant Chat View */
          <View style={styles.aiChatContainer}>
            <ScrollView contentContainerStyle={styles.chatScroll} showsVerticalScrollIndicator={false}>
              {messages.map(renderAiMessageItem)}
            </ScrollView>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="Ask AI for ride options..."
                placeholderTextColor={Colors.textMuted}
                value={inputText}
                onChangeText={setInputText}
                onSubmitEditing={handleSendAiMessage}
              />
              <TouchableOpacity style={styles.sendButton} onPress={handleSendAiMessage}>
                <Ionicons name="send" size={16} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        )}
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
  chatListScroll: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  emptyChatsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
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
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  subSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 12,
  },
  driverChatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 4,
  },
  driverItemPhoto: {
    width: 46,
    height: 46,
    borderRadius: 23,
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
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  driverItemTime: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  driverItemSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  driverLastMsg: {
    fontSize: 13,
    color: Colors.textPrimary,
    marginTop: 4,
    fontWeight: '500',
  },
  aiChatContainer: {
    flex: 1,
  },
  chatScroll: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
    maxWidth: '85%',
  },
  userRow: {
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
  },
  aiRow: {
    alignSelf: 'flex-start',
    justifyContent: 'flex-start',
  },
  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 4,
  },
  bubble: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  userBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userMessageText: {
    color: '#FFF',
  },
  aiMessageText: {
    color: Colors.textPrimary,
  },
  suggestionsContainer: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  suggestionsHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.textMuted,
    marginBottom: 8,
  },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 10,
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  suggestedDriverPhoto: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
  },
  suggestedInfo: {
    flex: 1,
  },
  suggestedDriverName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  suggestedVehicle: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  timestampText: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.textPrimary,
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: Colors.accent,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
