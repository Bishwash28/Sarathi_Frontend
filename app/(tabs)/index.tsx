import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Image,
  ImageBackground,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '../../constants/Colors';
import { useApp } from '../../context/AppContext';

// Sample recent searches using landmarks
const RECENT_SEARCHES = [
  { from: 'Kalanki', to: 'Koteshwor' },
  { from: 'Balkhu', to: 'Chabahil' },
  { from: 'Tripureshwor', to: 'Putalisadak' },
  { from: 'Kalanki', to: 'Lagankhel' },
];

export default function HomeScreen() {
  const { notifications } = useApp();
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'recent' | 'saved'>('recent');

  const handleRecentSearchTap = (from: string, to: string) => {
    router.push({
      pathname: '/search-ride',
      params: { prefillFrom: from, prefillTo: to },
    });
  };

  const handleFindRide = () => {
    router.push('/search-ride');
  };

  return (
    <View style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 2. Full Background Hero Section with Header ── */}
        <ImageBackground
          source={require('../../assets/images/home_top1.png')}
          style={styles.heroSection}
          imageStyle={styles.heroImageStyle}
        >
          <View style={styles.heroOverlay} />
          
          {/* Header Bar inside ImageBackground */}
          <View style={styles.headerBar}>
            <View style={styles.logoContainer}>
              <Image
                source={require('../../assets/images/text_logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <TouchableOpacity
              style={styles.notifBellButton}
              onPress={() => setShowNotificationsModal(true)}
            >
              <Ionicons name="notifications-outline" size={22} color={Colors.primary} />
              {notifications.length > 0 && (
                <View style={styles.notifBadgeCircle}>
                  <Text style={styles.notifBadgeText}>{notifications.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.heroTextContainer}>
            <Text style={styles.heroHeading}>
              Going somewhere?{'\n'}Find someone on{'\n'}the same route.
            </Text>
            <Text style={styles.heroSubtext}>
              Search your route and connect{'\n'}with riders headed your way.
            </Text>
          </View>
        </ImageBackground>

        {/* ── 3. Find a Ride Button ── */}
        <View style={styles.searchBarSection}>
          <TouchableOpacity
            style={styles.findRideBar}
            onPress={handleFindRide}
            activeOpacity={0.85}
          >
            <Ionicons name="search" size={20} color="#FFF" />
            <Text style={styles.findRideText}>Find a Ride</Text>
          </TouchableOpacity>
        </View>

        {/* ── 4. Recent / Saved Tabs Toggle ── */}
        <View style={styles.tabsSection}>
          <View style={styles.tabToggleContainer}>
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

          {/* Conditional Content rendering */}
          {activeTab === 'recent' ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recentChipsScroll}
            >
              {RECENT_SEARCHES.map((search, index) => (
                <TouchableOpacity
                  key={`recent-${index}`}
                  style={styles.recentChip}
                  onPress={() => handleRecentSearchTap(search.from, search.to)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.recentChipText}>
                    {search.from} → {search.to}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.savedItemsList}>
              {/* Add Home */}
              <TouchableOpacity style={styles.savedItemRow} activeOpacity={0.7}>
                <View style={styles.savedIconContainer}>
                  <Ionicons name="home" size={20} color={Colors.primary} />
                </View>
                <Text style={styles.savedItemText}>Add Home</Text>
              </TouchableOpacity>

              <View style={styles.savedDivider} />

              {/* Add Work */}
              <TouchableOpacity style={styles.savedItemRow} activeOpacity={0.7}>
                <View style={styles.savedIconContainer}>
                  <Ionicons name="briefcase" size={20} color={Colors.primary} />
                </View>
                <Text style={styles.savedItemText}>Add Work</Text>
              </TouchableOpacity>

              <View style={styles.savedDivider} />

              {/* Add New */}
              <TouchableOpacity style={styles.savedItemRow} activeOpacity={0.7}>
                <View style={styles.savedIconContainer}>
                  <Ionicons name="bookmark" size={20} color={Colors.primary} />
                </View>
                <Text style={styles.savedItemText}>Add New</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── 5. Info Banner ── */}
        <View style={styles.infoBanner}>
          <View style={styles.infoBannerIconCircle}>
            <Ionicons name="information-circle" size={24} color={Colors.primary} />
          </View>
          <View style={styles.infoBannerTextContainer}>
            <Text style={styles.infoBannerText}>
              Sarathi connects you with riders already heading your way — search a route, request to join, and split the cost.
            </Text>
          </View>
          <TouchableOpacity style={styles.infoBannerClose}>
            <Ionicons name="close" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Bottom spacer */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Notifications Modal ── */}
      <Modal
        visible={showNotificationsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowNotificationsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Updates & Notifications</Text>
              <TouchableOpacity onPress={() => setShowNotificationsModal(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              {notifications.length === 0 ? (
                <Text style={styles.noNotifText}>No notifications yet.</Text>
              ) : (
                notifications.map((notif, index) => (
                  <View key={`notif-${index}`} style={styles.notifCardItem}>
                    <View style={styles.notifIconBox}>
                      <Ionicons name="notifications" size={16} color={Colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.notifCardText}>{notif}</Text>
                      <Text style={styles.notifTimeText}>Just now</Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },

  /* ── Header Bar ── */
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 14,
    width: '100%',
  },
  logoContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 90,
    height: 24,
  },
  notifBellButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  notifBadgeCircle: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: Colors.accent,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },

  /* ── Hero Section ── */
  heroSection: {
    width: '100%',
    overflow: 'hidden',
    paddingTop: 8,
    paddingBottom: 50,
    minHeight: 330,
    justifyContent: 'flex-start',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  heroImageStyle: {
    resizeMode: 'cover',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  heroTextContainer: {
    zIndex: 1,
    paddingHorizontal: 24,
    marginTop: 24,
  },
  heroHeading: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.primary,
    lineHeight: 34,
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  heroSubtext: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    fontWeight: '600',
  },

  /* ── Find a Ride Bar ── */
  searchBarSection: {
    marginHorizontal: 16,
    marginTop: -22,
    zIndex: 10,
  },
  findRideBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    gap: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  findRideText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.3,
  },

  /* ── Recent / Saved Tabs Toggle ── */
  tabsSection: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  tabToggleContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 10,
  },
  tabButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
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
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  activeTabButtonText: {
    color: Colors.primary,
  },

  /* ── Recent Searches (horizontal) ── */
  recentChipsScroll: {
    gap: 10,
    paddingRight: 20,
  },
  recentChip: {
    backgroundColor: Colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.accent + '25',
  },
  recentChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },

  /* ── Saved Items List (vertical) ── */
  savedItemsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  savedItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  savedIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  savedItemText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary,
  },
  savedDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },

  /* ── Info Banner ── */
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    marginTop: 20,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.accent + '15',
    gap: 12,
  },
  infoBannerIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBannerTextContainer: {
    flex: 1,
  },
  infoBannerText: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 19,
    fontWeight: '500',
  },
  infoBannerClose: {
    padding: 2,
  },

  /* ── Notifications Modal ── */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '75%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  modalScroll: {
    paddingBottom: 20,
  },
  noNotifText: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    marginVertical: 20,
  },
  notifCardItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  notifIconBox: {
    backgroundColor: '#FEF2F2',
    padding: 8,
    borderRadius: 10,
    marginRight: 12,
  },
  notifCardText: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: '600',
    lineHeight: 18,
  },
  notifTimeText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
  },
});
