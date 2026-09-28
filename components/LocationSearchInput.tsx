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
import { Colors } from '../constants/Colors';

export interface LocationCoordinates {
  lat: number;
  lng: number;
}

export interface PlaceSuggestion {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
  coordinates?: LocationCoordinates;
}

export interface LocationSearchInputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  suggestions: PlaceSuggestion[];
  onSelectSuggestion: (suggestion: PlaceSuggestion) => void;
  isSearching: boolean;
  onFocus?: () => void;
  iconName?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
}

/**
 * Reusable location search input with debounced Nepal place search dropdown,
 * autocomplete suggestions, and focus events for real-time map sync.
 */
export const LocationSearchInput: React.FC<LocationSearchInputProps> = ({
  label,
  placeholder = 'Search location...',
  value,
  onChangeText,
  suggestions,
  onSelectSuggestion,
  isSearching,
  onFocus,
  iconName = 'location-outline',
  iconColor = Colors.primary,
}) => {
  return (
    <View style={styles.container}>
      {label ? <Text style={styles.inputLabel}>{label}</Text> : null}

      {/* Input Box Row */}
      <View style={styles.inputBoxRow}>
        <Ionicons name={iconName} size={20} color={iconColor} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          autoCorrect={false}
        />

        {isSearching && (
          <View style={styles.searchingBadge}>
            <ActivityIndicator size="small" color={Colors.primary} />
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
  mapBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.accent + '35',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  mapBadgeText: {
    fontSize: 12,
    fontWeight: '700',
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
  inputMapBtn: {
    paddingLeft: 6,
    paddingRight: 2,
    justifyContent: 'center',
    alignItems: 'center',
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
