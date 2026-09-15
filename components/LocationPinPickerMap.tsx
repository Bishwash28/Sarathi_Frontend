import React, { useRef, useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  Platform,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { reverseGeocode } from '../services/locationService';

export interface PinLocation {
  lat: number;
  lng: number;
}

interface LocationPinPickerProps {
  initialLocation?: PinLocation | null;
  targetType?: 'origin' | 'destination' | null;
  onConfirmPin: (coords: PinLocation, placeName?: string) => void;
  quickLocations?: Array<{ name: string; lat: number; lng: number }>;
}

const DEFAULT_NEPAL_CENTER: PinLocation = {
  lat: 28.3949,
  lng: 84.1240,
};

export const LocationPinPickerMap: React.FC<LocationPinPickerProps> = ({
  initialLocation,
  targetType = 'origin',
  onConfirmPin,
}) => {
  const nativeMapRef = useRef<MapView | null>(null);
  const webViewRef = useRef<WebView | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  // Active raw pin coordinates state (used for backend submission)
  const [currentPin, setCurrentPin] = useState<PinLocation>(() => {
    return initialLocation && initialLocation.lat && initialLocation.lng
      ? initialLocation
      : DEFAULT_NEPAL_CENTER;
  });

  // Display place name & geocode loading states
  const [resolvedPlaceName, setResolvedPlaceName] = useState<string>('');
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);
  const [isFetchingGPS, setIsFetchingGPS] = useState<boolean>(false);
  const reverseGeocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Perform debounced reverse geocoding on gesture end
  const fetchPlaceName = useCallback((lat: number, lng: number) => {
    if (reverseGeocodeTimer.current) {
      clearTimeout(reverseGeocodeTimer.current);
    }

    setIsGeocoding(true);
    reverseGeocodeTimer.current = setTimeout(async () => {
      try {
        const placeName = await reverseGeocode(lat, lng);
        setResolvedPlaceName(placeName);
      } catch (err) {
        console.warn('[LocationPinPickerMap] reverseGeocode error:', err);
        setResolvedPlaceName(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      } finally {
        setIsGeocoding(false);
      }
    }, 400); // 400ms debounce
  }, []);

  // Center map on user's current GPS location
  const handleCenterOnMyLocation = useCallback(async () => {
    setIsFetchingGPS(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Needed', 'Location permission needed to use this feature.');
        setIsFetchingGPS(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const gpsCoords: PinLocation = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      };

      // 1. Update internal pin state & map views immediately
      setCurrentPin(gpsCoords);

      if (nativeMapRef.current) {
        nativeMapRef.current.animateToRegion({
          latitude: gpsCoords.lat,
          longitude: gpsCoords.lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 800);
      }

      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(
          `if (window.updatePin) { window.updatePin(${gpsCoords.lat}, ${gpsCoords.lng}); } true;`
        );
      }

      // 2. Perform reverse geocoding to obtain and store place name
      setIsGeocoding(true);
      let fetchedName = '';
      try {
        fetchedName = await reverseGeocode(gpsCoords.lat, gpsCoords.lng);
        setResolvedPlaceName(fetchedName);
      } catch (gErr) {
        console.warn('[LocationPinPickerMap] GPS reverseGeocode failed:', gErr);
        fetchedName = `${gpsCoords.lat.toFixed(4)}, ${gpsCoords.lng.toFixed(4)}`;
        setResolvedPlaceName(fetchedName);
      } finally {
        setIsGeocoding(false);
      }

      // 3. Notify parent callback with exact GPS coordinates AND resolved place name
      onConfirmPin(gpsCoords, fetchedName);
    } catch (err) {
      console.warn('[LocationPinPickerMap] GPS locate error:', err);
      Alert.alert('Location Error', 'Unable to get current location.');
    } finally {
      setIsFetchingGPS(false);
    }
  }, [onConfirmPin]);

  // Sync state & update map view when initialLocation changes
  useEffect(() => {
    if (initialLocation && initialLocation.lat && initialLocation.lng) {
      setCurrentPin(initialLocation);
      fetchPlaceName(initialLocation.lat, initialLocation.lng);

      if (nativeMapRef.current) {
        nativeMapRef.current.animateToRegion({
          latitude: initialLocation.lat,
          longitude: initialLocation.lng,
          latitudeDelta: 0.03,
          longitudeDelta: 0.03,
        }, 800);
      }

      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(
          `if (window.updatePin) { window.updatePin(${initialLocation.lat}, ${initialLocation.lng}); } true;`
        );
      }
    } else {
      fetchPlaceName(DEFAULT_NEPAL_CENTER.lat, DEFAULT_NEPAL_CENTER.lng);
    }
  }, [initialLocation, fetchPlaceName]);

  const handleMarkerDragEnd = (e: any) => {
    const coords = e.nativeEvent.coordinate;
    if (coords) {
      const newPin = { lat: coords.latitude, lng: coords.longitude };
      setCurrentPin(newPin);
      fetchPlaceName(coords.latitude, coords.longitude);
      onConfirmPin(newPin, resolvedPlaceName || undefined);
    }
  };

  const handleMapPress = (e: any) => {
    const coords = e.nativeEvent.coordinate;
    if (coords) {
      const newPin = { lat: coords.latitude, lng: coords.longitude };
      setCurrentPin(newPin);
      fetchPlaceName(coords.latitude, coords.longitude);
      onConfirmPin(newPin, resolvedPlaceName || undefined);
    }
  };

  const handleZoomIn = useCallback(() => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`if (window.zoomIn) { window.zoomIn(); } true;`);
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`if (window.zoomOut) { window.zoomOut(); } true;`);
    }
  }, []);

  const pinColor = targetType === 'destination' ? '#DC2626' : Colors.primary;

  // HTML content for Leaflet map fallback
  const leafletHTML = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #e2e8f0; }
          .leaflet-container { font-family: sans-serif; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map', { zoomControl: false }).setView([${currentPin.lat}, ${currentPin.lng}], 13);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
          }).addTo(map);

          var marker = L.marker([${currentPin.lat}, ${currentPin.lng}], { draggable: true }).addTo(map);

          function notifyParent(lat, lng) {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ lat: lat, lng: lng }));
            }
          }

          marker.on('dragend', function(e) {
            var latlng = marker.getLatLng();
            notifyParent(latlng.lat, latlng.lng);
          });

          map.on('click', function(e) {
            marker.setLatLng(e.latlng);
            notifyParent(e.latlng.lat, e.latlng.lng);
          });

          window.updatePin = function(lat, lng) {
            marker.setLatLng([lat, lng]);
            map.panTo([lat, lng]);
          };

          window.zoomIn = function() {
            map.zoomIn();
          };

          window.zoomOut = function() {
            map.zoomOut();
          };

          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
        </script>
      </body>
    </html>
  `;

  // WebView message listener
  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'ready') {
        setIsMapReady(true);
      } else if (data.lat && data.lng) {
        const newPin = { lat: data.lat, lng: data.lng };
        setCurrentPin(newPin);
        fetchPlaceName(data.lat, data.lng);
        onConfirmPin(newPin, resolvedPlaceName || undefined);
      }
    } catch (err) {
      console.warn('WebView msg err:', err);
    }
  };

  // Web Browser Fallback Notice
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <View style={styles.webFallbackCard}>
          <Ionicons name="phone-portrait-outline" size={48} color={Colors.primary} />
          <Text style={styles.webFallbackTitle}>Interactive Map Available on Mobile App</Text>
          <Text style={styles.webFallbackSub}>
            Interactive pin picking uses native maps on mobile devices. Please open Sarathi on a mobile emulator or physical device.
          </Text>
          <View style={styles.liveCoordsBadgeWeb}>
            <Ionicons name="location" size={14} color={pinColor} />
            <Text style={styles.liveCoordsText}>
              Selected: {isGeocoding ? 'Locating...' : resolvedPlaceName || `${currentPin.lat.toFixed(4)}, ${currentPin.lng.toFixed(4)}`}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.mapContainer}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: leafletHTML }}
          onMessage={handleWebViewMessage}
          style={StyleSheet.absoluteFill}
          javaScriptEnabled={true}
          domStorageEnabled={true}
        />

        {/* Custom Grouped Controls Stack (Top-Right) */}
        <View style={styles.mapControlsStack}>
          {/* Zoom In (+) */}
          <TouchableOpacity
            style={styles.mapControlBtn}
            onPress={handleZoomIn}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={22} color={Colors.primary} />
          </TouchableOpacity>

          {/* Zoom Out (−) */}
          <TouchableOpacity
            style={styles.mapControlBtn}
            onPress={handleZoomOut}
            activeOpacity={0.8}
          >
            <Ionicons name="remove" size={22} color={Colors.primary} />
          </TouchableOpacity>

          {/* GPS Current Location */}
          <TouchableOpacity
            style={styles.mapControlBtn}
            onPress={handleCenterOnMyLocation}
            disabled={isFetchingGPS}
            activeOpacity={0.8}
          >
            {isFetchingGPS ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Ionicons name="locate" size={20} color={Colors.primary} />
            )}
          </TouchableOpacity>
        </View>

        {/* Live Formatted Place Name Badge with Raw Coords Subtitle */}
        <View style={styles.liveCoordsBadge}>
          <Ionicons name="location" size={16} color={pinColor} />
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.livePlaceNameText} numberOfLines={1}>
              {isGeocoding ? 'Locating...' : resolvedPlaceName || `${currentPin.lat.toFixed(4)}, ${currentPin.lng.toFixed(4)}`}
            </Text>
            <Text style={styles.liveRawCoordsSub}>
              {currentPin.lat.toFixed(5)}, {currentPin.lng.toFixed(5)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  mapControlsStack: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'column',
    gap: 8,
    zIndex: 25,
  },
  mapControlBtn: {
    backgroundColor: '#FFFFFF',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  liveCoordsBadge: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 20,
  },
  liveCoordsText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  livePlaceNameText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  liveRawCoordsSub: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textMuted,
    marginTop: 1,
  },
  webFallbackCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    margin: 16,
  },
  webFallbackTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginTop: 12,
    textAlign: 'center',
  },
  webFallbackSub: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  liveCoordsBadgeWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
});
