/**
 * locationService.ts
 * Module for Places Autocomplete, Geocoding, and Directions APIs.
 * Supports Google Maps API with fallback to OpenStreetMap / Nominatim / OSRM when key is not present.
 */

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

export interface RouteInfo {
  encodedPolyline: string;
  distanceMeters?: number;
  durationSeconds?: number;
  points?: LocationCoordinates[];
}

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

/**
 * Fetch autocomplete suggestions for place search.
 * Biased/restricted to Nepal (country code 'np').
 */
export async function getPlaceSuggestions(input: string): Promise<PlaceSuggestion[]> {
  if (!input || !input.trim()) return [];
  return searchPlaces(input);
}

/**
 * Resolve raw text address to { lat, lng } using Google Geocoding API (or Nominatim fallback).
 */
export async function geocodeAddress(addressText: string): Promise<{ coordinates: LocationCoordinates; formattedAddress: string } | null> {
  if (!addressText || !addressText.trim()) return null;
  const cleanInput = addressText.trim();

  // 1. Google Geocoding API with Nepal country restriction
  if (GOOGLE_MAPS_API_KEY) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        cleanInput
      )}&components=country:NP&key=${GOOGLE_MAPS_API_KEY}`;
      const res = await fetch(url);
      const json = await res.json();

      if (json.status === 'OK' && json.results && json.results.length > 0) {
        const result = json.results[0];
        return {
          coordinates: {
            lat: result.geometry.location.lat,
            lng: result.geometry.location.lng,
          },
          formattedAddress: result.formatted_address || cleanInput,
        };
      }
    } catch (err) {
      console.warn('[locationService] Google Geocoding API fallback failed:', err);
    }
  }

  // 2. OpenStreetMap Nominatim Geocoding fallback
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=np&q=${encodeURIComponent(
      cleanInput
    )}&limit=1`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'SarathiApp/1.0',
        'Accept-Language': 'en',
      },
    });
    const json = await res.json();
    if (Array.isArray(json) && json.length > 0) {
      const item = json[0];
      return {
        coordinates: {
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
        },
        formattedAddress: item.display_name,
      };
    }
  } catch (err) {
    console.warn('[locationService] Nominatim geocoding fallback failed:', err);
  }

  return null;
}

/**
 * Resolve place_id to { lat, lng } coordinates.
 */
export async function getPlaceDetails(placeId: string, preResolvedCoords?: LocationCoordinates): Promise<LocationCoordinates | null> {
  if (preResolvedCoords) {
    return preResolvedCoords;
  }

  if (GOOGLE_MAPS_API_KEY && !placeId.startsWith('osm-')) {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry&key=${GOOGLE_MAPS_API_KEY}`;
      const res = await fetch(url);
      const json = await res.json();

      if (json.status === 'OK' && json.result?.geometry?.location) {
        return {
          lat: json.result.geometry.location.lat,
          lng: json.result.geometry.location.lng,
        };
      }
    } catch (err) {
      console.warn('[locationService] Google Place Details failed:', err);
    }
  }

  return null;
}

/**
 * Call Directions API to get route & overview encoded polyline.
 */
export async function getRouteDirections(
  origin: LocationCoordinates,
  destination: LocationCoordinates
): Promise<RouteInfo> {
  // 1. Google Directions API
  if (GOOGLE_MAPS_API_KEY) {
    try {
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&key=${GOOGLE_MAPS_API_KEY}`;
      const res = await fetch(url);
      const json = await res.json();

      if (json.status === 'OK' && json.routes && json.routes.length > 0) {
        const route = json.routes[0];
        const polyline = route.overview_polyline?.points || '';
        const leg = route.legs?.[0];
        return {
          encodedPolyline: polyline,
          distanceMeters: leg?.distance?.value,
          durationSeconds: leg?.duration?.value,
        };
      }
    } catch (err) {
      console.warn('[locationService] Google Directions failed:', err);
    }
  }

  // 2. OSRM (Open Source Routing Machine) fallback
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=polyline`;
    const res = await fetch(url);
    const json = await res.json();

    if (json.code === 'Ok' && json.routes && json.routes.length > 0) {
      const route = json.routes[0];
      return {
        encodedPolyline: route.geometry || '',
        distanceMeters: route.distance,
        durationSeconds: route.duration,
      };
    }
  } catch (err) {
    console.warn('[locationService] OSRM Directions fallback failed:', err);
  }

  // Fallback simple polyline placeholder if service is unreachable
  return {
    encodedPolyline: `_p~iF~ps|U_ulLnnqC_mqNvxq`
  };
}

/**
 * Search places using OpenStreetMap Nominatim API.
 * Biased/restricted to Nepal (countrycodes=np), User-Agent header included.
 */
export async function searchPlaces(query: string): Promise<PlaceSuggestion[]> {
  if (!query || !query.trim()) return [];
  const cleanInput = query.trim();

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=np&q=${encodeURIComponent(
      cleanInput
    )}&limit=5&addressdetails=1`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Sarathi-RideShareApp/1.0',
        'Accept-Language': 'en',
      },
    });

    if (!res.ok) {
      throw new Error(`Nominatim HTTP ${res.status}`);
    }

    const json = await res.json();
    if (Array.isArray(json) && json.length > 0) {
      return json.map((item: any) => {
        const shortName = formatDisplayName(item.display_name);
        const parts = item.display_name.split(',').map((p: string) => p.trim());
        const main = parts[0] || item.name || 'Location';
        const secondary = parts.slice(1, 3).join(', ') || 'Nepal';

        return {
          placeId: `osm-${item.place_id}`,
          description: shortName,
          mainText: main,
          secondaryText: secondary,
          coordinates: {
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
          },
        };
      });
    }
  } catch (err) {
    console.warn('[locationService] searchPlaces (Nominatim) failed:', err);
  }

  return [];
}

/**
 * Format long Nominatim display_name into a readable short location string (first 2-3 segments).
 */
export function formatDisplayName(displayName: string): string {
  if (!displayName || !displayName.trim()) return '';
  const parts = displayName.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length <= 3) return parts.join(', ');
  // Pick first 2 or 3 relevant segments (e.g., "Butwal, Rupandehi, Nepal")
  const firstSegment = parts[0];
  const secondSegment = parts[1];
  const lastSegment = parts[parts.length - 1]; // Country name if present

  // If lastSegment is country e.g. "Nepal" and not already in first two
  if (lastSegment && !firstSegment.includes(lastSegment) && !secondSegment.includes(lastSegment)) {
    return `${firstSegment}, ${secondSegment}, ${lastSegment}`;
  }
  return `${firstSegment}, ${secondSegment}`;
}

/**
 * OpenStreetMap Nominatim Reverse Geocoding API helper.
 * Complies with Nominatim usage policy (User-Agent header required).
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Sarathi-RideShareApp/1.0',
        'Accept-Language': 'en',
      },
    });

    if (!res.ok) {
      throw new Error(`Nominatim HTTP ${res.status}`);
    }

    const json = await res.json();
    if (json && json.display_name) {
      return formatDisplayName(json.display_name);
    }
  } catch (err) {
    console.warn('[locationService] reverseGeocode failed:', err);
  }

  // Fallback to raw lat, lng if call fails or returns empty
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

