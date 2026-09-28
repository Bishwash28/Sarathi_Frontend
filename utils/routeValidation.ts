export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface ValidationResult {
  isValid: boolean;
  reason: string;
  pickupIndex?: number;
  dropoffIndex?: number;
}

/**
 * Calculates distance between two coordinates in kilometers (Haversine formula)
 */
export function getDistanceKm(coord1: Coordinate, coord2: Coordinate): number {
  const R = 6371; // Earth radius in km
  const dLat = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
  const dLon = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((coord1.latitude * Math.PI) / 180) *
      Math.cos((coord2.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Finds index of a landmark query in a driver's route array (case-insensitive substring match)
 */
export function findLandmarkIndexInRoute(query: string, route: string[]): number {
  if (!query || !route || route.length === 0) return -1;
  const cleanQuery = query.trim().toLowerCase();

  // 1. Exact match
  const exactIdx = route.findIndex(
    (landmark) => landmark.toLowerCase() === cleanQuery
  );
  if (exactIdx !== -1) return exactIdx;

  // 2. Substring match
  return route.findIndex(
    (landmark) =>
      landmark.toLowerCase().includes(cleanQuery) ||
      cleanQuery.includes(landmark.toLowerCase())
  );
}

/**
 * Validates whether a passenger's requested journey (pickup -> dropoff)
 * is along the driver's published route corridor.
 */
export function validatePassengerJourney(
  driverRoute: string[],
  passengerPickup: string,
  passengerDropoff: string
): ValidationResult {
  if (!passengerPickup || !passengerPickup.trim()) {
    return {
      isValid: false,
      reason: 'Please enter or select a pickup location.',
    };
  }

  if (!passengerDropoff || !passengerDropoff.trim()) {
    return {
      isValid: false,
      reason: 'Please enter or select a drop-off location.',
    };
  }

  if (passengerPickup.trim().toLowerCase() === passengerDropoff.trim().toLowerCase()) {
    return {
      isValid: false,
      reason: 'Pickup and drop-off locations cannot be the same.',
    };
  }

  const pickupIdx = findLandmarkIndexInRoute(passengerPickup, driverRoute);
  const dropoffIdx = findLandmarkIndexInRoute(passengerDropoff, driverRoute);

  // Check 1: Pickup is on/near driver route
  if (pickupIdx === -1) {
    return {
      isValid: false,
      reason: `Pickup location "${passengerPickup}" is outside the driver's route.`,
    };
  }

  // Check 2: Drop-off is on/near driver route
  if (dropoffIdx === -1) {
    return {
      isValid: false,
      reason: `Drop-off location "${passengerDropoff}" is outside the driver's route.`,
    };
  }

  // Check 3: Pickup comes BEFORE drop-off according to driver's travel direction
  if (pickupIdx >= dropoffIdx) {
    return {
      isValid: false,
      reason: `Drop-off (${passengerDropoff}) must come after pickup (${passengerPickup}) along driver's route direction.`,
      pickupIndex: pickupIdx,
      dropoffIndex: dropoffIdx,
    };
  }

  // All checks satisfied!
  return {
    isValid: true,
    reason: `Journey from ${driverRoute[pickupIdx]} to ${driverRoute[dropoffIdx]} is along the driver's route!`,
    pickupIndex: pickupIdx,
    dropoffIndex: dropoffIdx,
  };
}

/**
 * Automatically computes intermediate corridor stops between Point A and Point B
 * based on geographical locations along the travel line segment.
 */
export function getAutoRouteCorridor(
  pointA: string,
  pointB: string,
  landmarksMap: Record<string, { latitude: number; longitude: number; name: string }>
): string[] {
  if (!pointA || !pointB) return [pointA, pointB].filter(Boolean);
  const cleanA = pointA.trim().toLowerCase();
  const cleanB = pointB.trim().toLowerCase();

  const startEntry = Object.entries(landmarksMap).find(([k]) =>
    k.toLowerCase().includes(cleanA) || cleanA.includes(k.toLowerCase())
  );
  const endEntry = Object.entries(landmarksMap).find(([k]) =>
    k.toLowerCase().includes(cleanB) || cleanB.includes(k.toLowerCase())
  );

  const canonicalA = startEntry ? startEntry[0] : pointA.trim();
  const canonicalB = endEntry ? endEntry[0] : pointB.trim();

  if (!startEntry || !endEntry || startEntry[0] === endEntry[0]) {
    return [canonicalA, canonicalB];
  }

  const startCoord = startEntry[1];
  const endCoord = endEntry[1];

  const dx = endCoord.longitude - startCoord.longitude;
  const dy = endCoord.latitude - startCoord.latitude;
  const lineLenSq = dx * dx + dy * dy;

  if (lineLenSq === 0) return [canonicalA, canonicalB];

  const intermediates: { name: string; t: number }[] = [];

  for (const [name, coord] of Object.entries(landmarksMap)) {
    if (name === startEntry[0] || name === endEntry[0]) continue;

    const px = coord.longitude - startCoord.longitude;
    const py = coord.latitude - startCoord.latitude;

    // Projection factor t (0 to 1) along vector from start to end
    const t = (px * dx + py * dy) / lineLenSq;

    if (t > 0.05 && t < 0.95) {
      // Perpendicular distance to line
      const projX = startCoord.longitude + t * dx;
      const projY = startCoord.latitude + t * dy;
      const perpDistKm = getDistanceKm(coord, { latitude: projY, longitude: projX });

      // Max corridor width tolerance (within 12 km perpendicular offset)
      if (perpDistKm <= 12) {
        intermediates.push({ name, t });
      }
    }
  }

  // Sort intermediate landmarks in order of travel from start to end
  intermediates.sort((a, b) => a.t - b.t);

  return [canonicalA, ...intermediates.map((item) => item.name), canonicalB];
}
