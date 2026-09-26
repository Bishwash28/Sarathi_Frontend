import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import Constants from 'expo-constants';
import { Colors } from '../../constants/Colors';
import { useApp } from '../../context/AppContext';

// ── Facebook-style top left-to-right animated loading bar ────────────────────
const TopFacebookLoadingBar = () => {
  const animVal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(animVal, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: false,
      })
    ).start();
  }, [animVal]);

  const left = animVal.interpolate({
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
  const { user, getUserRating, completeProfile, updateEmergencyContact, logout, updateUserProfile, deleteAccount, switchUserRole, changePassword, adminApproveKyc, adminRejectKyc, refreshKycStatus } = useApp();
  const userRating = getUserRating(user?.id);

  const [isFetchingProfile, setIsFetchingProfile] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refreshKycStatus();
    }, [])
  );

  useEffect(() => {
    setIsFetchingProfile(false);
  }, [user?.email]);

  const defaultAvatar = 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&h=200&q=80';
  const displayAvatar = user?.photo && user.photo.trim().length > 0 ? user.photo : defaultAvatar;
  const [avatarUri, setAvatarUri] = useState(displayAvatar);

  useEffect(() => {
    if (user?.photo) {
      setAvatarUri(user.photo);
    }
  }, [user?.photo]);

  const displayName = user?.name || 'User';
  const displayEmail = user?.email || '—';
  const displayPhone = user?.phone || '—';
  const displayRole = user?.role ?? 'passenger';
  const memberSince = null;

  // ── Edit Profile modal ───────────────────────────────────────────────────────
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [changePasswordModalVisible, setChangePasswordModalVisible] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
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

  const handleChangePasswordSubmit = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Validation Error', 'Password must be at least 6 characters long.');
      return;
    }

    setIsChangingPassword(true);
    const result = await changePassword(newPassword);
    setIsChangingPassword(false);

    if (result.success) {
      setChangePasswordModalVisible(false);
      setNewPassword('');
      Alert.alert('Success', 'Your password has been changed successfully.');
    } else {
      Alert.alert('Error', result.error || 'Failed to update password.');
    }
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
      phone: editPhone.trim(),
    });
    setIsSavingProfile(false);
    if (!result.success) {
      Alert.alert('Error', result.error || 'Failed to update profile.');
      return;
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
    const targetLabel = targetRole === 'DRIVER' ? 'Driver' : 'Passenger';

    setIsFetchingProfile(true);
    const res = await switchUserRole(targetRole);
    setIsFetchingProfile(false);

    if (res.success) {
      Alert.alert('Role Switched', `You are now in ${targetLabel} mode.`);
      return;
    }

    if (res.error === 'ACTIVE_TRIP_EXISTS') {
      Alert.alert(
        'Cannot Switch Role',
        res.message || 'You have an active ride or booking in progress. Please complete or cancel your current trip before switching roles.'
      );
      return;
    }

    if (res.error === 'KYC_NOT_SUBMITTED') {
      Alert.alert(
        'KYC Verification Required',
        'You must submit your KYC verification before offering rides as a Driver.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Verify KYC Now', onPress: () => router.push('/kyc') },
        ]
      );
    } else if (res.error === 'KYC_PENDING') {
      Alert.alert(
        'KYC Review Pending',
        'Your KYC verification has been submitted and is awaiting Admin review.',
        [{ text: 'OK', style: 'default' }]
      );
    } else {
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
                <Image
                  source={{ uri: avatarUri }}
                  style={styles.avatar}
                  onError={() => setAvatarUri(defaultAvatar)}
                />
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
                      {displayRole === 'driver' ? 'Rider / Driver' : 'Passenger'}
                    </Text>
                  </View>
                  <View style={styles.ratingBadge}>
                    <Ionicons name="star" size={13} color="#FFF" />
                    <Text style={styles.ratingText}>
                      {userRating.hasRatings
                        ? `${userRating.average.toFixed(1)} (${userRating.count})`
                        : 'No ratings yet'}
                    </Text>
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
                Switch to {displayRole === 'driver' ? 'Passenger Mode' : 'Rider / Driver Mode'}
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
                  const isVerified = user?.kycVerified === true || user?.kycStatus === 'VERIFIED';
                  const isPending = !isVerified && user?.kycStatus === 'PENDING';
                  const isRejected = !isVerified && user?.kycStatus === 'REJECTED';

                  if (isVerified) {
                    return <Text style={[styles.detailValue, { color: Colors.success }]}>Verified ✓</Text>;
                  } else if (isPending) {
                    return (
                      <Text style={[styles.detailValue, { color: '#F59E0B' }]}>Pending Admin Review ⏳</Text>
                    );
                  } else if (isRejected) {
                    return (
                      <View style={{ marginTop: 4 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={[styles.detailValue, { color: Colors.error, marginTop: 0 }]}>Rejected ✕</Text>
                          <TouchableOpacity
                            style={styles.completeKycButton}
                            onPress={() => router.push('/kyc')}
                          >
                            <Text style={styles.completeKycText}>Re-submit KYC →</Text>
                          </TouchableOpacity>
                        </View>
                        <View style={styles.rejectionReasonBox}>
                          <Text style={styles.rejectionReasonLabel}>Rejection Reason:</Text>
                          <Text style={styles.rejectionReasonValue}>
                            {user?.kycRejectionReason || 'Document photo was unreadable or invalid.'}
                          </Text>
                        </View>
                      </View>
                    );
                  } else {
                    return (
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                        <Text style={[styles.detailValue, { color: Colors.textMuted, marginTop: 0 }]}>Not Submitted</Text>
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

            {/* My Vehicles Button (Driver/Rider Mode Only) */}
            {displayRole === 'driver' && (
              <>
                <TouchableOpacity style={styles.settingRow} onPress={() => router.push('/vehicles')} activeOpacity={0.7}>
                  <Ionicons name="car-sport-outline" size={20} color={Colors.primary} />
                  <Text style={styles.settingRowText}>My Vehicles</Text>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                </TouchableOpacity>

                <View style={styles.divider} />
              </>
            )}

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

                {/* 2. Change Password */}
                <TouchableOpacity style={styles.subSettingRow} onPress={() => setChangePasswordModalVisible(true)} activeOpacity={0.7}>
                  <Ionicons name="key-outline" size={18} color={Colors.primary} />
                  <Text style={styles.subSettingRowText}>Change Password</Text>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                </TouchableOpacity>

                <View style={styles.subDivider} />

                {/* 3. Delete Account */}
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
            <Text style={styles.versionText}>
              Sarathi v{Constants.expoConfig?.version || '1.0.0'}
            </Text>
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

            <View style={styles.fieldHeaderRow}>
              <Text style={styles.fieldLabel}>Email</Text>
              <Text style={styles.readOnlyTag}>Cannot be changed</Text>
            </View>
            <View style={[styles.fieldRow, styles.fieldRowDisabled]}>
              <Ionicons name="mail-outline" size={18} color={Colors.textMuted} style={styles.fieldIcon} />
              <TextInput
                style={[styles.fieldInput, styles.fieldInputDisabled]}
                value={editEmail}
                editable={false}
                placeholder="Your email"
                placeholderTextColor={Colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Ionicons name="lock-closed" size={14} color={Colors.textMuted} />
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

      {/* ── Change Password Modal ────────────────────────────────────────────── */}
      <Modal visible={changePasswordModalVisible} animationType="slide" transparent onRequestClose={() => setChangePasswordModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <TouchableOpacity onPress={() => setChangePasswordModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>New Password</Text>
            <View style={styles.fieldRow}>
              <Ionicons name="lock-closed-outline" size={18} color={Colors.primary} style={styles.fieldIcon} />
              <TextInput
                style={styles.fieldInput}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter new password (min 6 chars)"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[styles.saveProfileBtn, isChangingPassword && { opacity: 0.65 }]}
              onPress={handleChangePasswordSubmit}
              disabled={isChangingPassword}
            >
              {isChangingPassword
                ? <ActivityIndicator size="small" color="#FFF" />
                : <Text style={styles.saveProfileBtnText}>Update Password</Text>}
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
  rejectionReasonBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  rejectionReasonLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#991B1B',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  rejectionReasonValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B91C1C',
    lineHeight: 16,
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
  fieldHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  readOnlyTag: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: 6,
    marginTop: 4,
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
  fieldRowDisabled: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  fieldInputDisabled: {
    color: Colors.textMuted,
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
