/**
 * Sarathi API Client
 * A lightweight fetch wrapper that targets the Sarathi backend.
 * Base URL is read from EXPO_PUBLIC_API_BASE_URL (set in .env).
 *
 * Rate limiting:
 *   Each unique path is allowed MAX_CALLS requests within WINDOW_MS.
 *   Excess calls are rejected immediately without hitting the network.
 */

const BASE_URL =
  (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').replace(/\/$/, '');

// ─── Rate limiter ─────────────────────────────────────────────────────────────
const MAX_CALLS  = 30;     // max requests per path per window
const WINDOW_MS  = 10_000; // 10 seconds

const callLog: Record<string, number[]> = {};

function isRateLimited(path: string): boolean {
  const now   = Date.now();
  const times = (callLog[path] ?? []).filter(t => now - t < WINDOW_MS);
  callLog[path] = times;
  if (times.length >= MAX_CALLS) return true;
  callLog[path].push(now);
  return false;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

// ─── Core request ─────────────────────────────────────────────────────────────

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: Record<string, unknown>,
  token?: string,
): Promise<ApiResponse<T>> {
  // Rate-limit check (keyed by method + path so POST /login and GET /login are separate)
  const key = `${method}:${path}`;
  if (isRateLimited(key)) {
    console.warn(`[apiClient] Rate limit hit for ${key}`);
    return {
      success: false,
      error: 'Too many requests. Please wait a moment and try again.',
    };
  }

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (token) {
    const cleanToken = token.trim().replace(/^"|"$/g, '');
    (headers as Record<string, string>)['Authorization'] = cleanToken.startsWith('Bearer ')
      ? cleanToken
      : `Bearer ${cleanToken}`;
  }

  console.log(`[RAW_API_REQ] ${method} ${BASE_URL}${path}`, JSON.stringify({
    method,
    url: `${BASE_URL}${path}`,
    headers: { ...headers, Authorization: token ? 'Bearer [HIDDEN]' : 'NONE' },
    body,
  }, null, 2));

  const config: RequestInit = {
    method,
    headers,
  };

  if (body && method !== 'GET') {
    config.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${BASE_URL}${path}`, config);

    // Parse JSON regardless of status code
    let json: any;
    try {
      json = await response.json();
    } catch {
      json = null;
    }

    console.log(`[RAW_API_RES] ${method} ${path} => ${response.status}`, JSON.stringify({
      status: response.status,
      ok: response.ok,
      json,
    }, null, 2));

    if (!response.ok) {
      const errStr = typeof json === 'object' && json !== null ? JSON.stringify(json) : String(json);
      return {
        success: false,
        error:
          json?.message ||
          json?.error ||
          errStr ||
          `Request failed with status ${response.status}`,
      };
    }

    return {
      success: true,
      message: json?.message,
      data: json?.data ?? json,
    };
  } catch (err: any) {
    console.error(`[apiClient] ${method} ${path} failed:`, err?.message ?? err);
    return {
      success: false,
      error: err?.message ?? 'Network error. Please check your connection.',
    };
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

const apiClient = {
  get: <T>(path: string, token?: string) =>
    request<T>('GET', path, undefined, token),

  post: <T>(path: string, body: Record<string, unknown>, token?: string) =>
    request<T>('POST', path, body, token),

  put: <T>(path: string, body: Record<string, unknown>, token?: string) =>
    request<T>('PUT', path, body, token),

  patch: <T>(path: string, body: Record<string, unknown>, token?: string) =>
    request<T>('PATCH', path, body, token),

  delete: <T>(path: string, token?: string) =>
    request<T>('DELETE', path, undefined, token),
};

export default apiClient;
