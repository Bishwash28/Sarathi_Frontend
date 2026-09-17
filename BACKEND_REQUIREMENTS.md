# Sarathi Backend — Missing Routes & Required Fields

> **Generated:** 2026-09-17  
> **Source:** Full cross-reference of frontend service calls vs live OpenAPI spec at `https://sarthi-backend-4.onrender.com/docs/all.json`  
> **Frontend repo:** `Sarathi_Frontend`

---

## ✅ Routes That Already Exist

| Method | Path | Notes |
|--------|------|-------|
| `POST` | `/api/user/signup` | Working |
| `POST` | `/api/user/login` | Working |
| `GET` | `/api/users/{userId}` | Working |
| `PUT` | `/api/users/{userId}` | Working |
| `DELETE` | `/api/users/{userId}` | Working |
| `POST` | `/api/users/{userId}/kyc/document` | Working |
| `POST` | `/api/users/{userId}/kyc/verify` | Working |
| `POST` | `/api/auth/role-switch` | Working |
| `POST` | `/api/users/role-switch` | Fallback, working |
| `POST` | `/api/create-ride` | Working |
| `GET` | `/api/all-rides` | Returns ALL rides (no filter by rider — see missing #17) |
| `PUT` | `/api/update-ride` | Working |
| `DELETE` | `/api/delete-ride` | Working |
| `POST` | `/api/search-rides` | Working |
| `POST` | `/api/book-ride` | Working |
| `POST` | `/api/respond-booking` | Working |
| `GET` | `/api/bookings` | Working |
| `GET` | `/api/booking/{id}` | Working |
| `POST` | `/api/start-ride` | Working |
| `POST` | `/api/complete-ride` | Working |
| `POST` | `/api/cancel-ride` | Working |
| `POST` | `/api/vehicle` | Working |
| `GET` | `/api/vehicles` | Returns ALL vehicles on platform |
| `GET` | `/api/vehicle/{id}` | Working |
| `PUT` | `/api/vehicle/{id}` | Working |
| `DELETE` | `/api/vehicle/{id}` | Working |

---

## ❌ Missing Routes

### 🔴 PRIORITY 1 — Auth & Account

---

#### 1. `POST /api/auth/logout`

**Why needed:** Tokens are never invalidated on the server when a user logs out. A stolen token remains valid indefinitely.

**Request body:**
```json
{}
```
*(Auth via `Authorization: Bearer <accessToken>` header)*

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Frontend caller:** `AppContext.logout()` — currently only calls `supabase.auth.signOut()`

---

#### 2. `POST /api/auth/refresh-token`

**Why needed:** The `refreshToken` is stored in `AsyncStorage` after login but is **never sent to any endpoint**. When the access token expires users get 401 errors and are kicked out.

**Request body:**
```json
{
  "refreshToken": "string"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "string",
    "refreshToken": "string"
  }
}
```

**Frontend caller:** Needs to be wired into `lib/apiClient.ts` as a 401 interceptor.

---

#### 3. `POST /api/auth/forgot-password`

**Why needed:** "Forgot Password?" button exists in `app/(auth)/login.tsx` but has **no `onPress` handler** — it does nothing.

**Request body:**
```json
{
  "email": "string"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset email sent"
}
```

---

#### 4. `POST /api/auth/reset-password`

**Why needed:** Completes the forgot-password flow. User clicks link in email → enters new password.

**Request body:**
```json
{
  "token": "string",
  "newPassword": "string"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

---

#### 5. `POST /api/auth/resend-verification`

**Why needed:** The "Resend verification email" button in `app/(auth)/login.tsx` is already built in the UI but shows an `alert()` placeholder. The comment in code says:
> `// When POST /api/auth/resend-verification is added, call it here.`

**Request body:**
```json
{
  "email": "string"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Verification email resent"
}
```

---

#### 6. `POST /api/auth/change-password`

**Why needed:** Authenticated users cannot change their own password. No screen or endpoint exists.

**Request body:**
```json
{
  "currentPassword": "string",
  "newPassword": "string"
}
```
*(Auth via `Authorization: Bearer <accessToken>` header)*

**Response:**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

---

### 🔴 PRIORITY 1 — Email Verification (Signup flow)

---

#### 7. Email verification on `POST /api/user/signup` *(existing route — needs change)*

**Current signup response** (confirmed from `/docs/all.json`):
```json
{
  "message": "string",
  "success": true,
  "data": {
    "id": "string",
    "name": "string",
    "email": "string",
    "phone": "string",
    "role": "string",
    "activeRole": "string",
    "kycVerified": false
  }
}
```

**What's missing:** No `emailVerified` field. No verification email is sent. No indication whether the account needs verification.

**Required changes:**
1. Send a verification email after signup
2. Add `emailVerified: boolean` to the response body
3. When `POST /api/user/login` is called on an unverified account, return an error message containing words like `"not verified"` or `"verify your email"` — the frontend gate in `AppContext.tsx` is already wired to intercept this

**Updated signup response fields to add:**
```json
{
  "data": {
    "id": "string",
    "name": "string",
    "email": "string",
    "phone": "string",
    "role": "string",
    "activeRole": "string",
    "kycVerified": false,
    "emailVerified": false    // ← ADD THIS
  }
}
```

**Updated login error response for unverified accounts:**
```json
{
  "success": false,
  "message": "Email not verified. Please verify your email before logging in."
}
```
*(The frontend checks for: `"not verified"`, `"email not verified"`, `"verify your email"`, `"email verification"`, `"account not verified"`, `"please verify"`, `"confirm your email"`)*

---

### 🔴 PRIORITY 1 — Ratings

---

#### 8. `POST /api/ratings`

**Why needed:** The rating UI in `app/active-trip.tsx` is fully built. `AppContext.submitRideRating()` is wired up. But the comment in `AppContext.tsx` says:
> `// Rating submission — no backend endpoint yet; store locally`

Data is never saved.

**Request body:**
```json
{
  "bookingId": "string",
  "rating": 5,
  "comment": "string (optional)"
}
```
*(Auth via `Authorization: Bearer <accessToken>` header)*

**Response:**
```json
{
  "success": true,
  "data": {
    "ratingId": "string",
    "bookingId": "string",
    "rating": 5,
    "comment": "string",
    "createdAt": "string"
  }
}
```

---

#### 9. `GET /api/users/{userId}/ratings`

**Why needed:** `SearchRideResult` returns `avgRating` and `riderStars` fields in search results, but there is no way to fetch the actual rating history for a user/driver.

**Response:**
```json
{
  "success": true,
  "data": {
    "avgRating": 4.8,
    "totalRatings": 24,
    "ratings": [
      {
        "ratingId": "string",
        "bookingId": "string",
        "rating": 5,
        "comment": "string",
        "createdAt": "string"
      }
    ]
  }
}
```

---

### 🔴 PRIORITY 1 — Payments

---

#### 10. `POST /api/payments/initiate`

**Why needed:** `AppContext.processPayment()` has an explicit comment:
> `// Payment gateway not yet available on backend`

It only updates local state. Khalti and eSewa both require server-side payment initiation (amount validation, order ID creation).

**Request body:**
```json
{
  "bookingId": "string",
  "method": "KHALTI" | "ESEWA" | "CASH",
  "amount": 180
}
```
*(Auth via `Authorization: Bearer <accessToken>` header)*

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionId": "string",
    "paymentUrl": "string",
    "amount": 180,
    "method": "KHALTI"
  }
}
```

---

#### 11. `POST /api/payments/verify`

**Why needed:** After Khalti/eSewa redirects back to the app, the payment token must be verified server-side before marking a booking as PAID.

**Request body:**
```json
{
  "transactionId": "string",
  "token": "string",
  "amount": 180
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "bookingId": "string",
    "status": "PAID",
    "paidAt": "string"
  }
}
```

---

### 🟡 PRIORITY 2 — Rider's Own Ride Posts *(critical bug)*

---

#### 12. `GET /api/users/{userId}/rides` *(or filter on existing route)*

**Why needed:** There is currently no way to fetch only the rides created by a specific rider. The frontend tries to work around this by filtering `GET /api/all-rides` using `riderName` or `phone` string matching — which causes this **active bug**:

```ts
// In activity.tsx line 48-53 — BUG:
const myOffers = rides.filter(r =>
  r.riderName === user?.name ||       // breaks if two users share same name
  r.phone === user?.phone ||          // breaks if phone not populated
  r.riderName === 'Sarathi Driver' || // hardcoded fallback
  user?.role === 'driver'             // BUG: shows ALL rides on platform to any driver
);
```

**Option A — New dedicated endpoint:**
```
GET /api/users/{userId}/rides
```

**Option B — Filter param on existing route (simpler):**
```
GET /api/all-rides?riderId={userId}
```

**Response** *(same shape as existing `GET /api/all-rides`)*:
```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "riderId": "string",
      "vehicleId": "string",
      "origin": { "lat": 27.7, "lng": 85.3 },
      "destination": { "lat": 27.5, "lng": 83.4 },
      "routePolyline": "string",
      "departureTime": "string",
      "totalSeats": 2,
      "seatsBooked": 1,
      "pricePerSeat": 180,
      "status": "ACTIVE",
      "createdAt": "string",
      "updatedAt": "string"
    }
  ]
}
```

---

### 🟡 PRIORITY 2 — User Vehicles (wrong scope)

---

#### 13. `GET /api/vehicle` *(scoped to logged-in user)*

**Current problem:** `vehicleService.getUserVehicles()` tries `GET /api/vehicle` (404 on current backend), then falls back to `GET /api/vehicles` which returns **every vehicle on the platform** — not just the current user's.

**Required:** `GET /api/vehicle` with auth header should return **only the vehicles belonging to the authenticated user**.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "userId": "string",
      "vehicleNumber": "string",
      "vehicleModelName": "string",
      "images": ["string"],
      "createdAt": "string",
      "updatedAt": "string"
    }
  ]
}
```

---

### 🟡 PRIORITY 2 — Real-time Chat

---

#### 14. Chat messaging (REST or WebSocket)

**Why needed:** `chat-room.tsx` and `inbox.tsx` are fully built UI screens. `AppContext.sendDriverMessage()` and `sendChatMessage()` use hardcoded mock bot replies. No real messaging exists.

**Option A — REST polling:**

```
POST /api/chat/messages
GET  /api/chat/messages?bookingId={bookingId}
```

**`POST /api/chat/messages` request body:**
```json
{
  "bookingId": "string",
  "text": "string"
}
```

**`GET /api/chat/messages` response:**
```json
{
  "success": true,
  "data": [
    {
      "messageId": "string",
      "bookingId": "string",
      "senderId": "string",
      "senderRole": "RIDER" | "PASSENGER",
      "text": "string",
      "sentAt": "string"
    }
  ]
}
```

**Option B — WebSocket:**
```
wss://<host>/ws/chat?bookingId={bookingId}&token={accessToken}
```

---

### 🟡 PRIORITY 2 — Profile Avatar Upload

---

#### 15. `POST /api/users/{userId}/avatar`

**Why needed:** The existing `PUT /api/users/{userId}` only accepts `avatarUrl` as a **URL string**. There is no way to upload an image file from the device.

**Request:** `multipart/form-data`

| Field | Type | Description |
|-------|------|-------------|
| `avatar` | `File` | Image file (JPEG/PNG, max 5MB) |

**Response:**
```json
{
  "success": true,
  "data": {
    "avatarUrl": "https://cdn.sarathi.app/avatars/user-id.jpg"
  }
}
```

---

### 🟡 PRIORITY 2 — Live Location Tracking

---

#### 16. `POST /api/rides/{rideId}/location`

**Why needed:** `AppContext.nudgeDriverLocation()` has an explicit comment:
> `// Simulate GPS nudge — no backend endpoint for live tracking`

Active-trip screen shows a fake progress bar. Passengers cannot see the driver's real location.

**Request body:**
```json
{
  "lat": 27.7006,
  "lng": 83.4484
}
```
*(Auth via `Authorization: Bearer <accessToken>` header)*

**Response:**
```json
{
  "success": true,
  "data": {
    "rideId": "string",
    "lat": 27.7006,
    "lng": 83.4484,
    "updatedAt": "string"
  }
}
```

**Passenger polling:** `GET /api/rides/{rideId}/location`

---

### 🟢 PRIORITY 3 — Push Notifications

---

#### 17. `POST /api/users/{userId}/push-token`

**Why needed:** `notificationService.ts` successfully registers Expo push tokens on the device but **never sends the token to the backend**. This means the backend cannot push any notifications to the device.

**Request body:**
```json
{
  "pushToken": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "platform": "android" | "ios"
}
```
*(Auth via `Authorization: Bearer <accessToken>` header)*

**Response:**
```json
{
  "success": true,
  "message": "Push token registered"
}
```

**Frontend caller:** `notificationService.registerForPushNotificationsAsync()` — currently returns the token but never POSTs it anywhere.

---

### 🟢 PRIORITY 3 — Security

---

#### 18. Admin route auth guard *(existing route — needs fix)*

**Route:** `GET /api/admin/bookings`

**Current state:** This endpoint exists in the OpenAPI spec but has **no role/auth guard documented**. Any authenticated user can call it.

**Required fix:** Restrict access to users with `role === 'ADMIN'`. Return `403 Forbidden` for non-admin users.

---

## Summary Table

| # | Method | Path | Priority | Status | Blocking Feature |
|---|--------|------|----------|--------|-----------------|
| 1 | `POST` | `/api/auth/logout` | 🔴 P1 | Missing | Token invalidation |
| 2 | `POST` | `/api/auth/refresh-token` | 🔴 P1 | Missing | Session persistence |
| 3 | `POST` | `/api/auth/forgot-password` | 🔴 P1 | Missing | Password recovery |
| 4 | `POST` | `/api/auth/reset-password` | 🔴 P1 | Missing | Password recovery |
| 5 | `POST` | `/api/auth/resend-verification` | 🔴 P1 | Missing | Email verification |
| 6 | `POST` | `/api/auth/change-password` | 🔴 P1 | Missing | Account security |
| 7 | `POST` | `/api/user/signup` *(modify)* | 🔴 P1 | Incomplete | Email verification |
| 8 | `POST` | `/api/ratings` | 🔴 P1 | Missing | Post-ride ratings |
| 9 | `GET` | `/api/users/{userId}/ratings` | 🔴 P1 | Missing | Rating history |
| 10 | `POST` | `/api/payments/initiate` | 🔴 P1 | Missing | Khalti/eSewa payment |
| 11 | `POST` | `/api/payments/verify` | 🔴 P1 | Missing | Payment confirmation |
| 12 | `GET` | `/api/users/{userId}/rides` | 🟡 P2 | Missing | Rider's own ride posts |
| 13 | `GET` | `/api/vehicle` *(fix scope)* | 🟡 P2 | Wrong scope | My vehicles list |
| 14 | `POST/GET` | `/api/chat/messages` | 🟡 P2 | Missing | In-app chat |
| 15 | `POST` | `/api/users/{userId}/avatar` | 🟡 P2 | Missing | Profile photo upload |
| 16 | `POST` | `/api/rides/{rideId}/location` | 🟡 P2 | Missing | Live trip tracking |
| 17 | `POST` | `/api/users/{userId}/push-token` | 🟢 P3 | Missing | Push notifications |
| 18 | `GET` | `/api/admin/bookings` *(fix)* | 🟢 P3 | No auth guard | Admin security |

---

## Required Field Changes on Existing Routes

### `POST /api/user/signup` — Response

| Field | Current | Required | Notes |
|-------|---------|----------|-------|
| `data.emailVerified` | ❌ Missing | `boolean` | Add this field |
| Side effect | No email sent | Send verification email | Backend action required |

### `POST /api/user/login` — Error Response (for unverified accounts)

| Field | Current | Required | Notes |
|-------|---------|----------|-------|
| `message` | Generic error | Must contain `"not verified"` | Frontend gate checks this string |

### `GET /api/all-rides` — Query Params

| Param | Current | Required | Notes |
|-------|---------|----------|-------|
| `riderId` | ❌ Not supported | `?riderId={userId}` | Filter rides by creator |

### `GET /api/vehicle` — Scope

| Behaviour | Current | Required |
|-----------|---------|----------|
| Returns | 404 (route doesn't exist) | Only the authenticated user's vehicles |

---

*This document was auto-generated from a full audit of the Sarathi frontend codebase.*  
*Frontend files reviewed: `services/userService.ts`, `services/rideService.ts`, `services/bookingService.ts`, `services/vehicleService.ts`, `services/notificationService.ts`, `context/AppContext.tsx`, `app/(tabs)/activity.tsx`, `app/(tabs)/index.tsx`, `app/(auth)/login.tsx`, `app/(auth)/signup.tsx`*
