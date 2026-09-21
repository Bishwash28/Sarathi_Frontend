# Master Prompt: Next.js Admin Web Portal for Sarathi

> **Instructions**: Copy and paste this prompt into an AI Coding Assistant (or use it as a complete spec sheet) to generate the Admin Web Portal for Sarathi.

---

## 1. Project Overview & Tech Stack

Build a production-ready, highly responsive Admin Web Portal for the **Sarathi Ride-Sharing Platform**.

- **Framework**: Next.js 14+ (App Router) with TypeScript
- **Styling & UI**: Tailwind CSS, Shadcn UI (`@/components/ui`), Lucide Icons (`lucide-react`)
- **Data Visualization**: Recharts (`recharts`)
- **Backend & Database**: Supabase (PostgreSQL) — Shares the exact same Supabase database instance as the mobile app.
- **SDKs**: `@supabase/supabase-js`, `@supabase/ssr`
- **Deployment Target**: Vercel

---

## 2. Environment Setup & Supabase Connection

Create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://nesciqgijgmslopxrmko.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
```

### SQL Database Preparation (Run in Supabase SQL Editor):
```sql
-- Ensure role column exists on profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'passenger';
-- Supported values: 'passenger', 'rider', 'admin'

-- Admin Audit Logs table for security tracking
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_user_id UUID,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 3. Directory & File Structure

```
src/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx         # Admin Login Screen
│   ├── (dashboard)/
│   │   ├── layout.tsx           # Sidebar & Header Dashboard Shell
│   │   ├── page.tsx             # 📊 Analytics Dashboard
│   │   ├── users/
│   │   │   └── page.tsx         # 👥 Users & Riders Management
│   │   ├── kyc/
│   │   │   └── page.tsx         # 🪪 KYC Document Verification Queue
│   │   ├── rides/
│   │   │   └── page.tsx         # 🚗 Rides & Booking History
│   │   └── settings/
│   │       └── page.tsx         # ⚙️ Admin Profile & Security Settings
├── components/
│   ├── layout/
│   │   ├── sidebar.tsx
│   │   └── header.tsx
│   ├── kyc-verification-modal.tsx
│   ├── user-details-modal.tsx
│   └── ui/                      # Shadcn components (Button, Card, Table, Badge, Dialog)
├── lib/
│   └── supabase/
│       ├── client.ts            # Client-side Supabase SDK
│       ├── server.ts            # Server Component Supabase SDK
│       └── admin.ts             # Service Role Supabase SDK (Server-only)
└── middleware.ts                # Route Security & Admin Authorization Guard
```

---

## 4. Key Page Specifications

### Page 1: Admin Authentication (`/login`)
- Clean centered dark/light modern card layout.
- Authenticate via `supabase.auth.signInWithPassword()`.
- Validate user role (`profiles.role === 'admin'`). If invalid, sign out and display error: *"Access Denied: Admin credentials required."*

### Page 2: Dashboard Analytics (`/dashboard`)
- **Top KPI Cards**:
  1. **Total Revenue**: Accumulated earnings (Rs.)
  2. **Active Users**: Total Passengers & Verified Riders
  3. **Completed Rides**: Total successful trips
  4. **Pending KYC**: Highlighting verification requests waiting for review
- **Recharts Analytics**:
  - Daily Rides Bar Chart (Completed vs Cancelled)
  - Revenue Trend Line Chart
- **Recent Activity Feed**: Real-time log of recent ride postings and new user registrations.

### Page 3: User Management (`/dashboard/users`)
- Tab filters: **All Users**, **Passengers**, **Riders**.
- Data Table features: Search input (Name, Email, Phone, Vehicle number), sorting, pagination.
- Columns: User Avatar, Name, Contact Info, Role Badge, Status (`Active`, `Suspended`, `Blocked`), KYC Status.
- Actions:
  - View User Details Modal
  - Block / Unblock User Action (uses `SUPABASE_SERVICE_ROLE_KEY` to update profile)
  - Force Password Reset Action

### Page 4: KYC Verification Queue (`/dashboard/kyc`)
- List of users with `kyc_status = 'pending'`.
- Columns: User Name, Submitted Date, Document Type (Citizenship / License), Vehicle Type.
- **Verification Modal**:
  - Displays uploaded document images (ID Front, ID Back, Driver License) side-by-side with full-screen zoom preview.
  - **Approve Action**: Updates `kyc_status = 'approved'`, sets user status to Active.
  - **Reject Action**: Requires rejection reason input (e.g., *"Unclear document photo"*), sets `kyc_status = 'rejected'`.

### Page 5: Rides & Booking Management (`/dashboard/rides`)
- Filter by status (`ACTIVE`, `COMPLETED`, `CANCELLED`).
- Table Columns: Ride ID, Rider Name, Origin, Destination, Departure Time, Seats Left, Price/Seat, Status.
- Details Modal: Shows full route polyline coordinates, passenger bookings list, and payment status.

### Page 6: Admin Profile & Settings (`/dashboard/settings`)
- **Admin Details Update**: Update Full Name & Email.
- **Password Security Form**:
  - Current Password, New Password, Confirm Password.
  - Executes `supabase.auth.updateUser({ password: newPassword })`.
- **System Configs**: Set base platform fee %, pricing multipliers, and system maintenance toggle.

---

## 5. Security & Middleware (`middleware.ts`)

Implement Next.js middleware using `@supabase/ssr`:
1. Intercept all `/dashboard/*` routes.
2. Check if active session exists. If not, redirect to `/login`.
3. Fetch user profile and verify `role === 'admin'`. If not admin, redirect to `/login?error=Unauthorized`.

---

## 6. Vercel Deployment Guide

1. Push the project repository to GitHub.
2. Open Vercel Dashboard -> **New Project** -> Import repository.
3. Configure Environment Variables in Vercel settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Click **Deploy**.
