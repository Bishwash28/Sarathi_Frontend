import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '../../constants/Colors';
import { useApp } from '../../context/AppContext';
import { BackendUser, getUser } from '../../services/userService';

// ── Facebook-style top left-to-right animated loading bar ────────────────────
const TopFacebookLoadingBar = () => {
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loopAnimation = Animated.loop(
      Animated.timing(animValue, {
        toValue: 1,
        duration: 1100,
        useNativeDriver: false,
      })
    );
    loopAnimation.start();
    return () => loopAnimation.stop();
  }, [animValue]);

  const left = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['-50%', '100%'],
  });

  return (
    <View style={styles.topLoadingTrack}>
      <Animated.View style={[styles.topLoadingFill, { left }]} />
    </View>
  );
};

export default function ProfileScreen() {
  const { user, completeProfile, updateEmergencyContact, logout, updateUserProfile, deleteAccount, switchUserRole } = useApp();

  // ── Live backend data ────────────────────────────────────────────────────────
  const [backendUser, setBackendUser] = useState<BackendUser | null>(null);
  const [isFetchingProfile, setIsFetchingProfile] = useState(true);

  // Re-fetch whenever user context changes (e.g. right after login)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setIsFetchingProfile(true);
        const uid = await AsyncStorage.getItem('@sarathi_user_id');
        const token = await AsyncStorage.getItem('@sarathi_token');
        if (!uid) { if (!cancelled) setIsFetchingProfile(false); return; }
        const res = await getUser(uid, token ?? undefined);
        if (!cancelled && res.success && res.data) setBackendUser(res.data as BackendUser);
      } catch (e) {
        console.warn('[profile] Failed to fetch user from backend:', e);
      } finally {
        if (!cancelled) setIsFetchingProfile(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.email]);

  // Use backend data when available, fall back to local context
  const displayName = backendUser?.name || user?.name || 'User';
  const displayEmail = backendUser?.email || user?.email || '—';
  const displayPhone = backendUser?.phone || user?.phone || '—';
  const displayAvatar = backendUser?.avatarUrl || user?.photo || 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRrrBvl0wGQfV6SSYHn4MDl1Dx5h7ReyxWPaHhUynJVGQ&s=10';
  const displayKyc = backendUser?.kycVerified ?? user?.kycVerified;
  const displayRole = backendUser?.activeRole?.toLowerCase() === 'driver' ? 'driver' : (user?.role ?? 'passenger');
  const memberSince = backendUser?.createdAt ? new Date(backendUser.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : null;

  // ── Edit Profile modal ───────────────────────────────────────────────────────
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [manageAccountExpanded, setManageAccountExpanded] = useState(true);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const openEditModal = () => {
    setEditName(displayName);
    setEditEmail(displayEmail);
    setEditPhone(displayPhone);
    setEditModalVisible(true);
  };

  // ── Image Picker Handler ──────────────────────────────────────────────────
  const handlePickAvatar = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Denied', 'Permission to access photo library is required to change profile picture.');
        return;
      }

      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!pickerResult.canceled && pickerResult.assets && pickerResult.assets.length > 0) {
        const selectedUri = pickerResult.assets[0].uri;
        setIsFetchingProfile(true);
        const result = await updateUserProfile({ avatarUrl: selectedUri });
        setIsFetchingProfile(false);
        if (!result.success) {
          Alert.alert('Error', result.error || 'Failed to update profile picture.');
        } else {
          Alert.alert('Success', 'Profile picture updated successfully!');
        }
      }
    } catch (err) {
      console.error('[handlePickAvatar] Error picking image:', err);
      Alert.alert('Error', 'Could not select photo.');
    }
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) { Alert.alert('Validation', 'Name cannot be empty.'); return; }
    setIsSavingProfile(true);
    const result = await updateUserProfile({
      name: editName.trim(),
      email: editEmail.trim(),
      phone: editPhone.trim(),
    });
    setIsSavingProfile(false);
    if (!result.success) {
      Alert.alert('Error', result.error || 'Failed to update profile.');
      return;
    }
    // Refresh backend data
    const uid = await AsyncStorage.getItem('@sarathi_user_id');
    const token = (await AsyncStorage.getItem('@sarathi_token')) || (await AsyncStorage.getItem('@sarathi_auth_token'));
    if (uid) {
      const res = await getUser(uid, token ?? undefined);
      if (res.success && res.data) setBackendUser(res.data);
    }
    setEditModalVisible(false);
    Alert.alert('Success', 'Profile updated successfully.');
  };

  // ── Delete account ───────────────────────────────────────────────────────────
  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteAccount();
            if (!result.success) {
              Alert.alert('Error', result.error || 'Failed to delete account.');
              return;
            }
            router.replace('/(auth)/login');
          },
        },
      ],
    );
  };

  // ── Logout ───────────────────────────────────────────────────────────────────
  const handleLogout = () => {
    logout();
    router.replace('/(auth)/login');
  };

  const handleSwitchMode = async () => {
    const targetRole = displayRole === 'driver' ? 'PASSENGER' : 'DRIVER';

    if (targetRole === 'DRIVER' && displayKyc !== true) {
      Alert.alert(
        'KYC Verification Required',
        'You must complete driver KYC verification before offering rides.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Verify KYC Now', onPress: () => router.push('/kyc') },
        ],
      );
      return;
    }

    setIsFetchingProfile(true);
    const res = await switchUserRole(targetRole);

    // Refresh local backendUser state from storage / API
    const uid = await AsyncStorage.getItem('@sarathi_user_id');
    const token = (await AsyncStorage.getItem('@sarathi_token')) || (await AsyncStorage.getItem('@sarathi_auth_token'));
    if (uid) {
      const refreshed = await getUser(uid, token ?? undefined);
      if (refreshed.success && refreshed.data) {
        setBackendUser(refreshed.data);
      }
    }
    setIsFetchingProfile(false);

    if (!res.success) {
      Alert.alert('Role Switch Failed', res.error || 'Unable to switch role at this time.');
    }
  };

  return (
    <View style={styles.safeArea}>
      {/* ── Facebook-style Top Loading Bar ── */}
      {isFetchingProfile && <TopFacebookLoadingBar />}

      <KeyboardAvoidingView style={styles.keyboardContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* ── Scrollable content ─────────────────────────────────────────── */}
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* ── Profile Header Card ─────────────────────────────────────────── */}
          <View style={styles.profileHeaderCard}>
            {/* Horizontal Facebook-style Profile Info */}
            <View style={styles.horizontalProfileRow}>
              <View style={styles.avatarContainer}>
                <Image source={{ uri: displayAvatar }} style={styles.avatar} />
                <TouchableOpacity style={styles.avatarEditButton} onPress={handlePickAvatar} activeOpacity={0.8}>
                  <Ionicons name="camera" size={14} color="#FFF" />
                </TouchableOpacity>
              </View>

              <View style={styles.profileInfoTextContainer}>
                <Text style={styles.userName}>{displayName}</Text>

                {memberSince && (
                  <Text style={styles.memberSince}>Member since {memberSince}</Text>
                )}

                <View style={styles.badgeRow}>
                  <View style={styles.roleBadge}>
                    <Ionicons
                      name={displayRole === 'driver' ? 'car-sport' : 'person'}
                      size={13}
                      color="#FFF"
                    />
                    <Text style={styles.roleText}>
                      {displayRole === 'driver' ? 'Driver' : 'Rider'}
                    </Text>
                  </View>
                  <View style={styles.ratingBadge}>
                    <Ionicons name="star" size={13} color="#FFF" />
                    <Text style={styles.ratingText}>{user?.rating?.toFixed(1) ?? '5.0'}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Role Switch Button at Bottom of Profile Card */}
            <TouchableOpacity
              style={styles.cardBottomRoleSwitchBtn}
              onPress={handleSwitchMode}
              activeOpacity={0.8}
            >
              <Ionicons
                name="swap-horizontal"
                size={16}
                color={Colors.primary}
              />
              <Text style={styles.cardBottomRoleSwitchText}>
                Switch to {displayRole === 'driver' ? 'Rider' : 'Driver'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Account Details Card */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Account Details</Text>

            <View style={styles.detailRow}>
              <Ionicons name="mail-outline" size={20} color={Colors.textMuted} />
              <View style={styles.detailTextContainer}>
                <Text style={styles.detailLabel}>Email Address</Text>
                <Text style={styles.detailValue}>{displayEmail}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <Ionicons name="call-outline" size={20} color={Colors.textMuted} />
              <View style={styles.detailTextContainer}>
                <Text style={styles.detailLabel}>Phone Number</Text>
                <Text style={styles.detailValue}>{displayPhone}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <Ionicons name="shield-checkmark-outline" size={20} color={Colors.textMuted} />
              <View style={styles.detailTextContainer}>
                <Text style={styles.detailLabel}>KYC Status</Text>
                {(() => {
                  const isVerified = displayKyc === true || backendUser?.kycStatus === 'VERIFIED' || user?.kycStatus === 'VERIFIED';
                  const isPending = !isVerified && (backendUser?.kycStatus === 'PENDING' || user?.kycStatus === 'PENDING');
                  
                  if (isVerified) {
                    return <Text style={[styles.detailValue, { color: Colors.success }]}>Verified</Text>;
                  } else if (isPending) {
                    return <Text style={[styles.detailValue, { color: '#F59E0B' }]}>Pending Verification</Text>;
                  } else {
                    return (
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                        <Text style={[styles.detailValue, { color: Colors.error, marginTop: 0 }]}>Not Verified</Text>
                        <TouchableOpacity
                          style={styles.completeKycButton}
                          onPress={() => router.push('/kyc')}
                        >
                          <Text style={styles.completeKycText}>Verify Now →</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  }
                })()}
              </View>
            </View>
          </View>

          {/* ── Settings Card ──────────────────────────────────────────────── */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Settings</Text>

            {/* My Vehicles Button */}
            <TouchableOpacity style={styles.settingRow} onPress={() => router.push('/vehicles')} activeOpacity={0.7}>
              <Ionicons name="car-sport-outline" size={20} color={Colors.primary} />
              <Text style={styles.settingRowText}>My Vehicles</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.settingRow} onPress={() => Alert.alert('Notifications', 'Notification preferences updated.')} activeOpacity={0.7}>
              <Ionicons name="notifications-outline" size={20} color={Colors.primary} />
              <Text style={styles.settingRowText}>Notifications</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Manage Account Accordion / Group */}
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => setManageAccountExpanded(!manageAccountExpanded)}
              activeOpacity={0.7}
            >
              <Ionicons name="person-circle-outline" size={20} color={Colors.primary} />
              <Text style={styles.settingRowText}>Manage Account</Text>
              <Ionicons
                name={manageAccountExpanded ? 'chevron-down' : 'chevron-forward'}
                size={18}
                color={Colors.textMuted}
              />
            </TouchableOpacity>

            {manageAccountExpanded && (
              <View style={styles.subSettingContainer}>
                {/* 1. Edit Profile */}
                <TouchableOpacity style={styles.subSettingRow} onPress={openEditModal} activeOpacity={0.7}>
                  <Ionicons name="pencil-outline" size={18} color={Colors.primary} />
                  <Text style={styles.subSettingRowText}>Edit Profile</Text>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                </TouchableOpacity>

                <View style={styles.subDivider} />

                {/* 2. Delete Account */}
                <TouchableOpacity style={styles.subSettingRow} onPress={handleDeleteAccount} activeOpacity={0.7}>
                  <Ionicons name="trash-outline" size={18} color="#DC2626" />
                  <Text style={[styles.subSettingRowText, { color: '#DC2626' }]}>Delete Account</Text>
                  <Ionicons name="chevron-forward" size={16} color="#DC2626" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Logout Button Card */}
          <TouchableOpacity style={styles.logoutCard} onPress={handleLogout} activeOpacity={0.85}>
            <Ionicons name="log-out-outline" size={20} color={Colors.error} />
            <Text style={styles.logoutCardText}>Log Out</Text>
          </TouchableOpacity>

          <View style={styles.versionFooter}>
            <Text style={styles.versionText}>Sarathi v1.0.0</Text>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Edit Profile Modal ──────────────────────────────────────────────── */}
      <Modal visible={editModalVisible} animationType="slide" transparent onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Full Name</Text>
            <View style={styles.fieldRow}>
              <Ionicons name="person-outline" size={18} color={Colors.primary} style={styles.fieldIcon} />
              <TextInput style={styles.fieldInput} value={editName} onChangeText={setEditName} placeholder="Your name" placeholderTextColor={Colors.textMuted} />
            </View>

            <Text style={styles.fieldLabel}>Email</Text>
            <View style={styles.fieldRow}>
              <Ionicons name="mail-outline" size={18} color={Colors.primary} style={styles.fieldIcon} />
              <TextInput style={styles.fieldInput} value={editEmail} onChangeText={setEditEmail} placeholder="Your email" placeholderTextColor={Colors.textMuted} keyboardType="email-address" autoCapitalize="none" />
            </View>

            <Text style={styles.fieldLabel}>Phone</Text>
            <View style={styles.fieldRow}>
              <Ionicons name="call-outline" size={18} color={Colors.primary} style={styles.fieldIcon} />
              <TextInput style={styles.fieldInput} value={editPhone} onChangeText={setEditPhone} placeholder="Your phone" placeholderTextColor={Colors.textMuted} keyboardType="phone-pad" />
            </View>



            <TouchableOpacity
              style={[styles.saveProfileBtn, isSavingProfile && { opacity: 0.65 }]}
              onPress={handleSaveProfile}
              disabled={isSavingProfile}
            >
              {isSavingProfile
                ? <ActivityIndicator size="small" color="#FFF" />
                : <Text style={styles.saveProfileBtnText}>Save Changes</Text>}
            </TouchableOpacity>
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
    position: 'relative',
  },
  topLoadingTrack: {
    height: 3,
    width: '100%',
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
  },
  topLoadingFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '50%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 120,
  },
  profileHeaderCard: {
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  horizontalProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    width: '100%',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  avatarEditButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.primary,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  profileInfoTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  memberSince: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 5,
  },
  roleText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    gap: 4,
  },
  ratingText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  editProfileBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.accent,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  detailTextContainer: {
    marginLeft: 14,
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '600',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.accent + '15',
    marginVertical: 10,
  },
  roleChipRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  roleChipRider: {
    backgroundColor: Colors.primary,
  },
  roleChipDriver: {
    backgroundColor: Colors.accent,
  },
  roleChipText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  completeKycButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  completeKycText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  editContactContainer: {
    marginTop: 4,
  },
  contactInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.accent + '25',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  editActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  cancelButtonText: {
    color: Colors.textMuted,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: Colors.accent,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  saveButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  driverBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.accent + '15',
    borderRadius: 12,
  },
  driverBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  driverBannerTextContainer: {
    flex: 1,
  },
  driverBannerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  driverBannerSubtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  cardBottomRoleSwitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
    backgroundColor: Colors.primary + '0D',
    gap: 8,
  },
  cardBottomRoleSwitchText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  subSettingContainer: {
    paddingLeft: 12,
    paddingTop: 4,
    paddingBottom: 4,
  },
  subSettingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingRight: 4,
  },
  subSettingRowText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
    marginLeft: 10,
  },
  subDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 4,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  settingRowText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
    marginLeft: 12,
  },
  logoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    gap: 8,
  },
  logoutCardText: {
    color: Colors.error,
    fontWeight: 'bold',
    fontSize: 15,
  },
  versionFooter: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 8,
  },
  versionText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  // ── Modal ──────────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 6,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  fieldIcon: {
    marginRight: 8,
  },
  fieldInput: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  saveProfileBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  saveProfileBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
});
