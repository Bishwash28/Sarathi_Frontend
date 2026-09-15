/**
 * userService.ts
 * Handles all user-related API calls to the Sarathi backend.
 */

import apiClient, { ApiResponse } from '../lib/apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Exact shape expected by POST /api/user/signup */
export interface SignupPayload {
  name: string;
  email: string;
  phone: string;
  password: string;
  /** Maps to `activeRole` sent to backend. Defaults to 'RIDER'. */
  role?: 'passenger' | 'driver';
}

export interface SignupResponseData {
  userId?: string;
  id?: string;
  email?: string;
  name?: string;
  phone?: string;
  activeRole?: string;
  avatarUrl?: string;
  token?: string;
  /** Some backends wrap the user object */
  user?: Record<string, unknown>;
}

// ─── Login ───────────────────────────────────────────────────────────────────

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponseData {
  token?: string;
  accessToken?: string;
  userId?: string;
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  activeRole?: string;
  user?: Record<string, unknown>;
}

// ─── Backend User (GET / PUT response) ───────────────────────────────────────

/** Full user shape returned by GET /api/users/{userId} and PUT /api/users/{userId} */
export interface BackendUser {
  id: string;
  email: string;
  name: string;
  phone: string;
  activeRole: 'RIDER' | 'DRIVER';
  role: 'RIDER' | 'DRIVER';
  kycVerified: boolean;
  kycStatus?: 'NOT_SUBMITTED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
  createdAt: string;
  updatedAt: string;
  avatarUrl?: string;
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
}

// ─── signupUser ──────────────────────────────────────────────────────────────

/**
 * Registers a new user via POST /api/user/signup.
 *
 * Backend body shape:
 *   { name, email, phone, password, activeRole: 'RIDER' | 'DRIVER' }
 */
export async function signupUser(
  payload: SignupPayload,
): Promise<ApiResponse<SignupResponseData>> {
  const activeRole = payload.role === 'driver' ? 'DRIVER' : 'RIDER';

  const body: Record<string, unknown> = {
    name: payload.name,
    email: payload.email,
    phone: payload.phone,
    password: payload.password,
    activeRole,
  };

  return apiClient.post<SignupResponseData>('/api/user/signup', body);
}

// ─── loginUser ───────────────────────────────────────────────────────────────

/**
 * Authenticates a user via POST /api/user/login.
 *
 * Backend body shape:
 *   { email, password }
 *
 * Returns a token in `.data.token` (or `.data.accessToken`) on success.
 */
export async function loginUser(
  payload: LoginPayload,
): Promise<ApiResponse<LoginResponseData>> {
  const body: Record<string, unknown> = {
    email: payload.email,
    password: payload.password,
  };

  return apiClient.post<LoginResponseData>('/api/user/login', body);
}

// ─── getUser ─────────────────────────────────────────────────────────────────

/**
 * Fetches a user by ID via GET /api/users/{userId}.
 */
export async function getUser(
  userId: string,
  token?: string,
): Promise<ApiResponse<BackendUser>> {
  return apiClient.get<BackendUser>(`/api/users/${userId}`, token);
}

// ─── updateUser ──────────────────────────────────────────────────────────────

/**
 * Updates a user via PUT /api/users/{userId}.
 * Body: { name?, email?, phone?, avatarUrl? }
 */
export async function updateUser(
  userId: string,
  payload: UpdateUserPayload,
  token?: string,
): Promise<ApiResponse<{ message: string; success: boolean; data: BackendUser }>> {
  return apiClient.put(`/api/users/${userId}`, payload as Record<string, unknown>, token);
}

// ─── deleteUser ──────────────────────────────────────────────────────────────

/**
 * Deletes a user account via DELETE /api/users/{userId}.
 */
export async function deleteUser(
  userId: string,
  token?: string,
): Promise<ApiResponse<unknown>> {
  return apiClient.delete(`/api/users/${userId}`, token);
}

// ─── KYC Endpoints ───────────────────────────────────────────────────────────

export interface KycDocumentPayload {
  documentType: 'DRIVING_LICENSE' | 'CITIZENSHIP' | 'PASSPORT' | string;
  document: string;
  file: string;
}

export interface KycDocumentData {
  id: string;
  userId: string;
  documentType: string;
  documentUrl: string;
  fileName: string;
  mimeType: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Uploads a KYC document via POST /api/users/{userId}/kyc/document.
 */
export async function uploadKycDocument(
  userId: string,
  payload: KycDocumentPayload,
  token?: string,
): Promise<ApiResponse<KycDocumentData>> {
  return apiClient.post<KycDocumentData>(
    `/api/users/${userId}/kyc/document`,
    payload as unknown as Record<string, unknown>,
    token,
  );
}

export interface KycVerifyData {
  kycVerified: boolean;
  message?: string;
}

/**
 * Triggers KYC status verification via POST /api/users/{userId}/kyc/verify.
 */
export async function verifyKycStatus(
  userId: string,
  token?: string,
): Promise<ApiResponse<KycVerifyData>> {
  return apiClient.post<KycVerifyData>(
    `/api/users/${userId}/kyc/verify`,
    {},
    token,
  );
}

// ─── Role Switch Endpoint ────────────────────────────────────────────────────

export interface RoleSwitchPayload {
  role: 'PASSENGER' | 'RIDER' | 'DRIVER';
  targetRole: 'PASSENGER' | 'RIDER' | 'DRIVER';
}

export interface RoleSwitchData {
  user: BackendUser;
  token?: string;
}

/**
 * Switches the active role via POST /api/auth/role-switch (or fallback /api/users/role-switch).
 */
export async function switchRole(
  payload: RoleSwitchPayload,
  token?: string,
): Promise<ApiResponse<RoleSwitchData>> {
  const result = await apiClient.post<RoleSwitchData>(
    '/api/auth/role-switch',
    payload as unknown as Record<string, unknown>,
    token,
  );

  // Fallback to /api/users/role-switch if /api/auth/role-switch is not found
  if (!result.success && result.error?.includes('404')) {
    return apiClient.post<RoleSwitchData>(
      '/api/users/role-switch',
      payload as unknown as Record<string, unknown>,
      token,
    );
  }

  return result;
}

