export interface LatLng {
  lat: number;
  lng: number;
}

// Alias for backward compatibility with coordinate interfaces
export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface MatchResult {
  isValid: boolean;
  pickupIndex?: number;
  dropoffIndex?: number;
  pickupDistance?: number;
  dropoffDistance?: number;
  reason?: 'outside_route' | 'wrong_direction' | string;
}

export interface RouteMatchResult extends MatchResult {
  pickupCoord?: Coordinate;
  dropoffCoord?: Coordinate;
  pickupDistMeters: number;
  dropoffDistMeters: number;
  reason?: string;
}

/**
 * 1. Decode an Encoded Polyline algorithm string into an array of {lat, lng} coordinates.
 * Index 0 = route origin, last index = route destination.
 */
export function decodePolyline(encoded: string): LatLng[] {
  if (!encoded) return [];
  const points: LatLng[] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({
      lat: lat / 1e5,
      lng: lng / 1e5,
    });
  }

  return points;
}

/**
 * 2. Calculates distance in meters between two {lat, lng} points using Haversine formula.
 */
export function haversineDistance(pointA: LatLng, pointB: LatLng): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((pointB.lat - pointA.lat) * Math.PI) / 180;
  const dLon = ((pointB.lng - pointA.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((pointA.lat * Math.PI) / 180) *
      Math.cos((pointB.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function getHaversineDistanceMeters(coord1: Coordinate, coord2: Coordinate): number {
  return haversineDistance(
    { lat: coord1.latitude, lng: coord1.longitude },
    { lat: coord2.latitude, lng: coord2.longitude }
  );
}

/**
 * Projects a target point onto a line segment (p1 -> p2) and returns minimum distance in meters and fractional projection factor t.
 */
export function distanceToSegmentMeters(
  point: LatLng,
  p1: LatLng,
  p2: LatLng
): { distanceMeters: number; projectedCoord: LatLng; t: number } {
  const x = point.lng;
  const y = point.lat;
  const x1 = p1.lng;
  const y1 = p1.lat;
  const x2 = p2.lng;
  const y2 = p2.lat;

  const dx = x2 - x1;
  const dy = y2 - y1;

  if (dx === 0 && dy === 0) {
    const dist = haversineDistance(point, p1);
    return { distanceMeters: dist, projectedCoord: p1, t: 0 };
  }

  let t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));

  const projCoord: LatLng = {
    lat: y1 + t * dy,
    lng: x1 + t * dx,
  };

  const dist = haversineDistance(point, projCoord);
  return { distanceMeters: dist, projectedCoord: projCoord, t };
}

/**
 * 3. Scans routePoints, returns the index (and fractional index) of nearest point along route and distance in meters from target.
 */
export function findClosestPointOnRoute(
  target: LatLng,
  routePoints: LatLng[]
): { index: number; fractionalIndex: number; distance: number; snappedPoint: LatLng } {
  if (!routePoints || routePoints.length === 0) {
    return { index: -1, fractionalIndex: -1, distance: Infinity, snappedPoint: target };
  }

  if (routePoints.length === 1) {
    const dist = haversineDistance(target, routePoints[0]);
    return { index: 0, fractionalIndex: 0, distance: dist, snappedPoint: routePoints[0] };
  }

  let minDistance = Infinity;
  let bestIndex = 0;
  let bestFractionalIndex = 0;
  let bestSnappedPoint = routePoints[0];

  for (let i = 0; i < routePoints.length - 1; i++) {
    const p1 = routePoints[i];
    const p2 = routePoints[i + 1];
    const { distanceMeters, projectedCoord, t } = distanceToSegmentMeters(target, p1, p2);

    if (distanceMeters < minDistance) {
      minDistance = distanceMeters;
      bestIndex = i;
      bestFractionalIndex = i + t;
      bestSnappedPoint = projectedCoord;
    }
  }

  return {
    index: bestIndex,
    fractionalIndex: bestFractionalIndex,
    distance: minDistance,
    snappedPoint: bestSnappedPoint,
  };
}

/**
 * 4. Pure matching function that checks if passenger origin & destination lie along driver's route polyline.
 */
export function matchPassengerToRide(
  passengerOrigin: LatLng | Coordinate | undefined | null,
  passengerDestination: LatLng | Coordinate | undefined | null,
  encodedPolyline: string | LatLng[],
  thresholdMeters: number = 800
): MatchResult {
  if (!passengerOrigin || !passengerDestination) {
    return { isValid: false, reason: 'outside_route' };
  }

  const pOrigin: LatLng = 'latitude' in passengerOrigin
    ? { lat: passengerOrigin.latitude, lng: passengerOrigin.longitude }
    : passengerOrigin;

  const pDest: LatLng = 'latitude' in passengerDestination
    ? { lat: passengerDestination.latitude, lng: passengerDestination.longitude }
    : passengerDestination;

  const routePoints: LatLng[] = typeof encodedPolyline === 'string'
    ? decodePolyline(encodedPolyline)
    : encodedPolyline;

  if (!routePoints || routePoints.length < 2) {
    return { isValid: false, reason: 'outside_route' };
  }

  const pickupSnap = findClosestPointOnRoute(pOrigin, routePoints);
  const dropoffSnap = findClosestPointOnRoute(pDest, routePoints);

  if (pickupSnap.distance > thresholdMeters || dropoffSnap.distance > thresholdMeters) {
    return {
      isValid: false,
      pickupIndex: pickupSnap.index,
      dropoffIndex: dropoffSnap.index,
      pickupDistance: pickupSnap.distance,
      dropoffDistance: dropoffSnap.distance,
      reason: 'outside_route',
    };
  }

  // Reject reversed or identical point matches along driver's direction of travel
  if (dropoffSnap.fractionalIndex <= pickupSnap.fractionalIndex) {
    return {
      isValid: false,
      pickupIndex: pickupSnap.index,
      dropoffIndex: dropoffSnap.index,
      pickupDistance: pickupSnap.distance,
      dropoffDistance: dropoffSnap.distance,
      reason: 'wrong_direction',
    };
  }

  return {
    isValid: true,
    pickupIndex: pickupSnap.index,
    dropoffIndex: dropoffSnap.index,
    pickupDistance: pickupSnap.distance,
    dropoffDistance: dropoffSnap.distance,
  };
}

export function matchPassengerToRoute(
  driverPolyline: Coordinate[] | LatLng[] | string,
  passengerOrigin: Coordinate | LatLng | undefined | null,
  passengerDestination: Coordinate | LatLng | undefined | null,
  thresholdMeters: number = 800
): RouteMatchResult {
  const result = matchPassengerToRide(passengerOrigin, passengerDestination, driverPolyline as any, thresholdMeters);
  return {
    ...result,
    pickupDistMeters: result.pickupDistance ?? Infinity,
    dropoffDistMeters: result.dropoffDistance ?? Infinity,
    reason: result.isValid
      ? 'Valid route match!'
      : result.reason === 'wrong_direction'
      ? 'Drop-off location must come after pickup location along driver\'s route direction.'
      : 'Location is too far from the driver\'s route.',
  };
}

/**
 * Calculates total cumulative distance of a polyline in meters.
 */
export function getPolylineTotalDistanceMeters(polyCoords: LatLng[] | Coordinate[]): number {
  let total = 0;
  for (let i = 0; i < polyCoords.length - 1; i++) {
    const p1 = 'lat' in polyCoords[i] ? (polyCoords[i] as LatLng) : { lat: (polyCoords[i] as Coordinate).latitude, lng: (polyCoords[i] as Coordinate).longitude };
    const p2 = 'lat' in polyCoords[i + 1] ? (polyCoords[i + 1] as LatLng) : { lat: (polyCoords[i + 1] as Coordinate).latitude, lng: (polyCoords[i + 1] as Coordinate).longitude };
    total += haversineDistance(p1, p2);
  }
  return total;
}

/**
 * Calculates distance along a polyline between pickup and dropoff snap points.
 */
export function getSubPolylineDistanceMeters(
  polyCoords: LatLng[] | Coordinate[],
  passengerOrigin: LatLng | Coordinate,
  passengerDestination: LatLng | Coordinate
): number {
  const points: LatLng[] = polyCoords.map(p =>
    'lat' in p ? p : { lat: p.latitude, lng: p.longitude }
  );
  const pOrigin: LatLng = 'lat' in passengerOrigin ? passengerOrigin : { lat: passengerOrigin.latitude, lng: passengerOrigin.longitude };
  const pDest: LatLng = 'lat' in passengerDestination ? passengerDestination : { lat: passengerDestination.latitude, lng: passengerDestination.longitude };

  if (!points || points.length < 2) return 0;

  const pickupSnap = findClosestPointOnRoute(pOrigin, points);
  const dropoffSnap = findClosestPointOnRoute(pDest, points);

  const startIdx = pickupSnap.index;
  const endIdx = dropoffSnap.index;

  if (startIdx === endIdx) {
    return haversineDistance(pickupSnap.snappedPoint, dropoffSnap.snappedPoint);
  }

  let distance = 0;
  distance += haversineDistance(pickupSnap.snappedPoint, points[startIdx + 1]);

  for (let i = startIdx + 1; i < endIdx; i++) {
    distance += haversineDistance(points[i], points[i + 1]);
  }

  distance += haversineDistance(points[endIdx], dropoffSnap.snappedPoint);
  return distance;
}

/**
 * Calculates prorated fare for a passenger based on partial ride distance relative to full route distance.
 */
export function calculateProratedFare(
  driverPolyline: LatLng[] | Coordinate[] | string,
  passengerOrigin: LatLng | Coordinate,
  passengerDestination: LatLng | Coordinate,
  fullPrice: number,
  minFare: number = 30
): number {
  const polyCoords: LatLng[] = typeof driverPolyline === 'string'
    ? decodePolyline(driverPolyline)
    : driverPolyline.map(p => ('lat' in p ? p : { lat: p.latitude, lng: p.longitude }));

  if (!polyCoords || polyCoords.length < 2 || fullPrice <= 0) {
    return fullPrice;
  }

  const totalDistance = getPolylineTotalDistanceMeters(polyCoords);
  if (totalDistance <= 0) return fullPrice;

  const passengerDistance = getSubPolylineDistanceMeters(polyCoords, passengerOrigin, passengerDestination);
  const ratio = Math.min(1, Math.max(0, passengerDistance / totalDistance));

  const rawFare = ratio * fullPrice;
  const roundedFare = Math.round(rawFare / 5) * 5;

  return Math.max(minFare, roundedFare);
}

/*
================================================================================
INLINE TEST SCENARIOS FOR matchPassengerToRide
================================================================================
// Driver route: Butwal (27.7006, 83.4484) -> Khaireni (27.6500, 83.5500) -> Bhumahi (27.5800, 83.6200) -> Bardaghat (27.5300, 83.6800)
// Encoded polyline representation of Butwal-Bardaghat corridor points:
const samplePolyline = [
  { lat: 27.7006, lng: 83.4484 }, // Point 0: Butwal (Origin)
  { lat: 27.6500, lng: 83.5500 }, // Point 1: Khaireni
  { lat: 27.5800, lng: 83.6200 }, // Point 2: Bhumahi
  { lat: 27.5300, lng: 83.6800 }  // Point 3: Bardaghat (Destination)
];

// Case A: Exact match (Butwal -> Bardaghat)
// matchPassengerToRide({ lat: 27.7006, lng: 83.4484 }, { lat: 27.5300, lng: 83.6800 }, samplePolyline)
// -> Result: { isValid: true, pickupIndex: 0, dropoffIndex: 2, pickupDistance: 0, dropoffDistance: 0 }

// Case B: Front segment (Butwal -> Khaireni)
// matchPassengerToRide({ lat: 27.7006, lng: 83.4484 }, { lat: 27.6500, lng: 83.5500 }, samplePolyline)
// -> Result: { isValid: true, pickupIndex: 0, dropoffIndex: 0 (snapped on segment), pickupDistance: 0, dropoffDistance: 0 }

// Case C: Back segment (Bhumahi -> Bardaghat)
// matchPassengerToRide({ lat: 27.5800, lng: 83.6200 }, { lat: 27.5300, lng: 83.6800 }, samplePolyline)
// -> Result: { isValid: true, pickupIndex: 2, dropoffIndex: 2, pickupDistance: 0, dropoffDistance: 0 }

// Case D: Middle segment (Khaireni -> Bhumahi) - e.g. user search request
// matchPassengerToRide({ lat: 27.6500, lng: 83.5500 }, { lat: 27.5800, lng: 83.6200 }, samplePolyline)
// -> Result: { isValid: true, pickupIndex: 1, dropoffIndex: 1, pickupDistance: 0, dropoffDistance: 0 }

// Case E: Wrong direction / Reversed (Bardaghat -> Butwal)
// matchPassengerToRide({ lat: 27.5300, lng: 83.6800 }, { lat: 27.7006, lng: 83.4484 }, samplePolyline)
// -> Result: { isValid: false, reason: "wrong_direction" }

// Case F: Outside route (Kathmandu -> Pokhara)
// matchPassengerToRide({ lat: 27.7172, lng: 85.3240 }, { lat: 28.2096, lng: 83.9856 }, samplePolyline, 800)
// -> Result: { isValid: false, reason: "outside_route" }
================================================================================
*/
