import React, { useRef, useEffect } from 'react';
import { StyleSheet, View, Text, Platform, TouchableOpacity } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';

export interface Coordinate {
  latitude: number;
  longitude: number;
}

interface RouteMapProps {
  startCoord: Coordinate;
  endCoord: Coordinate;
  liveCoord?: Coordinate;
  vehicleType?: 'bike' | 'car';
  strokeColor?: string;
  lineDashPattern?: number[];
  showControls?: boolean;
  style?: any;
}

export const RouteMap: React.FC<RouteMapProps> = ({
  startCoord,
  endCoord,
  liveCoord,
  vehicleType = 'bike',
  strokeColor = '#C62026',
  lineDashPattern = [6, 4],
  showControls = true,
  style,
}) => {
  const mapRef = useRef<MapView>(null);
  const [routeCoords, setRouteCoords] = React.useState<Coordinate[]>([]);

  useEffect(() => {
    const fetchRoute = async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${startCoord.longitude},${startCoord.latitude};${endCoord.longitude},${endCoord.latitude}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.routes && data.routes[0]) {
          const coords = data.routes[0].geometry.coordinates.map((coord: [number, number]) => ({
            latitude: coord[1],
            longitude: coord[0],
          }));
          setRouteCoords(coords);
        } else {
          setRouteCoords([startCoord, endCoord]);
        }
      } catch (err) {
        console.warn("Failed to fetch OSRM route:", err);
        setRouteCoords([startCoord, endCoord]);
      }
    };
    fetchRoute();
  }, [startCoord, endCoord]);

  useEffect(() => {
    if (Platform.OS !== 'web' && mapRef.current) {
      const coords = routeCoords.length > 0 ? [...routeCoords] : [startCoord, endCoord];
      if (liveCoord) {
        coords.push(liveCoord);
      }
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
        animated: true,
      });
    }
  }, [startCoord, endCoord, liveCoord, routeCoords]);

  const handleZoomIn = () => {
    if (mapRef.current) {
      mapRef.current.getCamera().then((camera) => {
        if (camera.zoom !== undefined) {
          camera.zoom += 1;
          mapRef.current?.animateCamera(camera, { duration: 300 });
        }
      });
    }
  };

  const handleZoomOut = () => {
    if (mapRef.current) {
      mapRef.current.getCamera().then((camera) => {
        if (camera.zoom !== undefined) {
          camera.zoom -= 1;
          mapRef.current?.animateCamera(camera, { duration: 300 });
        }
      });
    }
  };

  // Web Fallback Renderer
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.webFallbackContainer, style]}>
        <View style={styles.webCanvas}>
          <Text style={styles.webNoticeText}>Interactive Map View</Text>
          <View style={[styles.webRouteLine, { backgroundColor: strokeColor }]} />
          <View style={[styles.webPin, styles.webPinStart]}>
            <Text style={styles.webPinText}>Pickup</Text>
          </View>
          <View style={[styles.webPin, styles.webPinEnd]}>
            <Text style={styles.webPinText}>Drop</Text>
          </View>
          {liveCoord && (
            <View style={styles.webLivePin}>
              <Ionicons name={vehicleType === 'bike' ? 'bicycle' : 'car'} size={14} color="#FFF" />
            </View>
          )}
        </View>
      </View>
    );
  }

  const initialRegion = {
    latitude: (startCoord.latitude + endCoord.latitude) / 2,
    longitude: (startCoord.longitude + endCoord.longitude) / 2,
    latitudeDelta: Math.abs(startCoord.latitude - endCoord.latitude) * 1.5 || 0.05,
    longitudeDelta: Math.abs(startCoord.longitude - endCoord.longitude) * 1.5 || 0.05,
  };

  return (
    <View style={[styles.container, style]}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={true}
        showsMyLocationButton={true}
      >
        {/* Routed Polyline */}
        <Polyline
          coordinates={routeCoords.length > 0 ? routeCoords : [startCoord, endCoord]}
          strokeColor={strokeColor}
          strokeWidth={4}
          lineDashPattern={lineDashPattern}
        />

        {/* Start / Pickup Marker */}
        <Marker coordinate={startCoord} title="Pickup">
          <View style={styles.redMarkerContainer}>
            <View style={styles.redMarkerDot} />
          </View>
        </Marker>

        {/* Destination / Drop Marker */}
        <Marker coordinate={endCoord} title="Drop Off">
          <View style={styles.darkMarkerContainer}>
            <View style={styles.darkMarkerDot} />
          </View>
        </Marker>

        {/* Optional Live Location Marker */}
        {liveCoord && (
          <Marker coordinate={liveCoord} title="Rider Location">
            <View style={styles.liveRiderContainer}>
              <View style={styles.livePulseRing} />
              <View style={styles.liveRiderBadge}>
                <Ionicons
                  name={vehicleType === 'bike' ? 'bicycle' : 'car'}
                  size={16}
                  color="#FFF"
                />
              </View>
            </View>
          </Marker>
        )}
      </MapView>

      {/* Floating Zoom Controls Overlay */}
      {showControls && (
        <View style={styles.zoomControlsContainer}>
          <TouchableOpacity style={styles.zoomButton} onPress={handleZoomIn}>
            <Ionicons name="add" size={20} color="#334155" />
          </TouchableOpacity>
          <View style={styles.zoomDivider} />
          <TouchableOpacity style={styles.zoomButton} onPress={handleZoomOut}>
            <Ionicons name="remove" size={20} color="#334155" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  zoomControlsContainer: {
    position: 'absolute',
    top: 60,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    overflow: 'hidden',
  },
  zoomButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  redMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  redMarkerDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#C62026',
    borderWidth: 4,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  darkMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  darkMarkerDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    borderWidth: 3,
    borderColor: '#FFF',
  },
  liveRiderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
  },
  livePulseRing: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(198, 32, 38, 0.25)',
  },
  liveRiderBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#C62026',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  webFallbackContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F8FAFC',
  },
  webCanvas: {
    flex: 1,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  webNoticeText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    position: 'absolute',
    top: 12,
  },
  webRouteLine: {
    position: 'absolute',
    width: '60%',
    height: 3,
    backgroundColor: '#C62026',
  },
  webPin: {
    position: 'absolute',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  webPinStart: {
    left: '15%',
    backgroundColor: '#C62026',
  },
  webPinEnd: {
    right: '15%',
    backgroundColor: '#1E293B',
  },
  webPinText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  webLivePin: {
    position: 'absolute',
    left: '45%',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#C62026',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
});
