/**
 * bookingService.ts
 * API service for booking management and ride lifecycle status operations.
 * Field names verified against POST /api/book-ride, POST /api/respond-booking,
 * POST /api/start-ride, POST /api/complete-ride, GET /api/bookings, GET /api/booking/{id}
 */

import apiClient, { ApiResponse } from '../lib/apiClient';

export interface BookRidePayload {
  ridePostId: string;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropAddress: string;
  dropLat: number;
  dropLng: number;
  seatsBooked?: number;
}

export interface BookRideResponseData {
  bookingId: string;
  ridePostId: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
  seatsBooked?: number;
  startOtpCode?: string; // Pickup OTP
  endOtpCode?: string;   // Completion OTP
  // Legacy / fallback fields
  id?: string;
  passengerId?: string;
  pickupLocation?: string;
  dropoffLocation?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Action string used by driver to accept or reject a booking.
 */
export interface RespondBookingPayload {
  bookingId: string;
  action: 'ACCEPT' | 'REJECT';
}

export interface StartRidePayload {
  bookingId: string;
  startOtp: string; // Pickup OTP code
}

export interface CompleteRidePayload {
  bookingId: string;
  endOtp: string; // Completion / drop-off OTP code
}

export interface CancelRidePayload {
  bookingId?: string;
  ridePostId?: string;
  cancelledById: string;
  cancelledByRole?: 'PASSENGER' | 'RIDER';
  reason?: string;
}

/**
 * Book seats on a ride via POST /api/book-ride (Generates Start & End OTPs)
 */
export async function bookRideApi(
  payload: BookRidePayload,
  token?: string,
): Promise<ApiResponse<BookRideResponseData>> {
  return apiClient.post<BookRideResponseData>(
    '/api/book-ride',
    payload as unknown as Record<string, unknown>,
    token,
  );
}

/**
 * Driver accepts or rejects a ride booking request via POST /api/respond-booking
 * action must be 'ACCEPT' or 'REJECT'
 */
export async function respondBookingApi(
  payload: RespondBookingPayload,
  token?: string,
): Promise<ApiResponse<BookRideResponseData>> {
  return apiClient.post<BookRideResponseData>(
    '/api/respond-booking',
    payload as unknown as Record<string, unknown>,
    token,
  );
}

/**
 * Get all bookings for the logged-in user (as passenger or driver) via GET /api/bookings
 * role: 'PASSENGER' | 'RIDER', status optional filter
 */
export async function getBookingsApi(
  params?: { role?: string; status?: string },
  token?: string,
): Promise<ApiResponse<BookRideResponseData[]>> {
  let endpoint = '/api/bookings';
  if (params) {
    const query = new URLSearchParams();
    if (params.role) query.set('role', params.role);
    if (params.status) query.set('status', params.status);
    const qs = query.toString();
    if (qs) endpoint += `?${qs}`;
  }
  return apiClient.get<BookRideResponseData[]>(endpoint, token);
}

/**
 * Get single booking details by ID via GET /api/booking/{id}
 */
export async function getBookingByIdApi(
  id: string,
  token?: string,
): Promise<ApiResponse<BookRideResponseData>> {
  return apiClient.get<BookRideResponseData>(`/api/booking/${id}`, token);
}

/**
 * Verify Start OTP (Pickup OTP) and transition ride to ONGOING via POST /api/start-ride
 */
export async function startRideApi(
  payload: StartRidePayload,
  token?: string,
): Promise<ApiResponse<BookRideResponseData>> {
  return apiClient.post<BookRideResponseData>(
    '/api/start-ride',
    payload as unknown as Record<string, unknown>,
    token,
  );
}

/**
 * Verify End OTP (Drop-off OTP) and transition ride to COMPLETED via POST /api/complete-ride
 */
export async function completeRideApi(
  payload: CompleteRidePayload,
  token?: string,
): Promise<ApiResponse<BookRideResponseData>> {
  return apiClient.post<BookRideResponseData>(
    '/api/complete-ride',
    payload as unknown as Record<string, unknown>,
    token,
  );
}

/**
 * Cancel a booking or ride post via POST /api/cancel-ride
 */
export async function cancelRideApi(
  payload: CancelRidePayload,
  token?: string,
): Promise<ApiResponse<unknown>> {
  return apiClient.post<unknown>(
    '/api/cancel-ride',
    payload as unknown as Record<string, unknown>,
    token,
  );
}
