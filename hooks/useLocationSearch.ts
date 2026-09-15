import { useState, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import {
  getPlaceSuggestions,
  getPlaceDetails,
  geocodeAddress,
  getRouteDirections,
  LocationCoordinates,
  PlaceSuggestion,
  RouteInfo,
} from '../services/locationService';

export interface LocationState {
  text: string;
  coords: LocationCoordinates | null;
  selectedSuggestion: PlaceSuggestion | null;
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
  const originRequestIdRef = useRef<number>(0);
  const destRequestIdRef = useRef<number>(0);

  // Debounced search for Origin with Geocoding fallback
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

    const currentReqId = ++originRequestIdRef.current;
    setIsSearchingOrigin(true);

    originTimerRef.current = setTimeout(async () => {
      try {
        // Step 1: Places Autocomplete / Nominatim Search
        const results = await getPlaceSuggestions(text);

        // Ignore response if a newer request has been initiated
        if (currentReqId !== originRequestIdRef.current) return;

        if (results.length > 0) {
          setOriginSuggestions(results);
          setShowOriginNotFound(false);
        } else {
          // Step 2: Fallback to plain Geocoding API if 0 suggestions returned
          const geocodeRes = await geocodeAddress(text);
          if (currentReqId !== originRequestIdRef.current) return;

          if (geocodeRes) {
            const autoResolvedSuggestion: PlaceSuggestion = {
              placeId: `geocode-origin-${Date.now()}`,
              description: geocodeRes.formattedAddress,
              mainText: text,
              secondaryText: geocodeRes.formattedAddress,
              coordinates: geocodeRes.coordinates,
            };
            setOriginSuggestions([autoResolvedSuggestion]);
            setOrigin(prev => ({
              ...prev,
              coords: geocodeRes.coordinates,
              selectedSuggestion: autoResolvedSuggestion,
            }));
            setShowOriginNotFound(false);
          } else {
            // Step 3: Show "Can't find this place?" pin fallback button
            setOriginSuggestions([]);
            setShowOriginNotFound(true);
          }
        }
      } catch (err) {
        if (currentReqId === originRequestIdRef.current) {
          console.error('[useLocationSearch] Origin search error:', err);
          setErrorMsg('Failed to search origin location.');
        }
      } finally {
        if (currentReqId === originRequestIdRef.current) {
          setIsSearchingOrigin(false);
        }
      }
    }, 450);
  }, []);

  // Debounced search for Destination with Geocoding fallback
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

    const currentReqId = ++destRequestIdRef.current;
    setIsSearchingDest(true);

    destTimerRef.current = setTimeout(async () => {
      try {
        // Step 1: Places Autocomplete / Nominatim Search
        const results = await getPlaceSuggestions(text);

        // Ignore response if a newer request has been initiated
        if (currentReqId !== destRequestIdRef.current) return;

        if (results.length > 0) {
          setDestSuggestions(results);
          setShowDestNotFound(false);
        } else {
          // Step 2: Fallback to plain Geocoding API if 0 suggestions returned
          const geocodeRes = await geocodeAddress(text);
          if (currentReqId !== destRequestIdRef.current) return;

          if (geocodeRes) {
            const autoResolvedSuggestion: PlaceSuggestion = {
              placeId: `geocode-dest-${Date.now()}`,
              description: geocodeRes.formattedAddress,
              mainText: text,
              secondaryText: geocodeRes.formattedAddress,
              coordinates: geocodeRes.coordinates,
            };
            setDestSuggestions([autoResolvedSuggestion]);
            setDestination(prev => ({
              ...prev,
              coords: geocodeRes.coordinates,
              selectedSuggestion: autoResolvedSuggestion,
            }));
            setShowDestNotFound(false);
          } else {
            // Step 3: Show "Can't find this place?" pin fallback button
            setDestSuggestions([]);
            setShowDestNotFound(true);
          }
        }
      } catch (err) {
        if (currentReqId === destRequestIdRef.current) {
          console.error('[useLocationSearch] Destination search error:', err);
          setErrorMsg('Failed to search destination location.');
        }
      } finally {
        if (currentReqId === destRequestIdRef.current) {
          setIsSearchingDest(false);
        }
      }
    }, 450);
  }, []);

  // Select suggestion for Origin
  const selectOriginSuggestion = useCallback(async (suggestion: PlaceSuggestion) => {
    setOriginSuggestions([]);
    setShowOriginNotFound(false);
    setOrigin({
      text: suggestion.mainText || suggestion.description,
      coords: suggestion.coordinates || null,
      selectedSuggestion: suggestion,
    });

    if (!suggestion.coordinates) {
      try {
        const coords = await getPlaceDetails(suggestion.placeId);
        if (coords) {
          setOrigin(prev => ({ ...prev, coords }));
        } else {
          setErrorMsg('Could not resolve coordinates for selected origin place.');
        }
      } catch (err) {
        setErrorMsg('Failed to fetch place details for origin.');
      }
    }
  }, []);

  // Select suggestion for Destination
  const selectDestSuggestion = useCallback(async (suggestion: PlaceSuggestion) => {
    setDestSuggestions([]);
    setShowDestNotFound(false);
    setDestination({
      text: suggestion.mainText || suggestion.description,
      coords: suggestion.coordinates || null,
      selectedSuggestion: suggestion,
    });

    if (!suggestion.coordinates) {
      try {
        const coords = await getPlaceDetails(suggestion.placeId);
        if (coords) {
          setDestination(prev => ({ ...prev, coords }));
        } else {
          setErrorMsg('Could not resolve coordinates for selected destination place.');
        }
      } catch (err) {
        setErrorMsg('Failed to fetch place details for destination.');
      }
    }
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

    setIsCalculatingRoute(true);
    setErrorMsg(null);

    try {
      const route = await getRouteDirections(origin.coords, destination.coords);
      setRouteInfo(route);
      return route;
    } catch (err) {
      console.error('[useLocationSearch] Calculate route failed:', err);
      setErrorMsg('Failed to calculate route directions.');
      return null;
    } finally {
      setIsCalculatingRoute(false);
    }
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
