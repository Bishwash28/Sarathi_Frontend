import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';

export interface VehicleData {
  id: string;
  userId?: string;
  vehicleNumber: string;
  vehicleModelName: string;
  vehicleType: 'bike' | 'scooter' | 'car' | 'other';
  color?: string;
  images?: string[];
  seatsAvailable?: number;
  status?: string;
  createdAt?: string;
}

export default function VehiclesScreen() {
  const { user } = useApp();
  const [vehicles, setVehicles] = useState<VehicleData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<VehicleData | null>(null);

  // Form states
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleModelName, setVehicleModelName] = useState('');
  const [vehicleType, setVehicleType] = useState<'bike' | 'scooter' | 'car' | 'other'>('bike');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehicleImages, setVehicleImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // View Details Modal State
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleData | null>(null);

  const fetchVehiclesFromSupabase = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[fetchVehiclesFromSupabase] Error:', error.message);
        Alert.alert('Database Error', 'Failed to fetch vehicles from database.');
      } else if (data) {
        const mappedVehicles: VehicleData[] = data.map((item: any) => {
          let vType: 'bike' | 'scooter' | 'car' | 'other' = item.vehicle_type || 'bike';
          if (item.vehicle_type === 'bike' && item.vehicle_name?.toLowerCase().includes('(scooter)')) {
            vType = 'scooter';
          }
          return {
            id: item.id,
            userId: item.user_id,
            vehicleNumber: item.number_plate || '',
            vehicleModelName: (item.vehicle_name || '').replace(/\s*\(scooter\)/i, ''),
            vehicleType: vType,
            color: item.color || '',
            images: item.vehicle_image ? [item.vehicle_image] : [],
            seatsAvailable: item.seats_available || 1,
            status: item.status || 'active',
            createdAt: item.created_at,
          };
        });
        setVehicles(mappedVehicles);
      }
    } catch (err: any) {
      console.error('[fetchVehiclesFromSupabase] Catch:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchVehiclesFromSupabase();
    }, [fetchVehiclesFromSupabase])
  );

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const openAddModal = () => {
    setEditingVehicle(null);
    setVehicleNumber('');
    setVehicleModelName('');
    setVehicleType('bike');
    setVehicleColor('');
    setVehicleImages([]);
    setModalVisible(true);
  };

  const openEditModal = (v: VehicleData) => {
    if (v.userId && user?.id && v.userId !== user.id) {
      Alert.alert('Unauthorized', 'You can only edit your own registered vehicles.');
      return;
    }
    setEditingVehicle(v);
    setVehicleNumber(v.vehicleNumber);
    setVehicleModelName(v.vehicleModelName);
    setVehicleType(v.vehicleType || 'bike');
    setVehicleColor(v.color || '');
    setVehicleImages(v.images || []);
    setModalVisible(true);
  };

  const openViewModal = (v: VehicleData) => {
    setSelectedVehicle(v);
    setViewModalVisible(true);
  };

  // Helper: Upload local image file to Supabase Storage bucket 'avatars'
  const uploadVehicleImageToStorage = async (imageUri: string): Promise<string | null> => {
    if (!imageUri || (!imageUri.startsWith('file:') && !imageUri.startsWith('content:') && !imageUri.startsWith('blob:'))) {
      return imageUri; // Already hosted remote URL
    }
    try {
      const filePath = `vehicles/${user?.id || 'guest'}_${Date.now()}.jpg`;

      let uploadBody: any;
      if (Platform.OS === 'web') {
        const response = await fetch(imageUri);
        uploadBody = await response.blob();
      } else {
        uploadBody = await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.onload = () => resolve(xhr.response);
          xhr.onerror = () => reject(new TypeError('Network request failed'));
          xhr.responseType = 'blob';
          xhr.open('GET', imageUri, true);
          xhr.send(null);
        });
      }

      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(filePath, uploadBody, { contentType: 'image/jpeg', upsert: true });

      if (error) {
        console.warn('[uploadVehicleImageToStorage] Upload error:', error.message);
        return null;
      }

      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      return publicUrlData?.publicUrl || null;
    } catch (err) {
      console.error('[uploadVehicleImageToStorage] Catch:', err);
      return null;
    }
  };

  // Image Pickers
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
        setVehicleImages([pickerResult.assets[0].uri]);
      }
    } catch (err) {
      console.error('[pickVehicleFromGallery] Error:', err);
    }
  };

  const captureVehiclePhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Denied', 'Camera permission is required.');
        return;
      }
      const cameraResult = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });

      if (!cameraResult.canceled && cameraResult.assets && cameraResult.assets.length > 0) {
        setVehicleImages([cameraResult.assets[0].uri]);
      }
    } catch (err) {
      console.error('[captureVehiclePhoto] Error:', err);
    }
  };

  // ── Save or Update Vehicle in Database ───────────────────────────────────────
  const handleSaveVehicle = async () => {
    if (!vehicleModelName.trim()) {
      Alert.alert('Missing Field', 'Please enter your vehicle model name.');
      return;
    }
    if (!vehicleNumber.trim()) {
      Alert.alert('Missing Field', 'Please enter your license plate / vehicle number.');
      return;
    }
    if (!user?.id) {
      Alert.alert('Auth Error', 'You must be logged in to manage vehicles.');
      return;
    }

    setIsSubmitting(true);

    try {
      let uploadedImageUrl: string | null = null;
      if (vehicleImages.length > 0) {
        uploadedImageUrl = await uploadVehicleImageToStorage(vehicleImages[0]);
      }

      const formattedPlate = vehicleNumber.trim().toUpperCase();
      const seats = vehicleType === 'car' ? 4 : 1;

      if (editingVehicle) {
        // UPDATE existing vehicle
        let saveType = vehicleType as string;
        let saveName = vehicleModelName.trim();

        let { error } = await supabase
          .from('vehicles')
          .update({
            vehicle_name: saveName,
            vehicle_type: saveType,
            number_plate: formattedPlate,
            color: vehicleColor.trim() || null,
            vehicle_image: uploadedImageUrl || editingVehicle.images?.[0] || null,
            seats_available: seats,
          })
          .eq('id', editingVehicle.id)
          .eq('user_id', user.id);

        if (error && error.message.includes('vehicles_vehicle_type_check')) {
          saveType = vehicleType === 'scooter' ? 'bike' : 'other';
          if (vehicleType === 'scooter' && !saveName.toLowerCase().includes('(scooter)')) {
            saveName = `${saveName} (scooter)`;
          }
          const { error: retryErr } = await supabase
            .from('vehicles')
            .update({
              vehicle_name: saveName,
              vehicle_type: saveType,
              number_plate: formattedPlate,
              color: vehicleColor.trim() || null,
              vehicle_image: uploadedImageUrl || editingVehicle.images?.[0] || null,
              seats_available: seats,
            })
            .eq('id', editingVehicle.id)
            .eq('user_id', user.id);

          error = retryErr;
        }

        if (error) {
          Alert.alert('Update Error', error.message);
          return;
        }
        Alert.alert('Success', 'Vehicle updated successfully.');
      } else {
        // INSERT new vehicle
        let saveType = vehicleType as string;
        let saveName = vehicleModelName.trim();

        let { error } = await supabase.from('vehicles').insert({
          user_id: user.id,
          vehicle_name: saveName,
          vehicle_type: saveType,
          number_plate: formattedPlate,
          color: vehicleColor.trim() || null,
          vehicle_image: uploadedImageUrl,
          seats_available: seats,
          status: 'active',
        });

        if (error && error.message.includes('vehicles_vehicle_type_check')) {
          saveType = vehicleType === 'scooter' ? 'bike' : 'other';
          if (vehicleType === 'scooter' && !saveName.toLowerCase().includes('(scooter)')) {
            saveName = `${saveName} (scooter)`;
          }
          const { error: retryErr } = await supabase.from('vehicles').insert({
            user_id: user.id,
            vehicle_name: saveName,
            vehicle_type: saveType,
            number_plate: formattedPlate,
            color: vehicleColor.trim() || null,
            vehicle_image: uploadedImageUrl,
            seats_available: seats,
            status: 'active',
          });

          error = retryErr;
        }

        if (error) {
          Alert.alert('Registration Error', error.message);
          return;
        }
        Alert.alert('Success', 'Vehicle registered successfully to your account.');
      }

      setModalVisible(false);
      await fetchVehiclesFromSupabase();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save vehicle to database.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Delete Vehicle from Database ─────────────────────────────────────────────
  const handleDeleteVehicle = (id: string, name: string, vehicleUserId?: string) => {
    if (vehicleUserId && user?.id && vehicleUserId !== user.id) {
      Alert.alert('Unauthorized', 'You can only delete your own registered vehicles.');
      return;
    }
    Alert.alert(
      'Delete Vehicle',
      `Are you sure you want to remove ${name} from your account?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('vehicles')
                .delete()
                .eq('id', id)
                .eq('user_id', user?.id);

              if (error) {
                Alert.alert('Delete Error', error.message);
                return;
              }

              setVehicles(prev => prev.filter(v => v.id !== id));
              if (selectedVehicle?.id === id) setViewModalVisible(false);
              Alert.alert('Deleted', 'Vehicle removed successfully.');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete vehicle.');
            }
          },
        },
      ]
    );
  };

  const getVehicleIcon = (type?: string) => {
    switch (type) {
      case 'scooter':
      case 'bike':
        return 'bicycle-outline';
      case 'car':
        return 'car-sport-outline';
      default:
        return 'car-outline';
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Vehicles</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Info Banner */}
        <View style={styles.introCard}>
          <View style={styles.introIconCircle}>
            <Ionicons name="shield-checkmark" size={24} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.introTitle}>Verified Vehicle Fleet</Text>
            <Text style={styles.introText}>
              Register your bike, scooter, or car to publish ride offers and receive passenger bookings safely.
            </Text>
          </View>
        </View>

        {/* Single Primary Add Vehicle Action Button */}
        <TouchableOpacity style={styles.primaryAddBtn} onPress={openAddModal} activeOpacity={0.88}>
          <Ionicons name="add-circle" size={22} color="#FFFFFF" />
          <Text style={styles.primaryAddBtnText}>Register New Vehicle</Text>
        </TouchableOpacity>

        {/* Vehicles List Header */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Your Registered Vehicles ({vehicles.length})</Text>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Fetching your registered vehicles...</Text>
          </View>
        ) : vehicles.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="car-sport-outline" size={42} color={Colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No Vehicles Added Yet</Text>
            <Text style={styles.emptySubtitle}>
              You have no vehicles connected to your Sarathi driver profile. Tap the button above to register your first vehicle.
            </Text>
          </View>
        ) : (
          vehicles.map(v => (
            <TouchableOpacity key={v.id} style={styles.vehicleCard} onPress={() => openViewModal(v)} activeOpacity={0.9}>
              <View style={styles.vehicleCardTop}>
                {v.images && v.images.length > 0 ? (
                  <Image source={{ uri: v.images[0] }} style={styles.vehicleCardThumb} />
                ) : (
                  <View style={styles.vehicleIconCircle}>
                    <Ionicons name={getVehicleIcon(v.vehicleType) as any} size={24} color={Colors.primary} />
                  </View>
                )}

                <View style={{ flex: 1, paddingLeft: 4 }}>
                  <View style={styles.modelHeaderRow}>
                    <Text style={styles.vehicleModelText}>{v.vehicleModelName}</Text>
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeBadgeText}>{v.vehicleType.toUpperCase()}</Text>
                    </View>
                  </View>
                  <Text style={styles.vehiclePlateText}>{v.vehicleNumber}</Text>
                  {v.color ? <Text style={styles.colorText}>Color: {v.color}</Text> : null}
                </View>

                <View style={styles.actionBtnRow}>
                  <TouchableOpacity style={styles.iconActionBtn} onPress={() => openEditModal(v)} activeOpacity={0.7}>
                    <Ionicons name="pencil-outline" size={18} color={Colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.iconActionBtn, { backgroundColor: '#FEE2E2' }]} onPress={() => handleDeleteVehicle(v.id, v.vehicleModelName, v.userId)} activeOpacity={0.7}>
                    <Ionicons name="trash-outline" size={18} color="#DC2626" />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* ── Form Modal: Add / Edit Vehicle ───────────────────────────────────────── */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setModalVisible(false)} />
          <KeyboardAvoidingView style={styles.modalCard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingVehicle ? 'Edit Vehicle Details' : 'Register New Vehicle'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 4, paddingBottom: 16 }}>
                {/* 1. Vehicle Type Selector */}
                <Text style={styles.fieldLabel}>Vehicle Category *</Text>
                <View style={styles.typeSelectorRow}>
                  {(['bike', 'scooter', 'car', 'other'] as const).map(type => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typePill,
                        vehicleType === type && styles.typePillActive,
                      ]}
                      onPress={() => setVehicleType(type)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={type === 'car' ? 'car-sport' : 'bicycle'}
                        size={16}
                        color={vehicleType === type ? '#FFFFFF' : Colors.textMuted}
                      />
                      <Text style={[styles.typePillText, vehicleType === type && styles.typePillTextActive]}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* 2. Model Name */}
                <Text style={styles.fieldLabel}>Vehicle Model Name *</Text>
                <View style={styles.fieldRow}>
                  <Ionicons name="car-outline" size={18} color={Colors.primary} style={styles.fieldIcon} />
                  <TextInput
                    style={styles.fieldInput}
                    value={vehicleModelName}
                    onChangeText={setVehicleModelName}
                    placeholder="e.g. Pulsar 220F, Vespa VXL 150, Suzuki Swift"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>

                {/* 3. License Plate / Vehicle Number */}
                <Text style={styles.fieldLabel}>License Plate / Vehicle Number *</Text>
                <View style={styles.fieldRow}>
                  <Ionicons name="barcode-outline" size={18} color={Colors.primary} style={styles.fieldIcon} />
                  <TextInput
                    style={styles.fieldInput}
                    value={vehicleNumber}
                    onChangeText={setVehicleNumber}
                    placeholder="e.g. BA 1 PA 7788, LU 2 PA 1234"
                    placeholderTextColor={Colors.textMuted}
                    autoCapitalize="characters"
                  />
                </View>

                {/* 4. Color (Optional) */}
                <Text style={styles.fieldLabel}>Vehicle Color (Optional)</Text>
                <View style={styles.fieldRow}>
                  <Ionicons name="color-palette-outline" size={18} color={Colors.primary} style={styles.fieldIcon} />
                  <TextInput
                    style={styles.fieldInput}
                    value={vehicleColor}
                    onChangeText={setVehicleColor}
                    placeholder="e.g. Matte Black, Red, Silver"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>

                {/* 5. Photo Upload */}
                <Text style={styles.fieldLabel}>Vehicle Photo *</Text>
                <View style={styles.photoActionRow}>
                  <TouchableOpacity style={styles.photoActionBtn} onPress={captureVehiclePhoto} activeOpacity={0.8}>
                    <Ionicons name="camera" size={18} color={Colors.primary} />
                    <Text style={styles.photoActionText}>Take Photo</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.photoActionBtn} onPress={pickVehicleFromGallery} activeOpacity={0.8}>
                    <Ionicons name="images" size={18} color="#16A34A" />
                    <Text style={[styles.photoActionText, { color: '#16A34A' }]}>Upload Gallery</Text>
                  </TouchableOpacity>
                </View>

                {vehicleImages.length > 0 && (
                  <View style={styles.photoAttachedBadge}>
                    <Image source={{ uri: vehicleImages[0] }} style={styles.miniPhotoPreview} />
                    <View style={{ flex: 1, paddingLeft: 8 }}>
                      <Text style={styles.photoAttachedText}>Photo Attached & Ready</Text>
                      <Text style={styles.photoSubText}>Will upload to Supabase storage on save</Text>
                    </View>
                    <TouchableOpacity onPress={() => setVehicleImages([])}>
                      <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.saveBtn, isSubmitting && { opacity: 0.65 }]}
                  onPress={handleSaveVehicle}
                  disabled={isSubmitting}
                  activeOpacity={0.88}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.saveBtnText}>{editingVehicle ? 'Update Vehicle' : 'Add Vehicle'}</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── View Details Modal ─────────────────────────────────────────────────── */}
      <Modal visible={viewModalVisible} animationType="fade" transparent onRequestClose={() => setViewModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setViewModalVisible(false)}>
          <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Vehicle Info</Text>
              <TouchableOpacity onPress={() => setViewModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {selectedVehicle ? (
              <View style={{ gap: 12 }}>
                {selectedVehicle.images && selectedVehicle.images.length > 0 ? (
                  <Image source={{ uri: selectedVehicle.images[0] }} style={styles.largeDetailImage} />
                ) : null}

                <View style={styles.detailCardRow}>
                  <Text style={styles.detailCardLabel}>Model Name:</Text>
                  <Text style={styles.detailCardVal}>{selectedVehicle.vehicleModelName}</Text>
                </View>
                <View style={styles.detailCardRow}>
                  <Text style={styles.detailCardLabel}>License Plate:</Text>
                  <Text style={styles.detailCardVal}>{selectedVehicle.vehicleNumber}</Text>
                </View>
                <View style={styles.detailCardRow}>
                  <Text style={styles.detailCardLabel}>Category:</Text>
                  <Text style={styles.detailCardVal}>{selectedVehicle.vehicleType.toUpperCase()}</Text>
                </View>
                {selectedVehicle.color ? (
                  <View style={styles.detailCardRow}>
                    <Text style={styles.detailCardLabel}>Color:</Text>
                    <Text style={styles.detailCardVal}>{selectedVehicle.color}</Text>
                  </View>
                ) : null}
                <View style={styles.detailCardRow}>
                  <Text style={styles.detailCardLabel}>Database Status:</Text>
                  <Text style={[styles.detailCardVal, { color: Colors.success }]}>Active ✓</Text>
                </View>

                <TouchableOpacity
                  style={styles.closeViewBtn}
                  onPress={() => setViewModalVisible(false)}
                >
                  <Text style={styles.closeViewBtnText}>Close</Text>
                </TouchableOpacity>
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
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backButton: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  headerAddBtn: {
    padding: 6,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  introIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  introTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 2,
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
    borderRadius: 16,
    marginBottom: 20,
    elevation: 4,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
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
  loadingContainer: {
    paddingVertical: 36,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 8,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
    maxWidth: 250,
  },
  registerFirstBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 18,
  },
  registerFirstText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },
  vehicleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  vehicleCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  vehicleCardThumb: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  vehicleIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modelHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  vehicleModelText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  typeBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.primary,
  },
  vehiclePlateText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
    marginTop: 2,
  },
  colorText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  actionBtnRow: {
    flexDirection: 'row',
    gap: 6,
  },
  iconActionBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
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
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  typePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  typePillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  typePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  typePillTextActive: {
    color: '#FFFFFF',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 48,
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
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 12,
    padding: 8,
    marginBottom: 10,
  },
  miniPhotoPreview: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  photoAttachedText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.success,
  },
  photoSubText: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    elevation: 3,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
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
    paddingVertical: 10,
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
    width: '100%',
    height: 180,
    borderRadius: 16,
    marginBottom: 12,
  },
  closeViewBtn: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  closeViewBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
});
