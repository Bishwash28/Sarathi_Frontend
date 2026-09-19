import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
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
export interface VehicleData {
  id: string;
  userId?: string;
  vehicleNumber: string;
  vehicleModelName: string;
  images?: string[];
  vehicleType?: 'bike' | 'scooter';
  createdAt?: string;
}

export default function VehiclesScreen() {
  const { user } = useApp();
  const [token, setToken] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<VehicleData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<VehicleData | null>(null);
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleModelName, setVehicleModelName] = useState('');
  const [vehicleImages, setVehicleImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // View Details Modal State
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleData | null>(null);
  const [isFetchingDetail, setIsFetchingDetail] = useState(false);

  useEffect(() => {
    setVehicles([]);
    setIsLoading(false);
  }, []);

  const handleBack = () => {
    router.back();
  };

  const openAddModal = () => {
    setEditingVehicle(null);
    setVehicleNumber('');
    setVehicleModelName('');
    setVehicleImages([]);
    setModalVisible(true);
  };

  const openEditModal = (v: VehicleData) => {
    setEditingVehicle(v);
    setVehicleNumber(v.vehicleNumber);
    setVehicleModelName(v.vehicleModelName);
    setVehicleImages(v.images || []);
    setModalVisible(true);
  };

  const openViewModal = (v: VehicleData) => {
    setSelectedVehicle(v);
    setViewModalVisible(true);
  };

  // Image Picker for vehicle photos (Gallery)
  const pickVehicleFromGallery = async () => {
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
        const selectedUri = pickerResult.assets[0].uri;
        setVehicleImages(prev => [...prev, selectedUri]);
      }
    } catch (err) {
      console.error('[pickVehicleFromGallery] Error:', err);
    }
  };

  // Camera Capture for vehicle photos
  const captureVehiclePhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Denied', 'Camera permission is required to capture vehicle photo.');
        return;
      }
      const cameraResult = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });

      if (!cameraResult.canceled && cameraResult.assets && cameraResult.assets.length > 0) {
        const capturedUri = cameraResult.assets[0].uri;
        setVehicleImages(prev => [...prev, capturedUri]);
      }
    } catch (err) {
      console.error('[captureVehiclePhoto] Error:', err);
    }
  };

  const removeVehicleImage = (index: number) => {
    setVehicleImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveVehicle = async () => {
    if (!vehicleNumber.trim()) {
      Alert.alert('Missing Field', 'Please enter your license plate / vehicle number.');
      return;
    }
    if (!vehicleModelName.trim()) {
      Alert.alert('Missing Field', 'Please enter your vehicle model name.');
      return;
    }

    if (!user?.id) {
      Alert.alert('Auth Error', 'You must be logged in to register a vehicle.');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.from('vehicles').insert({
        user_id: user.id,
        vehicle_name: vehicleModelName.trim(),
        vehicle_type: 'car',
        number_plate: vehicleNumber.trim().toUpperCase(),
        vehicle_image: vehicleImages[0] || null,
        seats_available: 4,
        status: 'active',
      }).select().single();

      setIsSubmitting(false);

      if (error) {
        Alert.alert('Registration Error', error.message);
        return;
      }

      setVehicles(prev => [{
        id: data.id,
        userId: user.id,
        vehicleNumber: data.number_plate,
        vehicleModelName: data.vehicle_name,
        images: data.vehicle_image ? [data.vehicle_image] : [],
      }, ...prev]);

      Alert.alert('Success', 'Vehicle registered successfully.');
      setModalVisible(false);
    } catch (err: any) {
      setIsSubmitting(false);
      Alert.alert('Error', err.message || 'Failed to save vehicle.');
    }
  };

  const handleDeleteVehicle = (id: string, name: string) => {
    Alert.alert(
      'Delete Vehicle',
      `Are you sure you want to delete ${name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setVehicles(prev => prev.filter(v => v.id !== id));
            if (selectedVehicle?.id === id) setViewModalVisible(false);
            Alert.alert('Deleted', 'Vehicle removed successfully.');
          },
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
        <Text style={styles.headerTitle}>My Vehicles</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Primary Add Vehicle Action Button */}
        <TouchableOpacity style={styles.primaryAddBtn} onPress={openAddModal} activeOpacity={0.85}>
          <Ionicons name="add-circle" size={22} color="#FFFFFF" />
          <Text style={styles.primaryAddBtnText}>Add New Vehicle</Text>
        </TouchableOpacity>

        {/* Vehicles List */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Registered Vehicles ({vehicles.length})</Text>
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginVertical: 32 }} />
        ) : vehicles.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="car-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No Vehicles Registered</Text>
            <Text style={styles.emptySubtitle}>
              Tap the button below to add your first bike or scooter vehicle.
            </Text>
            <TouchableOpacity style={styles.registerFirstBtn} onPress={openAddModal}>
              <Ionicons name="add" size={18} color="#FFF" />
              <Text style={styles.registerFirstText}>Register New Vehicle</Text>
            </TouchableOpacity>
          </View>
        ) : (
          vehicles.map(v => (
            <View key={v.id} style={styles.vehicleCard}>
              <View style={styles.vehicleCardTop}>
                <View style={styles.vehicleIconCircle}>
                  <Ionicons name="car-sport" size={24} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.vehicleModelText}>{v.vehicleModelName}</Text>
                  <Text style={styles.vehiclePlateText}>{v.vehicleNumber}</Text>
                </View>
                <View style={styles.actionBtnRow}>
                  <TouchableOpacity style={styles.iconActionBtn} onPress={() => openViewModal(v)}>
                    <Ionicons name="eye-outline" size={18} color={Colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconActionBtn} onPress={() => openEditModal(v)}>
                    <Ionicons name="pencil-outline" size={18} color={Colors.accent} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconActionBtn} onPress={() => handleDeleteVehicle(v.id, v.vehicleModelName)}>
                    <Ionicons name="trash-outline" size={18} color="#DC2626" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Form Modal: Add / Edit Vehicle */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalVisible(false)}>
          <KeyboardAvoidingView style={{ width: '100%' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingVehicle ? 'Update Vehicle' : 'Register New Vehicle'}</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Vehicle Model Name *</Text>
              <View style={styles.fieldRow}>
                <Ionicons name="car-outline" size={18} color={Colors.primary} style={styles.fieldIcon} />
                <TextInput
                  style={styles.fieldInput}
                  value={vehicleModelName}
                  onChangeText={setVehicleModelName}
                  placeholder="e.g. Pulsar 220F, Vespa VXL 150"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>

              <Text style={styles.fieldLabel}>License Plate / Vehicle Number *</Text>
              <View style={styles.fieldRow}>
                <Ionicons name="barcode-outline" size={18} color={Colors.primary} style={styles.fieldIcon} />
                <TextInput
                  style={styles.fieldInput}
                  value={vehicleNumber}
                  onChangeText={setVehicleNumber}
                  placeholder="e.g. LU 1 PA 7788"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="characters"
                />
              </View>

              {/* Add / Capture Vehicle Photo Section */}
              <Text style={styles.fieldLabel}>Vehicle Image (Camera or Upload)</Text>
              <View style={styles.photoActionRow}>
                <TouchableOpacity style={styles.photoActionBtn} onPress={captureVehiclePhoto} activeOpacity={0.8}>
                  <Ionicons name="camera" size={18} color={Colors.primary} />
                  <Text style={styles.photoActionText}>Take Photo</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.photoActionBtn} onPress={pickVehicleFromGallery} activeOpacity={0.8}>
                  <Ionicons name="images" size={18} color="#16A34A" />
                  <Text style={[styles.photoActionText, { color: '#16A34A' }]}>Upload Photo</Text>
                </TouchableOpacity>
              </View>

              {vehicleImages.length > 0 && (
                <View style={styles.photoAttachedBadge}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                  <Text style={styles.photoAttachedText}>{vehicleImages.length} Photo(s) Attached</Text>
                  <TouchableOpacity onPress={() => setVehicleImages([])}>
                    <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                style={[styles.saveBtn, isSubmitting && { opacity: 0.65 }]}
                onPress={handleSaveVehicle}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.saveBtnText}>{editingVehicle ? 'Update Vehicle' : 'Register Vehicle'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* View Details Modal */}
      <Modal visible={viewModalVisible} animationType="fade" transparent onRequestClose={() => setViewModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setViewModalVisible(false)}>
          <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Vehicle Details</Text>
              <TouchableOpacity onPress={() => setViewModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {isFetchingDetail ? (
              <ActivityIndicator size="large" color={Colors.primary} style={{ marginVertical: 24 }} />
            ) : selectedVehicle ? (
              <View style={{ gap: 12 }}>
                <View style={styles.detailCardRow}>
                  <Text style={styles.detailCardLabel}>Model Name:</Text>
                  <Text style={styles.detailCardVal}>{selectedVehicle.vehicleModelName}</Text>
                </View>
                <View style={styles.detailCardRow}>
                  <Text style={styles.detailCardLabel}>License Plate:</Text>
                  <Text style={styles.detailCardVal}>{selectedVehicle.vehicleNumber}</Text>
                </View>
                {selectedVehicle.id && (
                  <View style={styles.detailCardRow}>
                    <Text style={styles.detailCardLabel}>Vehicle ID:</Text>
                    <Text style={styles.detailCardVal}>{selectedVehicle.id}</Text>
                  </View>
                )}
              </View>
            ) : null}
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
    padding: 6,
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
    padding: 16,
    paddingBottom: 48,
  },
  introCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
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
  primaryAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 20,
    elevation: 3,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  primaryAddBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
    maxWidth: 240,
  },
  registerFirstBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 16,
  },
  registerFirstText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },
  vehicleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  vehicleCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  vehicleIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleModelText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  vehiclePlateText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    marginTop: 2,
  },
  actionBtnRow: {
    flexDirection: 'row',
    gap: 6,
  },
  iconActionBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  imageListRow: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  vehicleThumbImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 6,
    marginTop: 10,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
  },
  fieldIcon: {
    marginRight: 10,
  },
  fieldInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  photoActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
    marginBottom: 8,
  },
  photoActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
  },
  photoActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  photoAttachedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  photoAttachedText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.success,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  detailCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  detailCardLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  detailCardVal: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  largeDetailImage: {
    width: 100,
    height: 100,
    borderRadius: 12,
    marginRight: 10,
  },
});
