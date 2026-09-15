import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PlaceSuggestion, LocationCoordinates } from '../services/locationService';
import { Colors } from '../constants/Colors';

export interface LocationSearchInputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  suggestions: PlaceSuggestion[];
  onSelectSuggestion: (suggestion: PlaceSuggestion) => void;
  isSearching: boolean;
  showNotFound: boolean;
  onOpenPinPicker: () => void;
  iconName?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  // Optional GPS button for origin input
  useGpsButton?: boolean;
  isFetchingGPS?: boolean;
  onUseGpsLocation?: () => void;
}

/**
 * Reusable location search input with debounced Nominatim search dropdown,
 * "Searching..." loading state, direct suggestion selection, and map pin picker fallback.
 */
export const LocationSearchInput: React.FC<LocationSearchInputProps> = ({
  label,
  placeholder = 'Search location in Nepal...',
  value,
  onChangeText,
  suggestions,
  onSelectSuggestion,
  isSearching,
  showNotFound,
  onOpenPinPicker,
  iconName = 'location-outline',
  iconColor = Colors.primary,
  useGpsButton = false,
  isFetchingGPS = false,
  onUseGpsLocation,
}) => {
  return (
    <View style={styles.container}>
      {/* Label Row with optional "Use my current location" GPS button */}
      {label ? (
        <View style={styles.labelRow}>
          <Text style={styles.inputLabel}>{label}</Text>
          {useGpsButton && onUseGpsLocation && (
            <TouchableOpacity
              style={styles.gpsBadgeBtn}
              onPress={onUseGpsLocation}
              disabled={isFetchingGPS}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isFetchingGPS ? 'sync' : 'navigate-circle-outline'}
                size={14}
                color={Colors.primary}
              />
              <Text style={styles.gpsBadgeText}>
                {isFetchingGPS ? 'Locating...' : 'Use my current location'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      {/* Input Box Row */}
      <View style={styles.inputBoxRow}>
        <Ionicons name={iconName} size={20} color={iconColor} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          autoCorrect={false}
        />
        {isSearching && (
          <View style={styles.searchingBadge}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.searchingText}>Searching...</Text>
          </View>
        )}
        {value.length > 0 && !isSearching && (
          <TouchableOpacity onPress={() => onChangeText('')} style={styles.clearBtn}>
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Autocomplete Dropdown List */}
      {suggestions.length > 0 && (
        <View style={styles.autocompleteDropdown}>
          {suggestions.map((item) => (
            <TouchableOpacity
              key={item.placeId}
              style={styles.autocompleteItem}
              onPress={() => onSelectSuggestion(item)}
              activeOpacity={0.75}
            >
              <Ionicons name="location-outline" size={18} color={iconColor} />
              <View style={{ flex: 1 }}>
                <Text style={styles.autocompleteMainText}>{item.mainText}</Text>
                <Text style={styles.autocompleteSubText} numberOfLines={1}>
                  {item.secondaryText}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* "Can't find this place? Drop a pin" Fallback Button */}
      {showNotFound && (
        <TouchableOpacity style={styles.cantFindBtn} onPress={onOpenPinPicker} activeOpacity={0.8}>
          <Ionicons name="location" size={16} color={Colors.primary} />
          <Text style={styles.cantFindText}>Can't find this place? Tap to set pin on map</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  gpsBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  gpsBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  inputBoxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  searchingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  searchingText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  clearBtn: {
    padding: 4,
  },
  autocompleteDropdown: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    marginTop: 4,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 30,
  },
  autocompleteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  autocompleteMainText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  autocompleteSubText: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  cantFindBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 6,
  },
  cantFindText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
});
