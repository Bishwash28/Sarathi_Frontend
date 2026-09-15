/**
 * rideService.ts
 * API service for Ride CRUD and Search operations.
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
  ecodedPolyLine: string;
  departureTime: string;
  vehicleId: string;
  availbleSeats: number;
}

export interface RidePayload extends Partial<CreateRidePayload> {
  vehicleType?: 'bike' | 'scooter';
  vehicleName?: string;
  vehicleNumber?: string;
  price?: number;
  route?: string[];
  pickupPoint?: string;
}

export interface RideData {
  id: string;
  riderId?: string;
  riderName: string;
  riderPhoto?: string;
  phone?: string;
  rating?: number;
  vehicleType: 'bike' | 'scooter';
  vehicleName: string;
  vehicleNumber: string;
  departureTime: string;
  seatsLeft: number;
  price: number;
  route: string[];
  pickupPoint: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SearchRidesPayload {
  origin?: { lat: number; lng: number } | string;
  destination?: { lat: number; lng: number } | string;
  encodedPolyLine?: string;
  seatsNeeded?: number;
}

/**
 * Post a new ride offer (Driver side) via POST /api/create-ride?riderId={riderId}
 */
export async function createRideApi(
  payload: CreateRidePayload,
  riderId: string,
  token?: string,
): Promise<ApiResponse<RideData>> {
  const queryParam = riderId ? `?riderId=${encodeURIComponent(riderId)}` : '';
  const result = await apiClient.post<RideData>(`/api/create-ride${queryParam}`, payload as unknown as Record<string, unknown>, token);
  if (!result.success && result.error?.includes('404')) {
    return apiClient.post<RideData>(`/api/rides${queryParam}`, payload as unknown as Record<string, unknown>, token);
  }
  return result;
}

/**
 * Update an existing ride offer via PUT /api/rides/{id}
 */
export async function updateRideApi(
  id: string,
  payload: Partial<RidePayload>,
  token?: string,
): Promise<ApiResponse<RideData>> {
  const result = await apiClient.put<RideData>(`/api/rides/${id}`, payload as unknown as Record<string, unknown>, token);
  if (!result.success && result.error?.includes('404')) {
    return apiClient.put<RideData>(`/api/ride/${id}`, payload as unknown as Record<string, unknown>, token);
  }
  return result;
}

/**
 * Delete / cancel an offered ride via DELETE /api/rides/{id}
 */
export async function deleteRideApi(
  id: string,
  token?: string,
): Promise<ApiResponse<{ id: string }>> {
  const result = await apiClient.delete<{ id: string }>(`/api/rides/${id}`, token);
  if (!result.success && result.error?.includes('404')) {
    return apiClient.delete<{ id: string }>(`/api/ride/${id}`, token);
  }
  return result;
}

/**
 * Search rides (Rider side) via POST /api/search-rides
 */
export async function searchRidesApi(
  payload: SearchRidesPayload,
  token?: string,
): Promise<ApiResponse<RideData[]>> {
  return apiClient.post<RideData[]>('/api/search-rides', payload as unknown as Record<string, unknown>, token);
}

/**
 * Get rides offered by current driver via GET /api/rides
 */
export async function getDriverRidesApi(
  token?: string,
): Promise<ApiResponse<RideData[]>> {
  return apiClient.get<RideData[]>('/api/rides', token);
}
