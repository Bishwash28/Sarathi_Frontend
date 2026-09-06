/**
 * vehicleService.ts
 * API service for Vehicle CRUD operations.
 */

import apiClient, { ApiResponse } from '../lib/apiClient';

export interface VehiclePayload {
  vehicleNumber: string;
  vehicleModelName: string;
  images?: string[];
}

export interface VehicleData {
  id: string;
  userId: string;
  vehicleNumber: string;
  vehicleModelName: string;
  images: string[];
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Fetch all vehicles of the logged-in user via GET /api/vehicle
 */
export async function getUserVehicles(
  token?: string,
): Promise<ApiResponse<VehicleData[]>> {
  const result = await apiClient.get<VehicleData[]>('/api/vehicle', token);
  if (!result.success && result.error?.includes('404')) {
    return apiClient.get<VehicleData[]>('/api/vehicles', token);
  }
  return result;
}

/**
 * Register a new vehicle via POST /api/vehicle
 */
export async function registerVehicle(
  payload: VehiclePayload,
  token?: string,
): Promise<ApiResponse<VehicleData>> {
  return apiClient.post<VehicleData>('/api/vehicle', payload as unknown as Record<string, unknown>, token);
}

/**
 * Fetch vehicle details by ID via GET /api/vehicle/{id}
 */
export async function getVehicle(
  id: string,
  token?: string,
): Promise<ApiResponse<VehicleData>> {
  return apiClient.get<VehicleData>(`/api/vehicle/${id}`, token);
}

/**
 * Update vehicle details via PUT /api/vehicle/{id}
 */
export async function updateVehicle(
  id: string,
  payload: VehiclePayload,
  token?: string,
): Promise<ApiResponse<VehicleData>> {
  return apiClient.put<VehicleData>(`/api/vehicle/${id}`, payload as unknown as Record<string, unknown>, token);
}

/**
 * Delete vehicle via DELETE /api/vehicle/{id}
 */
export async function deleteVehicle(
  id: string,
  token?: string,
): Promise<ApiResponse<{ id: string }>> {
  return apiClient.delete<{ id: string }>(`/api/vehicle/${id}`, token);
}
