import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
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

export default function SearchRideScreen() {
  const params = useLocalSearchParams();
  const [pickup, setPickup] = useState((params.prefillFrom as string) || 'Tara Path, East West Highway, Ramnagar');
  const [destination, setDestination] = useState((params.prefillTo as string) || '');
  const [activeTab, setActiveTab] = useState<'recent' | 'saved'>('recent');

  const handleBack = () => {
    router.back();
  };

  const handleSelectRecent = (placeName: string) => {
    setDestination(placeName);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ── Header with Input Fields ── */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color={Colors.primary} />
          </TouchableOpacity>

          <View style={styles.inputCard}>
            {/* Pickup Row */}
            <View style={styles.inputRow}>
              <Ionicons name="disc-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Start location..."
                placeholderTextColor={Colors.textMuted}
                value={pickup}
                onChangeText={setPickup}
              />
            </View>

            <View style={styles.inputDivider} />

            {/* Destination Row */}
            <View style={styles.inputRow}>
              <Ionicons name="location-sharp" size={20} color={Colors.accent} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Where to? (e.g. Kathmandu Fun Park)"
                placeholderTextColor={Colors.textMuted}
                value={destination}
                onChangeText={setDestination}
                autoFocus={true}
              />
              <TouchableOpacity style={styles.addCircleButton}>
                <Ionicons name="add" size={16} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* ── Tabs Toggle ── */}
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'recent' && styles.activeTabButton]}
              onPress={() => setActiveTab('recent')}
            >
              <Text style={[styles.tabButtonText, activeTab === 'recent' && styles.activeTabButtonText]}>
                Recent
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'saved' && styles.activeTabButton]}
              onPress={() => setActiveTab('saved')}
            >
              <Text style={[styles.tabButtonText, activeTab === 'saved' && styles.activeTabButtonText]}>
                Saved
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Conditional Tab Content ── */}
          {activeTab === 'recent' ? (
            <View style={styles.listSection}>
              <TouchableOpacity 
                style={styles.listItemRow} 
                onPress={() => handleSelectRecent('Kathmandu Fun Park, Bhrikuti Mandap, KTM')}
              >
                <View style={styles.listIconCircle}>
                  <Ionicons name="time-outline" size={20} color={Colors.textMuted} />
                </View>
                <View style={styles.listItemTextContainer}>
                  <Text style={styles.listItemTitle} numberOfLines={1}>
                    Kathmandu Fun Park, Bhrikuti Mandap, KTM
                  </Text>
                </View>
                <TouchableOpacity style={styles.moreButton}>
                  <Ionicons name="ellipsis-vertical" size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.listSection}>
              {/* Add Home */}
              <TouchableOpacity style={styles.listItemRow}>
                <View style={[styles.listIconCircle, styles.savedIconBackground]}>
                  <Ionicons name="home" size={18} color={Colors.primary} />
                </View>
                <Text style={styles.savedItemText}>Add Home</Text>
              </TouchableOpacity>

              {/* Add Work */}
              <TouchableOpacity style={styles.listItemRow}>
                <View style={[styles.listIconCircle, styles.savedIconBackground]}>
                  <Ionicons name="briefcase" size={18} color={Colors.primary} />
                </View>
                <Text style={styles.savedItemText}>Add Work</Text>
              </TouchableOpacity>

              {/* Add New */}
              <TouchableOpacity style={styles.listItemRow}>
                <View style={[styles.listIconCircle, styles.savedIconBackground]}>
                  <Ionicons name="bookmark" size={18} color={Colors.primary} />
                </View>
                <Text style={styles.savedItemText}>Add New</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Add Missing Place ── */}
          <TouchableOpacity style={styles.missingPlaceCard}>
            <View style={styles.missingPlaceIconCircle}>
              <Ionicons name="location" size={20} color="#F59E0B" />
            </View>
            <Text style={styles.missingPlaceText}>Add Missing Place</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  keyboardView: {
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
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  inputCard: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    padding: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    height: 40,
  },
  inputDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 8,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  addCircleButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  tabButton: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  activeTabButton: {
    backgroundColor: Colors.surface,
    borderColor: Colors.accent + '25',
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  activeTabButtonText: {
    color: Colors.primary,
  },
  listSection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  listIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  savedIconBackground: {
    backgroundColor: Colors.surface,
  },
  savedItemText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  listItemTextContainer: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  moreButton: {
    padding: 6,
  },
  missingPlaceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
  },
  missingPlaceIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  missingPlaceText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },

});
