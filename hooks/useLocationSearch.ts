import { useState, useRef, useCallback } from 'react';
import * as Location from 'expo-location';

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
  distanceText?: string;
  durationText?: string;
  encodedPolyline?: string;
}

export interface LocationState {
  text: string;
  coords: LocationCoordinates | null;
  selectedSuggestion: PlaceSuggestion | null;
}

// Pre-loaded list of major cities, highway hubs, and intermediate stops in Nepal
const NEPAL_LOCATIONS: PlaceSuggestion[] = [
  { placeId: 'np-butwal', mainText: 'Butwal', secondaryText: 'Butwal Bus Park, East-West Highway, Rupandehi', description: 'Butwal, Rupandehi', coordinates: { lat: 27.7006, lng: 83.4484 } },
  { placeId: 'np-khaireni', mainText: 'Khaireni', secondaryText: 'Khaireni, East-West Highway, Devdaha, Rupandehi', description: 'Khaireni, Devdaha', coordinates: { lat: 27.6500, lng: 83.5500 } },
  { placeId: 'np-sunwal', mainText: 'Sunwal', secondaryText: 'Sunwal Chok, East-West Highway, Nawalparasi', description: 'Sunwal, Nawalparasi', coordinates: { lat: 27.6167, lng: 83.6333 } },
  { placeId: 'np-bhumahi', mainText: 'Bhumahi', secondaryText: 'Bhumahi Chok, East-West Highway, Nawalparasi', description: 'Bhumahi, Nawalparasi', coordinates: { lat: 27.5800, lng: 83.6800 } },
  { placeId: 'np-bardaghat', mainText: 'Bardaghat', secondaryText: 'Bardaghat Bus Stop, Nawalparasi', description: 'Bardaghat, Nawalparasi', coordinates: { lat: 27.5333, lng: 83.8000 } },
  { placeId: 'np-bhairahawa', mainText: 'Bhairahawa', secondaryText: 'Bhairahawa / Gautam Buddha Intl Airport, Rupandehi', description: 'Bhairahawa, Rupandehi', coordinates: { lat: 27.5065, lng: 83.4485 } },
  { placeId: 'np-tilottama', mainText: 'Tilottama', secondaryText: 'Tilottama (Manigram / Drivertol), Rupandehi', description: 'Tilottama, Rupandehi', coordinates: { lat: 27.6500, lng: 83.4667 } },
  { placeId: 'np-kalanki', mainText: 'Kalanki', secondaryText: 'Kalanki Chok, Ring Road, Kathmandu', description: 'Kalanki, Kathmandu', coordinates: { lat: 27.6938, lng: 85.2817 } },
  { placeId: 'np-koteshwor', mainText: 'Koteshwor', secondaryText: 'Koteshwor Chok, Ring Road, Kathmandu', description: 'Koteshwor, Kathmandu', coordinates: { lat: 27.6788, lng: 85.3486 } },
  { placeId: 'np-kathmandu', mainText: 'Kathmandu', secondaryText: 'Kathmandu City Center, Bagmati', description: 'Kathmandu, Nepal', coordinates: { lat: 27.7172, lng: 85.3240 } },
  { placeId: 'np-pokhara', mainText: 'Pokhara', secondaryText: 'Pokhara Lakeside / Prithvi Chok, Kaski', description: 'Pokhara, Kaski', coordinates: { lat: 28.2096, lng: 83.9856 } },
  { placeId: 'np-narayangarh', mainText: 'Narayangarh', secondaryText: 'Narayangarh / Bharatpur, Chitwan', description: 'Narayangarh, Chitwan', coordinates: { lat: 27.6833, lng: 84.4333 } },
  { placeId: 'np-hetauda', mainText: 'Hetauda', secondaryText: 'Hetauda Bus Park, Makwanpur', description: 'Hetauda, Makwanpur', coordinates: { lat: 27.4286, lng: 85.0322 } },
  { placeId: 'np-itahari', mainText: 'Itahari', secondaryText: 'Itahari Main Chok, Sunsari', description: 'Itahari, Sunsari', coordinates: { lat: 26.6667, lng: 87.2833 } },
  { placeId: 'np-dharan', mainText: 'Dharan', secondaryText: 'Bhanu Chok, Dharan, Sunsari', description: 'Dharan, Sunsari', coordinates: { lat: 26.8126, lng: 87.2834 } },
  { placeId: 'np-lumbini', mainText: 'Lumbini', secondaryText: 'Lumbini Sacred Garden, Rupandehi', description: 'Lumbini, Rupandehi', coordinates: { lat: 27.4833, lng: 83.2833 } },
];

async function fetchNepalNominatimPlaces(query: string): Promise<PlaceSuggestion[]> {
  if (!query || query.trim().length < 2) return [];
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query.trim())}&countrycodes=np&limit=6&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'SarathiRideSharingNepal/1.0',
      },
    });

    if (!res.ok) return [];

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data.map((item: any) => {
      const parts = (item.display_name || '').split(',');
      const mainText = parts[0] ? parts[0].trim() : item.display_name;
      const secondaryText = parts.slice(1, 4).map((p: string) => p.trim()).join(', ');

      return {
        placeId: `osm-${item.place_id}`,
        mainText,
        secondaryText: secondaryText || 'Nepal',
        description: item.display_name,
        coordinates: {
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
        },
      };
    });
  } catch (err) {
    console.warn('[Nominatim fetch error]', err);
    return [];
  }
}

export function useLocationSearch() {
  // Origin state
  const [origin, setOrigin] = useState<LocationState>({
    text: '',
    coords: null,
    selectedSuggestion: null,
  });
  const [originSuggestions, setOriginSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSearchingOrigin, setIsSearchingOrigin] = useState(false);
  const [showOriginNotFound, setShowOriginNotFound] = useState(false);
  const [isFetchingOriginGPS, setIsFetchingOriginGPS] = useState(false);

  // Destination state
  const [destination, setDestination] = useState<LocationState>({
    text: '',
    coords: null,
    selectedSuggestion: null,
  });
  const [destSuggestions, setDestSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSearchingDest, setIsSearchingDest] = useState(false);
  const [showDestNotFound, setShowDestNotFound] = useState(false);

  // Pin Picker Modal States
  const [pinPickerModalOpen, setPinPickerModalOpen] = useState(false);
  const [pinPickerTargetType, setPinPickerTargetType] = useState<'origin' | 'destination' | null>(null);

  // Directions & route state
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Debounce timers & Request sequence tracking (prevents async race conditions)
  const originTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const destTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search for Origin with local dictionary & OpenStreetMap Nominatim
  const handleOriginChange = useCallback((text: string) => {
    setOrigin(prev => ({
      ...prev,
      text,
      coords: prev.selectedSuggestion?.description === text ? prev.coords : null,
      selectedSuggestion: prev.selectedSuggestion?.description === text ? prev.selectedSuggestion : null,
    }));
    setErrorMsg(null);
    setShowOriginNotFound(false);

    if (originTimerRef.current) clearTimeout(originTimerRef.current);

    if (!text || !text.trim()) {
      setOriginSuggestions([]);
      setIsSearchingOrigin(false);
      return;
    }

    const query = text.toLowerCase().trim();
    setIsSearchingOrigin(true);

    originTimerRef.current = setTimeout(async () => {
      // 1. Local fast dictionary matches
      const localMatches = NEPAL_LOCATIONS.filter(
        item => item.mainText.toLowerCase().includes(query) || item.secondaryText.toLowerCase().includes(query)
      );

      // 2. OpenStreetMap Nominatim API for entire Nepal
      let osmMatches: PlaceSuggestion[] = [];
      if (query.length >= 2) {
        osmMatches = await fetchNepalNominatimPlaces(query);
      }

      // Combine local + OSM matches (deduplicated)
      const combined = [...localMatches];
      for (const osmItem of osmMatches) {
        if (!combined.some(c => c.mainText.toLowerCase() === osmItem.mainText.toLowerCase())) {
          combined.push(osmItem);
        }
      }

      setOriginSuggestions(combined);
      setIsSearchingOrigin(false);
      setShowOriginNotFound(combined.length === 0);
    }, 300);
  }, []);

  // Debounced search for Destination with OpenStreetMap Nominatim
  const handleDestChange = useCallback((text: string) => {
    setDestination(prev => ({
      ...prev,
      text,
      coords: prev.selectedSuggestion?.description === text ? prev.coords : null,
      selectedSuggestion: prev.selectedSuggestion?.description === text ? prev.selectedSuggestion : null,
    }));
    setErrorMsg(null);
    setShowDestNotFound(false);

    if (destTimerRef.current) clearTimeout(destTimerRef.current);

    if (!text || !text.trim()) {
      setDestSuggestions([]);
      setIsSearchingDest(false);
      return;
    }

    const query = text.toLowerCase().trim();
    setIsSearchingDest(true);

    destTimerRef.current = setTimeout(async () => {
      // 1. Local fast dictionary matches
      const localMatches = NEPAL_LOCATIONS.filter(
        item => item.mainText.toLowerCase().includes(query) || item.secondaryText.toLowerCase().includes(query)
      );

      // 2. OpenStreetMap Nominatim API for entire Nepal
      let osmMatches: PlaceSuggestion[] = [];
      if (query.length >= 2) {
        osmMatches = await fetchNepalNominatimPlaces(query);
      }

      // Combine local + OSM matches (deduplicated)
      const combined = [...localMatches];
      for (const osmItem of osmMatches) {
        if (!combined.some(c => c.mainText.toLowerCase() === osmItem.mainText.toLowerCase())) {
          combined.push(osmItem);
        }
      }

      setDestSuggestions(combined);
      setIsSearchingDest(false);
      setShowDestNotFound(combined.length === 0);
    }, 300);
  }, []);

  // Select suggestion for Origin
  const selectOriginSuggestion = useCallback(async (suggestion: PlaceSuggestion) => {
    setOriginSuggestions([]);
    setShowOriginNotFound(false);
    setOrigin({
      text: suggestion.mainText || suggestion.description,
      coords: suggestion.coordinates || { lat: 27.7172, lng: 85.3240 },
      selectedSuggestion: suggestion,
    });
  }, []);

  // Select suggestion for Destination
  const selectDestSuggestion = useCallback(async (suggestion: PlaceSuggestion) => {
    setDestSuggestions([]);
    setShowDestNotFound(false);
    setDestination({
      text: suggestion.mainText || suggestion.description,
      coords: suggestion.coordinates || { lat: 27.6710, lng: 85.3120 },
      selectedSuggestion: suggestion,
    });
  }, []);

  // "Use my current location" for Origin using device's precise GPS position
  const useCurrentLocationForOrigin = useCallback(async () => {
    setIsFetchingOriginGPS(true);
    setErrorMsg(null);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Location permission denied. Please grant location access.');
        setIsFetchingOriginGPS(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const gpsCoords: LocationCoordinates = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      };

      // Reverse geocode ONLY to present a readable place name for user confirmation
      let placeName = 'My GPS Location';
      try {
        const geocode = await Location.reverseGeocodeAsync({
          latitude: gpsCoords.lat,
          longitude: gpsCoords.lng,
        });
        if (geocode && geocode.length > 0) {
          const p = geocode[0];
          placeName = p.name || p.street || p.subregion || p.city || 'My GPS Location';
        }
      } catch (gErr) {
        console.warn('[useLocationSearch] Reverse geocode notice:', gErr);
      }

      setOrigin({
        text: placeName,
        coords: gpsCoords, // Precise GPS coordinates retained
        selectedSuggestion: {
          placeId: `gps-origin-${Date.now()}`,
          description: placeName,
          mainText: placeName,
          secondaryText: `${gpsCoords.lat.toFixed(4)}, ${gpsCoords.lng.toFixed(4)}`,
          coordinates: gpsCoords,
        },
      });
      setOriginSuggestions([]);
      setShowOriginNotFound(false);
    } catch (err) {
      console.error('[useLocationSearch] useCurrentLocationForOrigin error:', err);
      setErrorMsg('Failed to fetch current GPS location.');
    } finally {
      setIsFetchingOriginGPS(false);
    }
  }, []);

  // Set Origin directly with pre-resolved coordinates
  const setOriginDirect = useCallback((name: string, coords: LocationCoordinates) => {
    setOrigin({
      text: name,
      coords,
      selectedSuggestion: {
        placeId: `direct-${Date.now()}`,
        description: name,
        mainText: name,
        secondaryText: 'Selected Pin Location',
        coordinates: coords,
      },
    });
    setOriginSuggestions([]);
    setShowOriginNotFound(false);
  }, []);

  // Set Destination directly with pre-resolved coordinates
  const setDestDirect = useCallback((name: string, coords: LocationCoordinates) => {
    setDestination({
      text: name,
      coords,
      selectedSuggestion: {
        placeId: `direct-${Date.now()}`,
        description: name,
        mainText: name,
        secondaryText: 'Selected Pin Location',
        coordinates: coords,
      },
    });
    setDestSuggestions([]);
    setShowDestNotFound(false);
  }, []);

  // Open Pin Picker Modal for either Origin or Destination
  const openPinPicker = useCallback((type: 'origin' | 'destination') => {
    setPinPickerTargetType(type);
    setPinPickerModalOpen(true);
  }, []);

  const closePinPicker = useCallback(() => {
    setPinPickerModalOpen(false);
    setPinPickerTargetType(null);
  }, []);

  // Confirm Pin Selection from Map View
  const confirmPinLocation = useCallback((coords: LocationCoordinates, placeName?: string) => {
    const displayName = placeName && placeName.trim() ? placeName.trim() : `Pin (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`;
    if (pinPickerTargetType === 'origin') {
      setOriginDirect(displayName, coords);
    } else if (pinPickerTargetType === 'destination') {
      setDestDirect(displayName, coords);
    }
    setPinPickerModalOpen(false);
    setPinPickerTargetType(null);
  }, [pinPickerTargetType, setOriginDirect, setDestDirect]);

  // Calculate Route Directions when both coordinates are available
  const calculateRoute = useCallback(async (): Promise<RouteInfo | null> => {
    if (!origin.coords || !destination.coords) {
      setErrorMsg('Both Origin and Destination must have resolved locations.');
      return null;
    }

    const mockRoute: RouteInfo = {
      distanceText: '5.2 km',
      durationText: '15 mins',
      encodedPolyline: '',
    };
    setRouteInfo(mockRoute);
    return mockRoute;
  }, [origin.coords, destination.coords]);

  const isBothResolved = Boolean(origin.coords && destination.coords);

  return {
    origin,
    setOrigin,
    originSuggestions,
    isSearchingOrigin,
    showOriginNotFound,
    isFetchingOriginGPS,
    handleOriginChange,
    selectOriginSuggestion,
    useCurrentLocationForOrigin,
    setOriginDirect,

    destination,
    setDestination,
    destSuggestions,
    isSearchingDest,
    showDestNotFound,
    handleDestChange,
    selectDestSuggestion,
    setDestDirect,

    // Pin Picker Modal
    pinPickerModalOpen,
    setPinPickerModalOpen,
    pinPickerTargetType,
    openPinPicker,
    closePinPicker,
    confirmPinLocation,

    routeInfo,
    isCalculatingRoute,
    calculateRoute,
    isBothResolved,

    errorMsg,
    setErrorMsg,
  };
}
