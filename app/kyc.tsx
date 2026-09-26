import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';

type DocumentType = 'NID' | 'CITIZENSHIP' | 'PASSPORT';

interface DocTypeOption {
  type: DocumentType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
}

const DOCUMENT_TYPES: DocTypeOption[] = [
  {
    type: 'NID',
    label: 'National Identity Card (NID)',
    icon: 'card-outline',
    description: 'National biometric identity card',
  },
  {
    type: 'CITIZENSHIP',
    label: 'Citizenship Certificate',
    icon: 'document-text-outline',
    description: 'Government citizenship document',
  },
  {
    type: 'PASSPORT',
    label: 'Passport',
    icon: 'id-card-outline',
    description: 'International travel passport',
  },
];

export default function KYCScreen() {
  const { user, refreshKycStatus } = useApp();
  const [selectedDocType, setSelectedDocType] = useState<DocumentType>('NID');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [activeImageField, setActiveImageField] = useState<'id_front' | 'license_front'>('id_front');
  
  const [idNumber, setIdNumber] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [idFrontUri, setIdFrontUri] = useState('');
  const [licenseFrontUri, setLicenseFrontUri] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedDocObj = DOCUMENT_TYPES.find(d => d.type === selectedDocType) || DOCUMENT_TYPES[0];

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleImagePicked = (uri: string) => {
    if (activeImageField === 'id_front') {
      setIdFrontUri(uri);
    } else {
      setLicenseFrontUri(uri);
    }
  };

  // Gallery Picker
  const pickFromGallery = async () => {
    setIsSourceModalOpen(false);
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Denied', 'Permission to access photo library is required.');
        return;
      }

      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!pickerResult.canceled && pickerResult.assets && pickerResult.assets.length > 0) {
        handleImagePicked(pickerResult.assets[0].uri);
      }
    } catch (err) {
      console.error('[pickFromGallery] Error:', err);
      Alert.alert('Error', 'Failed to pick image from gallery.');
    }
  };

  // Camera Capture
  const captureFromCamera = async () => {
    setIsSourceModalOpen(false);
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Denied', 'Permission to access camera is required.');
        return;
      }

      const cameraResult = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });

      if (!cameraResult.canceled && cameraResult.assets && cameraResult.assets.length > 0) {
        handleImagePicked(cameraResult.assets[0].uri);
      }
    } catch (err) {
      console.error('[captureFromCamera] Error:', err);
      Alert.alert('Error', 'Failed to capture photo with camera.');
    }
  };

  const handleSubmit = async () => {
    if (!idFrontUri) {
      Alert.alert('Missing Photo', `Please upload a clear photo of your ${selectedDocObj.label}.`);
      return;
    }
    if (!licenseFrontUri) {
      Alert.alert('Missing Photo', 'Driving License photo is compulsory for drivers. Please upload your license photo.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (!user?.id) {
        Alert.alert('Error', 'User is not authenticated.');
        setIsSubmitting(false);
        return;
      }

      // Helper function to upload local mobile image URI to Supabase Storage or convert to data URI
      const uploadKycImage = async (uri: string, prefix: string): Promise<string> => {
        if (!uri || (!uri.startsWith('file:') && !uri.startsWith('content:') && !uri.startsWith('blob:') && !uri.startsWith('data:'))) {
          return uri; // Already a remote web URL
        }

        const filePath = `${user.id}/${prefix}_${Date.now()}.jpg`;
        let uploadBody: any;
        let contentType = 'image/jpeg';
        let base64DataUri = '';

        try {
          if (Platform.OS === 'web') {
            const resp = await fetch(uri);
            uploadBody = await resp.blob();
            if (uploadBody.type) contentType = uploadBody.type;
          } else {
            uploadBody = await new Promise((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.onload = () => {
                const reader = new FileReader();
                reader.onloadend = () => {
                  if (typeof reader.result === 'string') {
                    base64DataUri = reader.result;
                  }
                };
                reader.readAsDataURL(xhr.response);
                resolve(xhr.response);
              };
              xhr.onerror = (e) => reject(new TypeError('Network request failed'));
              xhr.responseType = 'blob';
              xhr.open('GET', uri, true);
              xhr.send(null);
            });
          }
        } catch (readErr) {
          console.warn('[KYC Upload] Blob conversion warning:', readErr);
        }

        // Try primary bucket: 'kyc-documents'
        const { error: storageErr } = await supabase.storage
          .from('kyc-documents')
          .upload(filePath, uploadBody, { contentType, upsert: true });

        if (!storageErr) {
          const { data: publicUrlData } = supabase.storage.from('kyc-documents').getPublicUrl(filePath);
          return publicUrlData?.publicUrl || uri;
        }

        // Try secondary bucket: 'avatars'
        const { error: avatarStorageErr } = await supabase.storage
          .from('avatars')
          .upload(filePath, uploadBody, { contentType, upsert: true });

        if (!avatarStorageErr) {
          const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
          return publicUrlData?.publicUrl || uri;
        }

        // Fallback: Return Base64 Data URI if storage bucket is missing in Supabase dashboard
        if (base64DataUri && base64DataUri.startsWith('data:image')) {
          return base64DataUri;
        }

        return uri;
      };

      const uploadedIdFrontUrl = await uploadKycImage(idFrontUri, 'id_front');
      const uploadedLicenseFrontUrl = await uploadKycImage(licenseFrontUri, 'license_front');

      // Check for existing record ID to safely update instead of inserting duplicate key
      const { data: existingRecord } = await supabase
        .from('kyc_verifications')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      const kycPayload: any = {
        user_id: user.id,
        id_type: selectedDocType.toLowerCase(),
        id_number: 'UPLOADED_DOCUMENT',
        license_number: 'UPLOADED_LICENSE',
        id_front_image: uploadedIdFrontUrl,
        license_front_image: uploadedLicenseFrontUrl,
        status: 'pending',
        rejection_reason: null,
        submitted_at: new Date().toISOString(),
      };

      if (existingRecord?.id) {
        kycPayload.id = existingRecord.id;
      }

      const { error } = await supabase
        .from('kyc_verifications')
        .upsert(kycPayload, { onConflict: 'user_id' });

      setIsSubmitting(false);

      if (error) {
        Alert.alert('Submission Error', error.message);
        return;
      }

      await refreshKycStatus();

      const isResubmission = user?.kycStatus === 'REJECTED';
      Alert.alert(
        isResubmission ? 'KYC Resubmitted' : 'KYC Submitted',
        isResubmission
          ? 'Your updated document photos have been resubmitted successfully and are pending admin review.'
          : 'Your document photos (Identity + Driving License) have been submitted successfully and are pending admin review.',
        [{ text: 'Done', onPress: () => router.replace('/(tabs)') }]
      );
    } catch (err: any) {
      setIsSubmitting(false);
      Alert.alert('Error', err.message || 'Failed to submit KYC.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Driver KYC Verification</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Rejection Banner if previously rejected */}
          {user?.kycStatus === 'REJECTED' && (
            <View style={styles.rejectionBanner}>
              <Ionicons name="alert-circle" size={26} color="#DC2626" />
              <View style={{ flex: 1 }}>
                <Text style={styles.rejectionBannerTitle}>Previous Request Rejected</Text>
                <Text style={styles.rejectionBannerReason}>
                  Reason: {user.kycRejectionReason || 'Document photo was unreadable or invalid.'}
                </Text>
                <Text style={styles.rejectionBannerSub}>
                  Please upload clear, valid photos of your documents to re-submit your verification.
                </Text>
              </View>
            </View>
          )}

          {/* Banner */}
          <View style={styles.introCard}>
            <Ionicons name="shield-checkmark" size={32} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.introTitle}>Verify Your Identity & License</Text>
              <Text style={styles.introText}>
                Simply upload clear photos of your primary ID (NID / Citizenship / Passport) and your compulsory Driving License.
              </Text>
            </View>
          </View>

          {/* SECTION 1: IDENTITY DOCUMENT */}
          <Text style={styles.sectionHeader}>SECTION 1: Government Identity Document</Text>

          {/* 1. Document Type Dropdown */}
          <Text style={styles.inputLabel}>1. Select Identity Document Type</Text>
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => setIsDropdownOpen(!isDropdownOpen)}
            activeOpacity={0.85}
          >
            <View style={styles.dropdownLeft}>
              <Ionicons name={selectedDocObj.icon} size={22} color={Colors.primary} />
              <View>
                <Text style={styles.dropdownSelectedLabel}>{selectedDocObj.label}</Text>
                <Text style={styles.dropdownSelectedDesc}>{selectedDocObj.description}</Text>
              </View>
            </View>
            <Ionicons name={isDropdownOpen ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.textMuted} />
          </TouchableOpacity>

          {/* Dropdown Menu Options */}
          {isDropdownOpen && (
            <View style={styles.dropdownMenu}>
              {DOCUMENT_TYPES.map(item => {
                const isSelected = selectedDocType === item.type;
                return (
                  <TouchableOpacity
                    key={item.type}
                    style={[styles.dropdownMenuItem, isSelected && styles.dropdownMenuItemSelected]}
                    onPress={() => {
                      setSelectedDocType(item.type);
                      setIsDropdownOpen(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={item.icon} size={20} color={isSelected ? Colors.primary : Colors.textMuted} />
                    <Text style={[styles.dropdownItemText, isSelected && styles.dropdownItemTextSelected]}>
                      {item.label}
                    </Text>
                    {isSelected && <Ionicons name="checkmark" size={18} color={Colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Identity Document Photo */}
          <Text style={styles.inputLabel}>2. Upload {selectedDocObj.label} Photo *</Text>
          <TouchableOpacity
            style={styles.uploadCard}
            onPress={() => {
              setActiveImageField('id_front');
              setIsSourceModalOpen(true);
            }}
            activeOpacity={0.85}
          >
            {idFrontUri ? (
              <View style={styles.fileSelectedContainer}>
                <View style={styles.fileIconBadge}>
                  <Ionicons name="document-attach" size={28} color={Colors.primary} />
                </View>
                <View style={styles.fileTextContainer}>
                  <Text style={styles.fileStatusTitle}>Identity Photo Attached</Text>
                  <Text style={styles.fileNameText} numberOfLines={1} ellipsizeMode="middle">
                    {selectedDocObj.label} Photo
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.changeFileButton}
                  onPress={() => {
                    setActiveImageField('id_front');
                    setIsSourceModalOpen(true);
                  }}
                >
                  <Text style={styles.changeFileText}>Change</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.uploadPlaceholder}>
                <View style={styles.iconCircleRow}>
                  <View style={styles.iconCircle}>
                    <Ionicons name="camera" size={24} color={Colors.primary} />
                  </View>
                  <Text style={styles.orText}>OR</Text>
                  <View style={styles.iconCircle}>
                    <Ionicons name="cloud-upload" size={24} color={Colors.primary} />
                  </View>
                </View>
                <Text style={styles.uploadTitle}>Tap to Upload {selectedDocObj.label} Photo</Text>
                <Text style={styles.uploadSubtitle}>Clear photo showing full front document</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* SECTION 2: DRIVING LICENSE (COMPULSORY) */}
          <Text style={styles.sectionHeader}>SECTION 2: Driving License Document (Compulsory)</Text>

          {/* Driving License Photo */}
          <Text style={styles.inputLabel}>3. Upload Driving License Photo *</Text>
          <TouchableOpacity
            style={styles.uploadCard}
            onPress={() => {
              setActiveImageField('license_front');
              setIsSourceModalOpen(true);
            }}
            activeOpacity={0.85}
          >
            {licenseFrontUri ? (
              <View style={styles.fileSelectedContainer}>
                <View style={styles.fileIconBadge}>
                  <Ionicons name="ribbon-outline" size={28} color={Colors.primary} />
                </View>
                <View style={styles.fileTextContainer}>
                  <Text style={styles.fileStatusTitle}>Driving License Photo Attached</Text>
                  <Text style={styles.fileNameText} numberOfLines={1} ellipsizeMode="middle">
                    Official Driving License Document
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.changeFileButton}
                  onPress={() => {
                    setActiveImageField('license_front');
                    setIsSourceModalOpen(true);
                  }}
                >
                  <Text style={styles.changeFileText}>Change</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.uploadPlaceholder}>
                <View style={styles.iconCircleRow}>
                  <View style={styles.iconCircle}>
                    <Ionicons name="camera" size={24} color={Colors.primary} />
                  </View>
                  <Text style={styles.orText}>OR</Text>
                  <View style={styles.iconCircle}>
                    <Ionicons name="cloud-upload" size={24} color={Colors.primary} />
                  </View>
                </View>
                <Text style={styles.uploadTitle}>Tap to Upload Driving License Photo</Text>
                <Text style={styles.uploadSubtitle}>Clear photo showing valid license details</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && { opacity: 0.65 }]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.9}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Text style={styles.submitText}>Submit for Verification</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Upload/Capture Action Modal */}
      <Modal
        visible={isSourceModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsSourceModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsSourceModalOpen(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Choose Photo Option</Text>

            <TouchableOpacity style={styles.modalOptionBtn} onPress={captureFromCamera} activeOpacity={0.8}>
              <View style={[styles.modalOptionIcon, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="camera" size={22} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalOptionTitle}>Capture Image</Text>
                <Text style={styles.modalOptionSubtitle}>Take photo directly using camera</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </TouchableOpacity>

            <View style={styles.modalDivider} />

            <TouchableOpacity style={styles.modalOptionBtn} onPress={pickFromGallery} activeOpacity={0.8}>
              <View style={[styles.modalOptionIcon, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="images" size={22} color="#16A34A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalOptionTitle}>Upload from Gallery</Text>
                <Text style={styles.modalOptionSubtitle}>Choose existing image from photos</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setIsSourceModalOpen(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 48,
  },
  rejectionBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  rejectionBannerTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#991B1B',
    marginBottom: 4,
  },
  rejectionBannerReason: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B91C1C',
    marginBottom: 4,
  },
  rejectionBannerSub: {
    fontSize: 12,
    color: '#7F1D1D',
    lineHeight: 16,
  },
  introCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.accent + '25',
    marginBottom: 20,
  },
  introTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 4,
  },
  introText: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 16,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 20,
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
    marginTop: 12,
  },
  textInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 12,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  dropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  dropdownSelectedLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  dropdownSelectedDesc: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  dropdownMenu: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  dropdownMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownMenuItemSelected: {
    backgroundColor: Colors.primary + '0D',
  },
  dropdownItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
  },
  dropdownItemTextSelected: {
    color: Colors.primary,
    fontWeight: '700',
  },
  uploadCard: {
    minHeight: 120,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    justifyContent: 'center',
  },
  uploadPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  iconCircleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMuted,
  },
  uploadTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginTop: 4,
  },
  uploadSubtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  fileSelectedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
    backgroundColor: Colors.primary + '08',
  },
  fileIconBadge: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: Colors.primary + '1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileTextContainer: {
    flex: 1,
  },
  fileStatusTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.success,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fileNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 2,
  },
  changeFileButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: '#FFFFFF',
  },
  changeFileText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 16,
    marginTop: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  submitText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 16,
  },
  modalOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
  },
  modalOptionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOptionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  modalOptionSubtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 4,
  },
  modalCancelBtn: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textMuted,
  },
});

