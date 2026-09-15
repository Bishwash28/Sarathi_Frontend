/**
 * bookingService.ts
 * API service for booking management and ride lifecycle status operations.
 */

import apiClient, { ApiResponse } from '../lib/apiClient';

export interface BookRidePayload {
  rideId: string;
  passengerPickup?: string;
  passengerDropoff?: string;
  seatsBooked?: number;
}

export interface BookRideResponseData {
  id: string;
  rideId: string;
  passengerId?: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
  pickupOtp?: string;
  startOtp?: string;
  completionOtp?: string;
  endOtp?: string;
  pickupLocation?: string;
  dropoffLocation?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RespondBookingPayload {
  bookingId: string;
  accept: boolean;
  status?: 'ACCEPTED' | 'REJECTED';
}

export interface StartRidePayload {
  bookingId: string;
  otp: string;
  startOtp?: string;
}

export interface CompleteRidePayload {
  bookingId: string;
  otp: string;
  endOtp?: string;
}

/**
 * Book seats on a ride via POST /api/book-ride (Generates Start & End OTPs)
 */
export async function bookRideApi(
  payload: BookRidePayload,
  token?: string,
): Promise<ApiResponse<BookRideResponseData>> {
  const result = await apiClient.post<BookRideResponseData>(
    '/api/book-ride',
    payload as unknown as Record<string, unknown>,
    token,
  );
  if (!result.success && result.error?.includes('404')) {
    return apiClient.post<BookRideResponseData>(
      '/api/bookings',
      payload as unknown as Record<string, unknown>,
      token,
    );
  }
  return result;
}

/**
 * Driver accepts or rejects a ride booking request via POST /api/respond-booking
 */
export async function respondBookingApi(
  payload: RespondBookingPayload,
  token?: string,
): Promise<ApiResponse<BookRideResponseData>> {
  const result = await apiClient.post<BookRideResponseData>(
    '/api/respond-booking',
    payload as unknown as Record<string, unknown>,
    token,
  );
  if (!result.success && result.error?.includes('404')) {
    return apiClient.post<BookRideResponseData>(
      `/api/bookings/${payload.bookingId}/respond`,
      payload as unknown as Record<string, unknown>,
      token,
    );
  }
  return result;
}

/**
 * Get all bookings for the logged-in user (as passenger or driver) via GET /api/bookings
 */
export async function getBookingsApi(
  token?: string,
): Promise<ApiResponse<BookRideResponseData[]>> {
  return apiClient.get<BookRideResponseData[]>('/api/bookings', token);
}

/**
 * Get single booking details by ID via GET /api/booking/{id}
 */
export async function getBookingByIdApi(
  id: string,
  token?: string,
): Promise<ApiResponse<BookRideResponseData>> {
  const result = await apiClient.get<BookRideResponseData>(`/api/booking/${id}`, token);
  if (!result.success && result.error?.includes('404')) {
    return apiClient.get<BookRideResponseData>(`/api/bookings/${id}`, token);
  }
  return result;
}

/**
 * Verify Start OTP (Pickup OTP) and transition ride to ONGOING via POST /api/start-ride
 */
export async function startRideApi(
  payload: StartRidePayload,
  token?: string,
): Promise<ApiResponse<BookRideResponseData>> {
  const result = await apiClient.post<BookRideResponseData>(
    '/api/start-ride',
    payload as unknown as Record<string, unknown>,
    token,
  );
  if (!result.success && result.error?.includes('404')) {
    return apiClient.post<BookRideResponseData>(
      `/api/bookings/${payload.bookingId}/start`,
      payload as unknown as Record<string, unknown>,
      token,
    );
  }
  return result;
}

/**
 * Verify End OTP (Drop-off OTP) and transition ride to COMPLETED via POST /api/complete-ride
 */
export async function completeRideApi(
  payload: CompleteRidePayload,
  token?: string,
): Promise<ApiResponse<BookRideResponseData>> {
  const result = await apiClient.post<BookRideResponseData>(
    '/api/complete-ride',
    payload as unknown as Record<string, unknown>,
    token,
  );
  if (!result.success && result.error?.includes('404')) {
    return apiClient.post<BookRideResponseData>(
      `/api/bookings/${payload.bookingId}/complete`,
      payload as unknown as Record<string, unknown>,
      token,
    );
  }
  return result;
}
