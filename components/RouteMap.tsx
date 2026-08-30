import React, { useRef, useEffect } from 'react';
import { StyleSheet, View, Text, Platform, TouchableOpacity } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface Waypoint {
  coordinate: Coordinate;
  title: string;
}

interface RouteMapProps {
  startCoord: Coordinate; // Driver Point A (Start)
  endCoord: Coordinate;   // Driver Point B (End)
  startTitle?: string;
  endTitle?: string;
  driverLocation?: Coordinate; // Driver's current location (Red marker)
  passengerLocation?: Coordinate; // Passenger's current location (Blue marker)
  passengerPickupCoord?: Coordinate; // Passenger selected pickup
  passengerPickupTitle?: string;
  passengerDropoffCoord?: Coordinate; // Passenger selected dropoff
  passengerDropoffTitle?: string;
  waypoints?: Waypoint[]; // Intermediate corridor points
  liveCoord?: Coordinate; // Legacy alias for driver location
  vehicleType?: 'bike' | 'scooter';
  strokeColor?: string;
  lineDashPattern?: number[];
  showControls?: boolean;
  style?: any;
}

export const RouteMap: React.FC<RouteMapProps> = ({
  startCoord,
  endCoord,
  startTitle = 'Start Location',
  endTitle = 'Destination',
  driverLocation,
  passengerLocation,
  passengerPickupCoord,
  passengerPickupTitle = 'Passenger Pickup',
  passengerDropoffCoord,
  passengerDropoffTitle = 'Passenger Dropoff',
  waypoints = [],
  liveCoord,
  vehicleType = 'bike',
  strokeColor = '#C62026',
  lineDashPattern,
  showControls = true,
  style,
}) => {
  const mapRef = useRef<MapView>(null);
  const [routeCoords, setRouteCoords] = React.useState<Coordinate[]>([]);

  // Driver current position marker
  const effectiveDriverCoord = driverLocation || liveCoord;

  useEffect(() => {
    const fetchRoute = async () => {
      try {
        // Construct waypoints for OSRM driving route request
        let waypointsString = `${startCoord.longitude},${startCoord.latitude}`;
        
        if (waypoints && waypoints.length > 0) {
          const wpStr = waypoints.map(w => `${w.coordinate.longitude},${w.coordinate.latitude}`).join(';');
          waypointsString += `;${wpStr}`;
        }
        
        waypointsString += `;${endCoord.longitude},${endCoord.latitude}`;

        const url = `https://router.project-osrm.org/route/v1/driving/${waypointsString}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.routes && data.routes[0]) {
          const coords = data.routes[0].geometry.coordinates.map((coord: [number, number]) => ({
            latitude: coord[1],
            longitude: coord[0],
          }));
          setRouteCoords(coords);
        } else {
          setRouteCoords([startCoord, ...waypoints.map(w => w.coordinate), endCoord]);
        }
      } catch (err) {
        console.warn("Failed to fetch OSRM route:", err);
        setRouteCoords([startCoord, ...waypoints.map(w => w.coordinate), endCoord]);
      }
    };
    fetchRoute();
  }, [startCoord, endCoord, waypoints]);

  useEffect(() => {
    if (Platform.OS !== 'web' && mapRef.current) {
      const coords = routeCoords.length > 0 ? [...routeCoords] : [startCoord, endCoord];
      if (effectiveDriverCoord) coords.push(effectiveDriverCoord);
      if (passengerLocation) coords.push(passengerLocation);
      if (passengerPickupCoord) coords.push(passengerPickupCoord);
      if (passengerDropoffCoord) coords.push(passengerDropoffCoord);

      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 70, right: 70, bottom: 70, left: 70 },
        animated: true,
      });
    }
  }, [startCoord, endCoord, effectiveDriverCoord, passengerLocation, passengerPickupCoord, passengerDropoffCoord, routeCoords]);

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
          <Text style={styles.webNoticeText}>Driver Route Corridor Map</Text>
          <View style={[styles.webRouteLine, { backgroundColor: strokeColor }]} />
          
          <View style={[styles.webPin, styles.webPinStart]}>
            <Text style={styles.webPinText}>{startTitle}</Text>
          </View>

          {passengerPickupCoord && (
            <View style={[styles.webPin, styles.webPinPickup]}>
              <Text style={styles.webPinText}>Pickup</Text>
            </View>
          )}

          {passengerDropoffCoord && (
            <View style={[styles.webPin, styles.webPinDropoff]}>
              <Text style={styles.webPinText}>Dropoff</Text>
            </View>
          )}

          <View style={[styles.webPin, styles.webPinEnd]}>
            <Text style={styles.webPinText}>{endTitle}</Text>
          </View>

          {effectiveDriverCoord && (
            <View style={styles.webDriverPin}>
              <Ionicons name={vehicleType === 'bike' ? 'bicycle' : 'speedometer-outline'} size={14} color="#FFF" />
            </View>
          )}

          {passengerLocation && (
            <View style={styles.webPassengerPin}>
              <Ionicons name="person" size={14} color="#FFF" />
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
        showsUserLocation={false}
        showsMyLocationButton={false}
      >
        {/* Driver Published Route Polyline */}
        <Polyline
          coordinates={routeCoords.length > 0 ? routeCoords : [startCoord, endCoord]}
          strokeColor={strokeColor}
          strokeWidth={4.5}
          lineDashPattern={lineDashPattern}
        />

        {/* Driver Start Location Marker */}
        <Marker coordinate={startCoord} title={startTitle}>
          <View style={styles.startMarkerContainer}>
            <Ionicons name="location" size={28} color="#2563EB" />
          </View>
        </Marker>

        {/* Driver Destination Marker */}
        <Marker coordinate={endCoord} title={endTitle}>
          <View style={styles.endMarkerContainer}>
            <Ionicons name="location" size={28} color="#0F172A" />
          </View>
        </Marker>

        {/* Driver Current Location Red Marker */}
        {effectiveDriverCoord && (
          <Marker coordinate={effectiveDriverCoord} title="Driver Current Location">
            <View style={styles.liveDriverContainer}>
              <View style={styles.livePulseRingRed} />
              <View style={styles.driverBadgeRed}>
                <Ionicons
                  name={vehicleType === 'bike' ? 'bicycle' : 'speedometer-outline'}
                  size={16}
                  color="#FFF"
                />
              </View>
            </View>
          </Marker>
        )}

        {/* Passenger Current Location Blue Marker */}
        {passengerLocation && (
          <Marker coordinate={passengerLocation} title="Passenger Current Location">
            <View style={styles.passengerLocationContainer}>
              <View style={styles.livePulseRingBlue} />
              <View style={styles.passengerBadgeBlue}>
                <Ionicons name="person" size={14} color="#FFF" />
              </View>
            </View>
          </Marker>
        )}

        {/* Passenger Selected Pickup Marker */}
        {passengerPickupCoord && (
          <Marker coordinate={passengerPickupCoord} title={passengerPickupTitle}>
            <View style={styles.passengerPickupPin}>
              <Ionicons name="location" size={24} color="#16A34A" />
            </View>
          </Marker>
        )}

        {/* Passenger Selected Dropoff Marker */}
        {passengerDropoffCoord && (
          <Marker coordinate={passengerDropoffCoord} title={passengerDropoffTitle}>
            <View style={styles.passengerDropoffPin}>
              <Ionicons name="location" size={24} color="#DC2626" />
            </View>
          </Marker>
        )}

        {/* Intermediate Corridor Waypoint Dots */}
        {waypoints.map((wp, i) => (
          <Marker key={`wp-${i}`} coordinate={wp.coordinate} title={wp.title}>
            <View style={styles.waypointDot} />
          </Marker>
        ))}
      </MapView>
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
  startMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  startMarkerBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  endMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  endMarkerBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0F172A',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerBadgeText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 12,
  },
  liveDriverContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
  },
  livePulseRingRed: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(220, 38, 38, 0.3)',
  },
  driverBadgeRed: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  passengerLocationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: 34,
  },
  livePulseRingBlue: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(37, 99, 235, 0.3)',
  },
  passengerBadgeBlue: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  passengerPickupPin: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  passengerDropoffPin: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  waypointDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#64748B',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
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
    width: '70%',
    height: 4,
    backgroundColor: '#C62026',
  },
  webPin: {
    position: 'absolute',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  webPinStart: {
    left: '10%',
    backgroundColor: '#2563EB',
  },
  webPinPickup: {
    left: '30%',
    backgroundColor: '#16A34A',
  },
  webPinDropoff: {
    right: '30%',
    backgroundColor: '#DC2626',
  },
  webPinEnd: {
    right: '10%',
    backgroundColor: '#0F172A',
  },
  webPinText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  webDriverPin: {
    position: 'absolute',
    left: '20%',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  webPassengerPin: {
    position: 'absolute',
    left: '35%',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
});
