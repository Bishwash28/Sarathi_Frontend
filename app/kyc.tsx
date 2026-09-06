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
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { useApp } from '../context/AppContext';

type DocumentType = 'DRIVING_LICENSE' | 'CITIZENSHIP' | 'PASSPORT' | 'VOTER_ID';

interface DocTypeOption {
  type: DocumentType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
}

const DOCUMENT_TYPES: DocTypeOption[] = [
  {
    type: 'DRIVING_LICENSE',
    label: 'Driving License',
    icon: 'car-outline',
    description: 'Driver identification document',
  },
  {
    type: 'CITIZENSHIP',
    label: 'Citizenship Certificate',
    icon: 'card-outline',
    description: 'National identity document',
  },
  {
    type: 'PASSPORT',
    label: 'Passport',
    icon: 'document-text-outline',
    description: 'International passport document',
  },
  {
    type: 'VOTER_ID',
    label: 'Voter ID Card',
    icon: 'person-circle-outline',
    description: 'Government-issued voter ID card',
  },
];

export default function KYCScreen() {
  const { uploadUserKycDocument, submitKycVerify } = useApp();
  const [selectedDocType, setSelectedDocType] = useState<DocumentType>('DRIVING_LICENSE');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [documentUri, setDocumentUri] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedDocObj = DOCUMENT_TYPES.find(d => d.type === selectedDocType) || DOCUMENT_TYPES[0];

  const handleBack = () => {
    router.back();
  };

  // Gallery Picker
  const pickFromGallery = async () => {
    setIsSourceModalOpen(false);
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Denied', 'Permission to access photo library is required to select document photo.');
        return;
      }

      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!pickerResult.canceled && pickerResult.assets && pickerResult.assets.length > 0) {
        const asset = pickerResult.assets[0];
        setDocumentUri(asset.uri);
        const name = asset.fileName || `${selectedDocType.toLowerCase()}_${Date.now()}.jpg`;
        setFileName(name);
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
        Alert.alert('Permission Denied', 'Camera permission is required to capture document photo.');
        return;
      }

      const cameraResult = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });

      if (!cameraResult.canceled && cameraResult.assets && cameraResult.assets.length > 0) {
        const asset = cameraResult.assets[0];
        setDocumentUri(asset.uri);
        const name = asset.fileName || `${selectedDocType.toLowerCase()}_camera_${Date.now()}.jpg`;
        setFileName(name);
      }
    } catch (err) {
      console.error('[captureFromCamera] Error:', err);
      Alert.alert('Error', 'Failed to capture photo with camera.');
    }
  };

  const handleSubmit = async () => {
    if (!documentUri) {
      Alert.alert('Missing Document', 'Please select or capture your KYC document photo.');
      return;
    }

    setIsSubmitting(true);

    // POST /api/users/{userId}/kyc/document
    const uploadRes = await uploadUserKycDocument(selectedDocType, documentUri, fileName || 'document.jpg');
    setIsSubmitting(false);

    if (!uploadRes.success) {
      Alert.alert('Upload Failed', uploadRes.error || 'Failed to upload KYC document.');
      return;
    }

    Alert.alert(
      'KYC Document Submitted',
      'Your KYC document has been uploaded successfully and is currently pending verification by the admin.',
      [
        {
          text: 'Done',
          onPress: () => router.replace('/(tabs)'),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>KYC Verification</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Banner */}
          <View style={styles.introCard}>
            <Ionicons name="shield-checkmark" size={32} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.introTitle}>Verify Your Identity</Text>
              <Text style={styles.introText}>
                Select a document type and upload or capture a clear photo of your official ID document to submit for verification.
              </Text>
            </View>
          </View>

          {/* 1. Document Type Dropdown */}
          <Text style={styles.inputLabel}>1. Select Document Type</Text>
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
                      setDocumentUri('');
                      setFileName('');
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

          {/* 2. Document Upload / Capture Area */}
          <Text style={styles.inputLabel}>2. Document File / Photo</Text>
          <TouchableOpacity
            style={styles.uploadCard}
            onPress={() => setIsSourceModalOpen(true)}
            activeOpacity={0.85}
          >
            {documentUri ? (
              <View style={styles.fileSelectedContainer}>
                <View style={styles.fileIconBadge}>
                  <Ionicons name="document-attach" size={28} color={Colors.primary} />
                </View>
                <View style={styles.fileTextContainer}>
                  <Text style={styles.fileStatusTitle}>Document Attached</Text>
                  <Text style={styles.fileNameText} numberOfLines={1} ellipsizeMode="middle">
                    {fileName.length > 25 ? `${fileName.substring(0, 12)}...${fileName.substring(fileName.length - 10)}` : fileName}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.changeFileButton}
                  onPress={() => setIsSourceModalOpen(true)}
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
                <Text style={styles.uploadTitle}>Tap to Upload or Capture Document</Text>
                <Text style={styles.uploadSubtitle}>Take photo with camera or choose from gallery</Text>
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
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 10,
    marginTop: 12,
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

