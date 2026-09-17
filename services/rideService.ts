/**
 * rideService.ts
 * API service for Ride CRUD and Search operations.
 * Endpoints verified against backend /docs/all.json:
 *  POST   /api/create-ride?riderId=  → createRideApi
 *  GET    /api/all-rides             → getAllRidesApi
 *  PUT    /api/update-ride?rideId=   → updateRideApi
 *  DELETE /api/delete-ride?rideId=   → deleteRideApi
 *  POST   /api/search-rides          → searchRidesApi
 */

import apiClient, { ApiResponse } from '../lib/apiClient';

export interface CreateRidePayload {
  origin: {
    lat: number;
    lng: number;
  };
  destination: {
    lat: number;
    lng: number;
  };
  ecodedPolyLine: string; // Note: backend schema requires this exact spelling ("ecodedPolyLine")
  departureTime: string;
  vehicleId: string;
  availbleSeats: number; // Note: backend schema requires this exact spelling ("availbleSeats")
  pricePerSeat?: number;
}

export interface UpdateRidePayload {
  origin?: { lat: number; lng: number };
  destination?: { lat: number; lng: number };
  ecodedPolyLine?: string;
  departureTime?: string;
  vehicleId?: string;
  availbleSeats?: number;
  pricePerSeat?: number;
}

/** Shape returned by GET /api/all-rides */
export interface BackendRide {
  id: string;
  riderId: string;
  vehicleId: string;
  origin: { lat: number; lng: number } | null;
  destination: { lat: number; lng: number } | null;
  routePolyline: string | null;
  departureTime: string | null;
  totalSeats: number;
  seatsBooked: number;
  pricePerSeat: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  rider?: {
    id: string;
    name: string;
    phone?: string;
    avatarUrl?: string;
    rating?: number;
  };
  vehicle?: {
    id: string;
    vehicleModelName: string;
    vehicleNumber: string;
    images?: string[];
  };
}

/** Shape returned by POST /api/search-rides */
export interface SearchRideResult {
  ridePostId: string;
  riderId: string;
  riderName: string;
  riderAvatarUrl?: string;
  riderRating?: number;
  riderStars?: number;
  avgRating?: number;
  totalRatings?: number;
  origin: { lat: number; lng: number } | null;
  destination: { lat: number; lng: number } | null;
  departureTime: string | null;
  availableSeats: number;
  vehicleModel: string;
  vehicleNumber: string;
  overlapScore: number;
  pricePerSeat: number | null;
}

/** Legacy shape kept for Ride state in AppContext — maps from BackendRide or SearchRideResult */
export interface RideData {
  id: string;
  riderId?: string;
  riderName: string;
  riderPhoto: string;
  phone?: string;
  rating: number;
  vehicleType: 'bike' | 'scooter';
  vehicleName: string;
  vehicleNumber: string;
  departureTime: string;
  seatsLeft: number;
  price: number;
  route: string[];
  pickupPoint: string;
  origin?: { lat: number; lng: number };
  destination?: { lat: number; lng: number };
  encodedPolyLine?: string;
  vehicleId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SearchRidesPayload {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  encodedPolyLine: string;
  seatsNeeded?: number;
}

/**
 * Convert a BackendRide to the local RideData shape for state management.
 */
export function backendRideToLocal(r: BackendRide): RideData {
  return {
    id: r.id,
    riderId: r.riderId,
    riderName: r.rider?.name || 'Driver',
    riderPhoto: r.rider?.avatarUrl || 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRrrBvl0wGQfV6SSYHn4MDl1Dx5h7ReyxWPaHhUynJVGQ&s=10',
    phone: r.rider?.phone,
    rating: r.rider?.rating ?? 5.0,
    vehicleType: 'scooter',
    vehicleName: r.vehicle?.vehicleModelName || 'Vehicle',
    vehicleNumber: r.vehicle?.vehicleNumber || '',
    departureTime: r.departureTime || 'Soon',
    seatsLeft: Math.max(0, r.totalSeats - r.seatsBooked),
    price: r.pricePerSeat ?? 0,
    route: [
      r.origin ? `${r.origin.lat.toFixed(4)},${r.origin.lng.toFixed(4)}` : 'Origin',
      r.destination ? `${r.destination.lat.toFixed(4)},${r.destination.lng.toFixed(4)}` : 'Destination',
    ],
    pickupPoint: r.origin ? `${r.origin.lat.toFixed(4)},${r.origin.lng.toFixed(4)}` : 'Origin',
    origin: r.origin || undefined,
    destination: r.destination || undefined,
    vehicleId: r.vehicleId,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/**
 * Convert a SearchRideResult to the local RideData shape.
 */
export function searchResultToLocal(r: SearchRideResult): RideData {
  return {
    id: r.ridePostId,
    riderId: r.riderId,
    riderName: r.riderName,
    riderPhoto: r.riderAvatarUrl || 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRrrBvl0wGQfV6SSYHn4MDl1Dx5h7ReyxWPaHhUynJVGQ&s=10',
    rating: r.avgRating ?? r.riderRating ?? 5.0,
    vehicleType: 'scooter',
    vehicleName: r.vehicleModel,
    vehicleNumber: r.vehicleNumber,
    departureTime: r.departureTime || 'Soon',
    seatsLeft: r.availableSeats,
    price: r.pricePerSeat ?? 0,
    route: [
      r.origin ? `${r.origin.lat.toFixed(4)},${r.origin.lng.toFixed(4)}` : 'Origin',
      r.destination ? `${r.destination.lat.toFixed(4)},${r.destination.lng.toFixed(4)}` : 'Destination',
    ],
    pickupPoint: r.origin ? `${r.origin.lat.toFixed(4)},${r.origin.lng.toFixed(4)}` : 'Origin',
    origin: r.origin || undefined,
    destination: r.destination || undefined,
  };
}

/**
 * Post a new ride offer (Driver side) via POST /api/create-ride?riderId={riderId}
 */
export async function createRideApi(
  payload: CreateRidePayload,
  riderId: string,
  token?: string,
): Promise<ApiResponse<BackendRide>> {
  const queryParam = riderId ? `?riderId=${encodeURIComponent(riderId)}` : '';
  return apiClient.post<BackendRide>(
    `/api/create-ride${queryParam}`,
    payload as unknown as Record<string, unknown>,
    token,
  );
}

/**
 * Get all ride posts on the platform via GET /api/all-rides
 */
export async function getAllRidesApi(
  token?: string,
): Promise<ApiResponse<BackendRide[]>> {
  return apiClient.get<BackendRide[]>('/api/all-rides', token);
}

/**
 * Update an existing ride offer via PUT /api/update-ride?rideId={id}
 */
export async function updateRideApi(
  id: string,
  payload: UpdateRidePayload,
  token?: string,
): Promise<ApiResponse<BackendRide>> {
  return apiClient.put<BackendRide>(
    `/api/update-ride?rideId=${encodeURIComponent(id)}`,
    payload as unknown as Record<string, unknown>,
    token,
  );
}

/**
 * Delete / cancel an offered ride via DELETE /api/delete-ride?rideId={id}
 */
export async function deleteRideApi(
  id: string,
  token?: string,
): Promise<ApiResponse<{ rideId: string }>> {
  return apiClient.delete<{ rideId: string }>(
    `/api/delete-ride?rideId=${encodeURIComponent(id)}`,
    token,
  );
}

/**
 * Search rides (Passenger side) via POST /api/search-rides
 */
export async function searchRidesApi(
  payload: SearchRidesPayload,
  token?: string,
): Promise<ApiResponse<SearchRideResult[]>> {
  return apiClient.post<SearchRideResult[]>(
    '/api/search-rides',
    payload as unknown as Record<string, unknown>,
    token,
  );
}
