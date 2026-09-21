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

export interface PinLocation {
  lat: number;
  lng: number;
}

interface LocationPinPickerProps {
  originCoords?: PinLocation | null;
  destCoords?: PinLocation | null;
  originName?: string;
  destName?: string;
  activeTarget?: 'origin' | 'destination';
  showControls?: boolean;
  showBadge?: boolean;
  interactive?: boolean;
  onSelectCoords?: (coords: PinLocation) => void;
  onConfirmPin?: (coords: PinLocation, placeName?: string) => void;
}

const DEFAULT_NEPAL_CENTER: PinLocation = {
  lat: 27.7172,
  lng: 85.3240,
};

export const LocationPinPickerMap: React.FC<LocationPinPickerProps> = ({
  originCoords,
  destCoords,
  originName,
  destName,
  activeTarget = 'origin',
  showControls = true,
  showBadge = true,
  interactive = true,
  onSelectCoords,
  onConfirmPin,
}) => {
  const webViewRef = useRef<WebView | null>(null);
  const [isFetchingGPS, setIsFetchingGPS] = useState(false);
  const [resolvedPlaceName, setResolvedPlaceName] = useState<string | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);

  const pinColor = activeTarget === 'destination' ? '#DC2626' : '#16A34A';
  const currentPin = activeTarget === 'destination' && destCoords?.lat
    ? destCoords
    : (originCoords?.lat ? originCoords : DEFAULT_NEPAL_CENTER);

  const currentCenter = currentPin;

  // Reverse geocode to display human readable place name in live badge
  useEffect(() => {
    let isMounted = true;
    const pin = activeTarget === 'destination' ? destCoords : originCoords;
    if (pin && pin.lat && pin.lng && showBadge) {
      setIsGeocoding(true);
      Location.reverseGeocodeAsync({ latitude: pin.lat, longitude: pin.lng })
        .then((res) => {
          if (!isMounted) return;
          if (res && res.length > 0) {
            const item = res[0];
            const nameParts = [item.name || item.street, item.subregion || item.city || item.district].filter(Boolean);
            const formatted = nameParts.join(', ');
            setResolvedPlaceName(formatted && !formatted.includes('+') ? formatted : `${pin.lat.toFixed(4)}, ${pin.lng.toFixed(4)}`);
          } else {
            setResolvedPlaceName(`${pin.lat.toFixed(4)}, ${pin.lng.toFixed(4)}`);
          }
        })
        .catch(() => {
          if (isMounted) setResolvedPlaceName(`${pin.lat.toFixed(4)}, ${pin.lng.toFixed(4)}`);
        })
        .finally(() => {
          if (isMounted) setIsGeocoding(false);
        });
    } else {
      setResolvedPlaceName(null);
    }
    return () => {
      isMounted = false;
    };
  }, [originCoords, destCoords, activeTarget, showBadge]);

  // Sync map center & route when active target coords or names change
  useEffect(() => {
    if (webViewRef.current) {
      const oNameEsc = JSON.stringify(originName || resolvedPlaceName || 'Pickup');
      const dNameEsc = JSON.stringify(destName || 'Destination');
      webViewRef.current.injectJavaScript(
        `if (window.updateMapPositions) { window.updateMapPositions(${originCoords?.lat ?? 'null'}, ${originCoords?.lng ?? 'null'}, ${destCoords?.lat ?? 'null'}, ${destCoords?.lng ?? 'null'}, '${activeTarget}', ${oNameEsc}, ${dNameEsc}); } true;`
      );
    }
  }, [originCoords, destCoords, activeTarget, originName, destName, resolvedPlaceName]);

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

  const handleCenterOnMyLocation = async () => {
    try {
      setIsFetchingGPS(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Permission to access device location was denied.');
        setIsFetchingGPS(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      onSelectCoords?.(coords);
      if (webViewRef.current) {
        const oNameEsc = JSON.stringify(originName || 'Pickup');
        const dNameEsc = JSON.stringify(destName || 'Destination');
        webViewRef.current.injectJavaScript(
          `if (window.updateMapPositions) { window.updateMapPositions(${activeTarget === 'origin' ? coords.lat : (originCoords?.lat ?? 'null')}, ${activeTarget === 'origin' ? coords.lng : (originCoords?.lng ?? 'null')}, ${activeTarget === 'destination' ? coords.lat : (destCoords?.lat ?? 'null')}, ${activeTarget === 'destination' ? coords.lng : (destCoords?.lng ?? 'null')}, '${activeTarget}', ${oNameEsc}, ${dNameEsc}); } true;`
        );
      }
    } catch (e) {
      console.warn('GPS location fetch error:', e);
    } finally {
      setIsFetchingGPS(false);
    }
  };

  const initialOrigName = JSON.stringify(originName || 'Pickup');
  const initialDestName = JSON.stringify(destName || 'Destination');

  // Leaflet HTML with Standard Light OpenStreetMap Tiles & Minimal Professional Markers
  const leafletHTML = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #f8fafc; }
          .leaflet-container { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; }
          .clean-orig-pin, .clean-dest-pin, .route-tooltip-container { background: transparent; border: none; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var isInteractive = ${interactive ? 'true' : 'false'};
          var map = L.map('map', {
            zoomControl: false,
            dragging: isInteractive,
            touchZoom: isInteractive,
            doubleClickZoom: isInteractive,
            scrollWheelZoom: isInteractive,
            boxZoom: isInteractive
          }).setView([${currentCenter.lat}, ${currentCenter.lng}], 12);
          
          // Clean Light OpenStreetMap tile layer (No API Key Required)
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
          }).addTo(map);

          var origMarker = null;
          var destMarker = null;
          var routePolyline = null;
          var routeTooltipMarker = null;

          function notifyParent(lat, lng) {
            if (isInteractive && window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ lat: lat, lng: lng }));
            }
          }

          function createOrigIcon(label) {
            var name = label || 'Pickup';
            return L.divIcon({
              className: 'clean-orig-pin',
              html: '<div style="display:flex; align-items:center; gap:6px; pointer-events:none; transform:translate(-8px, -8px);">' +
                      '<div style="width:16px; height:16px; border-radius:50%; background:#FFFFFF; border:4px solid #0F172A; box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>' +
                      '<span style="font-size:13px; font-weight:800; color:#0F172A; font-family:-apple-system, sans-serif; text-shadow:-1px -1px 0 #FFF, 1px -1px 0 #FFF, -1px 1px 0 #FFF, 1px 1px 0 #FFF, 0 2px 4px rgba(255,255,255,0.95); white-space:nowrap;">' + name + '</span>' +
                    '</div>',
              iconSize: [0, 0]
            });
          }

          function createDestIcon(label) {
            var name = label || 'Destination';
            return L.divIcon({
              className: 'clean-dest-pin',
              html: '<div style="display:flex; align-items:center; gap:6px; pointer-events:none; transform:translate(-12px, -24px);">' +
                      '<svg width="24" height="28" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 5px rgba(0,0,0,0.35));">' +
                        '<path d="M12 0C5.37 0 0 5.37 0 12C0 21 12 28 12 28C12 28 24 21 24 12C24 5.37 18.63 0 12 0Z" fill="#DC2626"/>' +
                        '<circle cx="12" cy="11" r="4.5" fill="#FFFFFF"/>' +
                      '</svg>' +
                      '<span style="font-size:13px; font-weight:800; color:#0F172A; font-family:-apple-system, sans-serif; text-shadow:-1px -1px 0 #FFF, 1px -1px 0 #FFF, -1px 1px 0 #FFF, 1px 1px 0 #FFF, 0 2px 4px rgba(255,255,255,0.95); white-space:nowrap;">' + name + '</span>' +
                    '</div>',
              iconSize: [0, 0]
            });
          }

          function calculateDistanceKm(lat1, lon1, lat2, lon2) {
            var R = 6371;
            var dLat = (lat2 - lat1) * Math.PI / 180;
            var dLon = (lon2 - lon1) * Math.PI / 180;
            var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                    Math.sin(dLon/2) * Math.sin(dLon/2);
            var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return R * c;
          }

          function renderRouteTooltip(midPoint, estMins, distKmStr) {
            if (routeTooltipMarker) { map.removeLayer(routeTooltipMarker); routeTooltipMarker = null; }

            var customTooltipIcon = L.divIcon({
              className: 'route-tooltip-container',
              html: '<div style="background:#0F172A; color:#FFFFFF; padding:8px 14px; border-radius:12px; font-family:-apple-system, sans-serif; box-shadow:0 8px 24px rgba(0,0,0,0.6); border:1.5px solid #1E293B; text-align:left; transform:translate(-50%, -100%); margin-top:-14px; min-width:90px;">' +
                      '<div style="font-size:15px; font-weight:800; display:flex; align-items:center; gap:6px; color:#FFFFFF; line-height:1.2;">' +
                        '<span style="font-size:16px;">🚗</span> <span>' + estMins + ' min</span>' +
                      '</div>' +
                      '<div style="font-size:12px; color:#94A3B8; margin-top:2px; font-weight:700; padding-left:22px;">' + distKmStr + ' km</div>' +
                    '</div>',
              iconSize: [0, 0]
            });

            routeTooltipMarker = L.marker(midPoint, { icon: customTooltipIcon, interactive: false }).addTo(map);
          }

          function updateRouteLine(oLat, oLng, dLat, dLng) {
            if (routePolyline) { map.removeLayer(routePolyline); routePolyline = null; }
            if (routeTooltipMarker) { map.removeLayer(routeTooltipMarker); routeTooltipMarker = null; }

            if (oLat !== null && oLng !== null && dLat !== null && dLng !== null &&
                oLat !== undefined && oLng !== undefined && dLat !== undefined && dLng !== undefined) {
              
              var osrmUrl = 'https://router.project-osrm.org/route/v1/driving/' + oLng + ',' + oLat + ';' + dLng + ',' + dLat + '?overview=full&geometries=geojson';

              fetch(osrmUrl)
                .then(function(res) { return res.json(); })
                .then(function(data) {
                  var roadCoords = [];
                  var distKmStr = '0.0';
                  var estMins = 1;

                  if (data && data.code === 'Ok' && data.routes && data.routes.length > 0) {
                    var route = data.routes[0];
                    distKmStr = (route.distance / 1000).toFixed(1);
                    estMins = Math.max(1, Math.round(route.duration / 60));
                    roadCoords = route.geometry.coordinates.map(function(c) { return [c[1], c[0]]; });
                  } else {
                    roadCoords = [[oLat, oLng], [dLat, dLng]];
                    var dKm = calculateDistanceKm(oLat, oLng, dLat, dLng);
                    distKmStr = dKm.toFixed(1);
                    estMins = Math.max(1, Math.round((dKm / 35) * 60));
                  }

                  // Draw Vibrant Cyan Road Polyline matching user screenshot
                  routePolyline = L.polyline(roadCoords, {
                    color: '#00C4DF',
                    weight: 6,
                    opacity: 0.95,
                    lineCap: 'round',
                    lineJoin: 'round'
                  }).addTo(map);

                  // Floating Callout Tooltip on road midpoint
                  var midIdx = Math.floor(roadCoords.length / 2);
                  var midPt = roadCoords[midIdx] || [(oLat + dLat)/2, (oLng + dLng)/2];
                  renderRouteTooltip(midPt, estMins, distKmStr);

                  try {
                    map.fitBounds(routePolyline.getBounds(), { padding: [40, 40] });
                  } catch (e) {}
                })
                .catch(function() {
                  // Offline / Network Fallback
                  var roadCoords = [[oLat, oLng], [dLat, dLng]];
                  var dKm = calculateDistanceKm(oLat, oLng, dLat, dLng);
                  var distKmStr = dKm.toFixed(1);
                  var estMins = Math.max(1, Math.round((dKm / 35) * 60));

                  routePolyline = L.polyline(roadCoords, {
                    color: '#00C4DF',
                    weight: 6,
                    opacity: 0.95,
                    lineCap: 'round',
                    lineJoin: 'round'
                  }).addTo(map);

                  var midPt = [(oLat + dLat)/2, (oLng + dLng)/2];
                  renderRouteTooltip(midPt, estMins, distKmStr);

                  try {
                    map.fitBounds(routePolyline.getBounds(), { padding: [40, 40] });
                  } catch (e) {}
                });
            }
          }

          ${originCoords?.lat ? `
            origMarker = L.marker([${originCoords.lat}, ${originCoords.lng}], { draggable: isInteractive, icon: createOrigIcon(${initialOrigName}) }).addTo(map);
            if (isInteractive) {
              origMarker.on('dragend', function(e) {
                var ll = e.target.getLatLng();
                notifyParent(ll.lat, ll.lng);
              });
            }
          ` : ''}

          ${destCoords?.lat ? `
            destMarker = L.marker([${destCoords.lat}, ${destCoords.lng}], { draggable: isInteractive, icon: createDestIcon(${initialDestName}) }).addTo(map);
            if (isInteractive) {
              destMarker.on('dragend', function(e) {
                var ll = e.target.getLatLng();
                notifyParent(ll.lat, ll.lng);
              });
            }
          ` : ''}

          ${originCoords?.lat && destCoords?.lat ? `
            updateRouteLine(${originCoords.lat}, ${originCoords.lng}, ${destCoords.lat}, ${destCoords.lng});
          ` : ''}

          if (isInteractive) {
            map.on('click', function(e) {
              notifyParent(e.latlng.lat, e.latlng.lng);
            });
          }

          window.updateMapPositions = function(oLat, oLng, dLat, dLng, activeTarget, oName, dName) {
            if (oLat !== null && oLng !== null && oLat !== undefined && oLng !== undefined) {
              if (!origMarker) {
                origMarker = L.marker([oLat, oLng], { draggable: isInteractive, icon: createOrigIcon(oName) }).addTo(map);
                if (isInteractive) {
                  origMarker.on('dragend', function(e) { notifyParent(e.target.getLatLng().lat, e.target.getLatLng().lng); });
                }
              } else {
                origMarker.setLatLng([oLat, oLng]);
                origMarker.setIcon(createOrigIcon(oName));
              }
            }
            if (dLat !== null && dLng !== null && dLat !== undefined && dLng !== undefined) {
              if (!destMarker) {
                destMarker = L.marker([dLat, dLng], { draggable: isInteractive, icon: createDestIcon(dName) }).addTo(map);
                if (isInteractive) {
                  destMarker.on('dragend', function(e) { notifyParent(e.target.getLatLng().lat, e.target.getLatLng().lng); });
                }
              } else {
                destMarker.setLatLng([dLat, dLng]);
                destMarker.setIcon(createDestIcon(dName));
              }
            }

            updateRouteLine(oLat, oLng, dLat, dLng);

            if (!oLat || !dLat) {
              var targetLat = activeTarget === 'destination' ? dLat : oLat;
              var targetLng = activeTarget === 'destination' ? dLng : oLng;
              if (targetLat !== null && targetLng !== null && targetLat !== undefined && targetLng !== undefined) {
                map.panTo([targetLat, targetLng]);
              }
            }
          };

          window.zoomIn = function() { map.zoomIn(); };
          window.zoomOut = function() { map.zoomOut(); };
        </script>
      </body>
    </html>
  `;

  // WebView message listener
  const handleWebViewMessage = (event: any) => {
    if (!interactive) return;
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.lat && data.lng) {
        const newPin = { lat: data.lat, lng: data.lng };
        onSelectCoords?.(newPin);
        onConfirmPin?.(newPin);
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
          {showBadge && (
            <View style={styles.liveCoordsBadgeWeb}>
              <Ionicons name="location" size={14} color={pinColor} />
              <Text style={styles.liveCoordsText}>
                Selected: {isGeocoding ? 'Locating...' : resolvedPlaceName || `${currentPin.lat.toFixed(4)}, ${currentPin.lng.toFixed(4)}`}
              </Text>
            </View>
          )}
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

        {/* Custom Grouped Controls Stack (Zoom +, -, GPS) - ONLY shown when showControls is true */}
        {showControls && (
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
        )}

        {/* Live Location Coordinates Pin Badge - ONLY shown when showBadge is true */}
        {showBadge && (
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
        )}
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
