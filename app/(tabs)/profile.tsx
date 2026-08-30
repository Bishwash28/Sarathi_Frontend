import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Image, ImageBackground, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../constants/Colors';
import { useApp } from '../../context/AppContext';

export default function ProfileScreen() {
  const { user, completeProfile, updateEmergencyContact, logout } = useApp();
  const [emergencyContact, setEmergencyContact] = useState(user?.emergencyContact || '');
  const [isEditingContact, setIsEditingContact] = useState(false);

  const handleSaveContact = () => {
    updateEmergencyContact(emergencyContact);
    setIsEditingContact(false);
    Alert.alert('Success', 'Emergency contact updated successfully.');
  };

  const handleLogout = () => {
    logout();
    router.replace('/(auth)/login');
  };

  const handleSwitchMode = () => {
    if (user?.role === 'driver') {
      completeProfile({ role: 'passenger' });
    } else {
      if (user?.kycVerified !== undefined) {
        completeProfile({ role: 'driver' });
      } else {
        router.push('/kyc');
      }
    }
  };

  return (
    <View style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Fixed Profile Header */}
        <ImageBackground
          source={require('../../assets/images/home_top1.png')} 
          style={styles.profileHeaderCard}
          imageStyle={styles.profileHeaderImageStyle}
        >
          <Image
            source={{ uri: user?.photo || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&h=200&q=80' }}
            style={styles.avatar}
          />
          <Text style={styles.userName}>{user?.name || 'Sakar Aryal'}</Text>

          <View style={styles.badgeRow}>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>VERIFIED MEMBER</Text>
            </View>
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={14} color="#FFF" />
              <Text style={styles.ratingText}>{user?.rating?.toFixed(1) || '4.8'}</Text>
            </View>
          </View>
        </ImageBackground>

        {/* Scrollable Content Below */}
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* KYC Status & Driver details section (Only in Driver role) */}
          {user?.role === 'driver' && user?.kycVerified !== undefined && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>KYC & Vehicle Status</Text>
              
              <View style={styles.detailRow}>
                <Ionicons 
                  name={user.kycVerified ? "shield-checkmark-outline" : "shield-outline"} 
                  size={20} 
                  color={user.kycVerified ? Colors.success : Colors.warning} 
                />
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>Verification Status</Text>
                  <Text style={[styles.detailValue, { color: user.kycVerified ? Colors.success : Colors.warning }]}>
                    {user.kycVerified ? 'Verified Driver' : 'Pending Verification'}
                  </Text>
                </View>
              </View>

              {!user.kycVerified && (
                <TouchableOpacity 
                  style={styles.completeKycButton} 
                  onPress={() => router.push('/kyc')}
                >
                  <Text style={styles.completeKycText}>Complete KYC Verification</Text>
                  <Ionicons name="arrow-forward" size={14} color={Colors.primary} />
                </TouchableOpacity>
              )}

              {user.kycVerified && (
                <>
                  <View style={styles.divider} />
                  <View style={styles.detailRow}>
                    <Ionicons name="bicycle-outline" size={20} color={Colors.textMuted} />
                    <View style={styles.detailTextContainer}>
                      <Text style={styles.detailLabel}>Registered Vehicle</Text>
                      <Text style={styles.detailValue}>{user.vehicleName} ({user.vehicleType?.toUpperCase()})</Text>
                    </View>
                  </View>
                  
                  <View style={styles.divider} />
                  <View style={styles.detailRow}>
                    <Ionicons name="barcode-outline" size={20} color={Colors.textMuted} />
                    <View style={styles.detailTextContainer}>
                      <Text style={styles.detailLabel}>Plate Number</Text>
                      <Text style={styles.detailValue}>{user.vehicleNumber}</Text>
                    </View>
                  </View>
                </>
              )}
            </View>
          )}

          {/* User Details Section */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Account Details</Text>

            {/* Email */}
            <View style={styles.detailRow}>
              <Ionicons name="mail-outline" size={20} color={Colors.textMuted} />
              <View style={styles.detailTextContainer}>
                <Text style={styles.detailLabel}>Email Address</Text>
                <Text style={styles.detailValue}>{user?.email || 'sakar@sarathi.com'}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Phone */}
            <View style={styles.detailRow}>
              <Ionicons name="phone-portrait-outline" size={20} color={Colors.textMuted} />
              <View style={styles.detailTextContainer}>
                <Text style={styles.detailLabel}>Phone Number</Text>
                <Text style={styles.detailValue}>{user?.phone || '9841234567'}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* College / Company */}
            <View style={styles.detailRow}>
              <Ionicons name="business-outline" size={20} color={Colors.textMuted} />
              <View style={styles.detailTextContainer}>
                <Text style={styles.detailLabel}>College / Company</Text>
                <Text style={styles.detailValue}>{user?.collegeOrCompany || 'Tribhuvan University'}</Text>
              </View>
            </View>
          </View>

          {/* Emergency Contacts Section */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Emergency Contact</Text>
              {!isEditingContact && (
                <TouchableOpacity onPress={() => setIsEditingContact(true)}>
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>
              )}
            </View>

            {isEditingContact ? (
              <View style={styles.editContactContainer}>
                <TextInput
                  style={styles.contactInput}
                  value={emergencyContact}
                  onChangeText={setEmergencyContact}
                  placeholder="Enter emergency phone number"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="phone-pad"
                />
                <View style={styles.editActionRow}>
                  <TouchableOpacity style={styles.cancelButton} onPress={() => setIsEditingContact(false)}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.saveButton} onPress={handleSaveContact}>
                    <Text style={styles.saveButtonText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.detailRow}>
                <Ionicons name="alert-circle-outline" size={20} color={Colors.accent} />
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>Primary Contact</Text>
                  <Text style={styles.detailValue}>
                    {user?.emergencyContact || 'Not set (tap edit to add)'}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Offer a Ride / Driver Mode Switcher Banner */}
          <TouchableOpacity
            style={styles.driverBanner}
            onPress={() => {
              if (user?.role === 'driver') {
                completeProfile({ role: 'passenger' });
              } else if (user?.kycVerified === true) {
                completeProfile({ role: 'driver' });
              } else {
                Alert.alert(
                  'KYC Verification Required',
                  'You must complete driver KYC verification (ID & vehicle details) before offering rides on Sarathi.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Verify KYC Now', onPress: () => router.push('/kyc') }
                  ]
                );
              }
            }}
          >
            <View style={[styles.driverBannerIcon, user?.role === 'driver' && { backgroundColor: Colors.accent }]}>
              <Ionicons name={user?.role === 'driver' ? "swap-horizontal" : "car"} size={24} color="#FFF" />
            </View>
            <View style={styles.driverBannerTextContainer}>
              <Text style={styles.driverBannerTitle}>
                {user?.role === 'driver' ? 'Switch to Passenger Mode' : 'Offer a Ride (Driver Workspace)'}
              </Text>
              <Text style={styles.driverBannerSubtitle}>
                {user?.role === 'driver'
                  ? 'Return to search and book rides'
                  : user?.kycVerified
                    ? 'Open driver workspace to post routes and manage requests'
                    : 'Requires KYC verification to offer rides'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
          </TouchableOpacity>

          {/* Logout Button */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color={Colors.error} />
            <Text style={styles.logoutButtonText}>Log Out</Text>
          </TouchableOpacity>

          {/* App Version Footer */}
          <View style={styles.versionFooter}>
            <Text style={styles.versionText}>Sarathi v1.0.0</Text>
          </View>

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
  keyboardContainer: {
    flex: 1,
  },
  profileHeaderCard: {
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    zIndex: 10,
  },
  profileHeaderImageStyle: {
    resizeMode: 'cover',
    opacity: 0.9,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    borderColor: '#FFF',
    marginBottom: 12,
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  roleBadge: {
    backgroundColor: Colors.primary,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 6,
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
  scrollContent: {
    paddingBottom: 120,
  },
  sectionCard: {
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 12,
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
    marginBottom: 20,
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
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    gap: 8,
  },
  logoutButtonText: {
    color: Colors.error,
    fontWeight: 'bold',
    fontSize: 14,
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
});
