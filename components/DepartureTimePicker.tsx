import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '../constants/Colors';

interface DepartureTimePickerProps {
  value: string; // ISO string or formatted string
  onChange: (isoString: string, formattedDisplay: string) => void;
  label?: string;
}

export const DepartureTimePicker: React.FC<DepartureTimePickerProps> = ({
  value,
  onChange,
  label = 'Departure Time *',
}) => {
  const [selectedPreset, setSelectedPreset] = useState<'now' | '15m' | '30m' | '1h' | 'custom'>('15m');
  const [customModalVisible, setCustomModalVisible] = useState(false);

  // Time Picker Modal states
  const [pickerHour, setPickerHour] = useState<number>(8); // 1-12
  const [pickerMinute, setPickerMinute] = useState<number>(0); // 0, 5, 10...
  const [pickerAmPm, setPickerAmPm] = useState<'AM' | 'PM'>('AM');

  // Initialize with real current time + 15 mins on mount if no value provided
  useEffect(() => {
    if (!value) {
      handlePresetSelect('15m');
    } else {
      // Sync internal picker values if value is valid ISO date
      const d = new Date(value);
      if (d.toString() !== 'Invalid Date') {
        let hrs = d.getHours();
        const mins = Math.round(d.getMinutes() / 5) * 5 % 60;
        const ampm = hrs >= 12 ? 'PM' : 'AM';
        hrs = hrs % 12 || 12;
        setPickerHour(hrs);
        setPickerMinute(mins);
        setPickerAmPm(ampm);
      }
    }
  }, []);

  const formatDisplayTime = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getTimeDifferenceText = (date: Date): string => {
    const diffMs = date.getTime() - Date.now();
    const diffMins = Math.round(diffMs / 60000);
    if (diffMins <= 1) return 'Leaving Now';
    if (diffMins < 60) return `In ~${diffMins} mins`;
    const hrs = Math.floor(diffMins / 60);
    const remainingMins = diffMins % 60;
    return remainingMins > 0 ? `In ~${hrs}h ${remainingMins}m` : `In ~${hrs} hour${hrs > 1 ? 's' : ''}`;
  };

  const handlePresetSelect = (preset: 'now' | '15m' | '30m' | '1h' | 'custom') => {
    setSelectedPreset(preset);
    if (preset === 'custom') {
      setCustomModalVisible(true);
      return;
    }

    const now = new Date();
    let targetDate = new Date();

    if (preset === 'now') {
      targetDate = now;
    } else if (preset === '15m') {
      targetDate = new Date(now.getTime() + 15 * 60000);
    } else if (preset === '30m') {
      targetDate = new Date(now.getTime() + 30 * 60000);
    } else if (preset === '1h') {
      targetDate = new Date(now.getTime() + 60 * 60000);
    }

    const iso = targetDate.toISOString();
    const display = formatDisplayTime(targetDate);
    onChange(iso, display);
  };

  const handleConfirmCustomTime = () => {
    const now = new Date();
    let hours24 = pickerHour % 12;
    if (pickerAmPm === 'PM') hours24 += 12;

    const targetDate = new Date();
    targetDate.setHours(hours24, pickerMinute, 0, 0);

    // If selected time has already passed today by >5 minutes, set for tomorrow
    if (targetDate.getTime() < now.getTime() - 5 * 60000) {
      targetDate.setDate(targetDate.getDate() + 1);
    }

    const iso = targetDate.toISOString();
    const display = formatDisplayTime(targetDate);
    setSelectedPreset('custom');
    setCustomModalVisible(false);
    onChange(iso, display);
  };

  // Derived current selected date object for UI display
  const currentDate = value && new Date(value).toString() !== 'Invalid Date' ? new Date(value) : new Date();
  const formattedTimeStr = formatDisplayTime(currentDate);
  const timeDiffStr = getTimeDifferenceText(currentDate);

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      {/* Preset Chips Row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.presetsRow}
      >
        <TouchableOpacity
          style={[styles.presetChip, selectedPreset === 'now' && styles.presetChipActive]}
          onPress={() => handlePresetSelect('now')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="flash"
            size={14}
            color={selectedPreset === 'now' ? '#FFFFFF' : Colors.primary}
          />
          <Text style={[styles.presetChipText, selectedPreset === 'now' && styles.presetChipTextActive]}>
            Leaving Now
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.presetChip, selectedPreset === '15m' && styles.presetChipActive]}
          onPress={() => handlePresetSelect('15m')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="time-outline"
            size={14}
            color={selectedPreset === '15m' ? '#FFFFFF' : Colors.primary}
          />
          <Text style={[styles.presetChipText, selectedPreset === '15m' && styles.presetChipTextActive]}>
            +15 Mins
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.presetChip, selectedPreset === '30m' && styles.presetChipActive]}
          onPress={() => handlePresetSelect('30m')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="time-outline"
            size={14}
            color={selectedPreset === '30m' ? '#FFFFFF' : Colors.primary}
          />
          <Text style={[styles.presetChipText, selectedPreset === '30m' && styles.presetChipTextActive]}>
            +30 Mins
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.presetChip, selectedPreset === '1h' && styles.presetChipActive]}
          onPress={() => handlePresetSelect('1h')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="time-outline"
            size={14}
            color={selectedPreset === '1h' ? '#FFFFFF' : Colors.primary}
          />
          <Text style={[styles.presetChipText, selectedPreset === '1h' && styles.presetChipTextActive]}>
            +1 Hour
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.presetChip, selectedPreset === 'custom' && styles.presetChipActive]}
          onPress={() => setCustomModalVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons
            name="calendar-outline"
            size={14}
            color={selectedPreset === 'custom' ? '#FFFFFF' : Colors.primary}
          />
          <Text style={[styles.presetChipText, selectedPreset === 'custom' && styles.presetChipTextActive]}>
            Custom Time
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Selected Time Display Banner Box */}
      <TouchableOpacity
        style={styles.selectedTimeCard}
        onPress={() => setCustomModalVisible(true)}
        activeOpacity={0.88}
      >
        <View style={styles.timeIconCircle}>
          <Ionicons name="time" size={20} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.selectedTimeTitle}>Departure: {formattedTimeStr}</Text>
          <Text style={styles.selectedTimeSub}>{timeDiffStr}</Text>
        </View>
        <View style={styles.changeBtnPill}>
          <Text style={styles.changeBtnText}>Choose Time</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
        </View>
      </TouchableOpacity>

      {/* ── Custom Time Picker Modal ── */}
      <Modal
        visible={customModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setCustomModalVisible(false)}
          />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="time" size={22} color={Colors.primary} />
                <Text style={styles.modalTitle}>Select Departure Time</Text>
              </View>
              <TouchableOpacity onPress={() => setCustomModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Time Preview Header */}
            <View style={styles.timePreviewBox}>
              <Text style={styles.timePreviewBig}>
                {String(pickerHour).padStart(2, '0')}:{String(pickerMinute).padStart(2, '0')}{' '}
                <Text style={styles.timePreviewAmPm}>{pickerAmPm}</Text>
              </Text>
              <Text style={styles.timePreviewSub}>Set exact departure time for your ride</Text>
            </View>

            {/* AM / PM Toggle */}
            <Text style={styles.pickerSectionLabel}>Period</Text>
            <View style={styles.amPmRow}>
              <TouchableOpacity
                style={[styles.amPmBtn, pickerAmPm === 'AM' && styles.amPmBtnActive]}
                onPress={() => setPickerAmPm('AM')}
                activeOpacity={0.8}
              >
                <Text style={[styles.amPmText, pickerAmPm === 'AM' && styles.amPmTextActive]}>AM (Morning)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.amPmBtn, pickerAmPm === 'PM' && styles.amPmBtnActive]}
                onPress={() => setPickerAmPm('PM')}
                activeOpacity={0.8}
              >
                <Text style={[styles.amPmText, pickerAmPm === 'PM' && styles.amPmTextActive]}>PM (Afternoon/Night)</Text>
              </TouchableOpacity>
            </View>

            {/* Hour Selector Grid */}
            <Text style={styles.pickerSectionLabel}>Hour</Text>
            <View style={styles.gridRow}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(hr => (
                <TouchableOpacity
                  key={hr}
                  style={[styles.gridPill, pickerHour === hr && styles.gridPillActive]}
                  onPress={() => setPickerHour(hr)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.gridPillText, pickerHour === hr && styles.gridPillTextActive]}>
                    {String(hr).padStart(2, '0')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Minute Selector Grid */}
            <Text style={styles.pickerSectionLabel}>Minute</Text>
            <View style={styles.gridRow}>
              {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(min => (
                <TouchableOpacity
                  key={min}
                  style={[styles.gridPill, pickerMinute === min && styles.gridPillActive]}
                  onPress={() => setPickerMinute(min)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.gridPillText, pickerMinute === min && styles.gridPillTextActive]}>
                    :{String(min).padStart(2, '0')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Modal Actions */}
            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setCustomModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleConfirmCustomTime}
                activeOpacity={0.88}
              >
                <Text style={styles.confirmBtnText}>Confirm Time</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 8,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  presetChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  selectedTimeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    gap: 10,
    marginTop: 4,
  },
  timeIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedTimeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  selectedTimeSub: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 1,
  },
  changeBtnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  changeBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    width: '100%',
    maxWidth: 380,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
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
  timePreviewBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  timePreviewBig: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 1,
  },
  timePreviewAmPm: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.accent,
  },
  timePreviewSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
  },
  pickerSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 6,
  },
  amPmRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  amPmBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  amPmBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  amPmText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  amPmTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  gridPill: {
    width: '23%',
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  gridPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  gridPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  gridPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
