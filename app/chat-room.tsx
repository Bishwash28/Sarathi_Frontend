import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, Image, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { useApp, DriverMessage } from '../context/AppContext';

export default function ChatRoomScreen() {
  const { rideId } = useLocalSearchParams<{ rideId?: string }>();
  const { rides, driverMessages, sendDriverMessage, startRiderChat } = useApp();
  const [inputText, setInputText] = useState('');

  const ride = rides.find(r => r.id === rideId);
  const messages = rideId ? (driverMessages[rideId] || []) : [];

  if (!ride) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Driver chat not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const handleSend = () => {
    if (!inputText.trim()) return;
    if (rideId) {
      sendDriverMessage(rideId, inputText.trim());
      setInputText('');
    }
  };

  const handleCall = () => {
    Alert.alert('Calling Driver', `Dialing ${ride.riderName} (${ride.vehicleNumber})...`);
  };

  const renderMessageItem = (item: DriverMessage) => {
    const isUser = item.sender === 'user';
    return (
      <View key={item.id} style={[styles.messageRow, isUser ? styles.userRow : styles.driverRow]}>
        {!isUser && (
          <Image source={{ uri: ride.riderPhoto }} style={styles.driverPhoto} />
        )}
        <View style={[styles.bubble, isUser ? styles.userBubble : styles.driverBubble]}>
          <Text style={[styles.messageText, isUser ? styles.userMessageText : styles.driverMessageText]}>
            {item.text}
          </Text>
          <Text style={styles.timestampText}>
            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Custom Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>

          <Image source={{ uri: ride.riderPhoto }} style={styles.headerAvatar} />

          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>{ride.riderName}</Text>
            <Text style={styles.headerSub}>{ride.vehicleName} • {ride.vehicleNumber}</Text>
          </View>

          <TouchableOpacity style={styles.callButton} onPress={handleCall}>
            <Ionicons name="call" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Message Thread Scroll View */}
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.encryptionNotice}>
            <Ionicons name="lock-closed" size={12} color={Colors.textMuted} />
            <Text style={styles.encryptionText}>End-to-end encrypted chat with your rider</Text>
          </View>

          {messages.map(renderMessageItem)}
        </ScrollView>

        {/* Bottom Message Input Field */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.inputField}
            placeholder={`Message ${ride.riderName.split(' ')[0]}...`}
            placeholderTextColor={Colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
            <Ionicons name="send" size={16} color="#FFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  iconButton: {
    padding: 6,
    marginRight: 8,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  headerSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  callButton: {
    backgroundColor: Colors.accent,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  encryptionNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignSelf: 'center',
    marginBottom: 16,
    gap: 6,
  },
  encryptionText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
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
  driverRow: {
    alignSelf: 'flex-start',
    justifyContent: 'flex-start',
  },
  driverPhoto: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
    marginTop: 4,
  },
  bubble: {
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  userBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  driverBubble: {
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
  driverMessageText: {
    color: Colors.textPrimary,
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
  inputField: {
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
