-- ==========================================
-- 0. CLEAN RESET (DROPS EXISTING TABLES & TRIGGERS)
-- ==========================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.search_matching_rides CASCADE;
DROP FUNCTION IF EXISTS public.verify_start_pin CASCADE;
DROP FUNCTION IF EXISTS public.verify_end_pin CASCADE;

DROP TABLE IF EXISTS public.ratings CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;
DROP TABLE IF EXISTS public.ride_live_locations CASCADE;
DROP TABLE IF EXISTS public.ride_requests CASCADE;
DROP TABLE IF EXISTS public.rides CASCADE;
DROP TABLE IF EXISTS public.vehicles CASCADE;
DROP TABLE IF EXISTS public.kyc_verifications CASCADE;
DROP TABLE IF EXISTS public.email_verifications CASCADE;
DROP TABLE IF EXISTS public.admins CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Drop legacy table names if present
DROP TABLE IF EXISTS public.live_locations CASCADE;
DROP TABLE IF EXISTS public.bookings CASCADE;
DROP TABLE IF EXISTS public.ride_posts CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- ==========================================
-- 1. EXTENSIONS
-- ==========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ==========================================
-- 2. ADMINS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role TEXT NOT NULL DEFAULT 'moderator' CHECK (role IN ('super_admin', 'moderator')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access for authenticated service roles"
    ON public.admins FOR ALL
    TO authenticated
    USING (auth.jwt()->>'role' = 'service_role');

-- ==========================================
-- 3. USERS TABLE (MAPS TO SUPABASE AUTH & SPEC)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255),
    auth_provider TEXT NOT NULL DEFAULT 'local' CHECK (auth_provider IN ('local', 'google')),
    google_id VARCHAR(100) UNIQUE,
    profile_image VARCHAR(255),
    current_mode TEXT NOT NULL DEFAULT 'passenger' CHECK (current_mode IN ('passenger', 'rider')),
    is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

REVOKE UPDATE (current_mode, is_email_verified, is_active) ON public.users FROM authenticated, anon;

CREATE POLICY "Public user profiles are viewable by authenticated users"
    ON public.users FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can update their own editable profile details"
    ON public.users FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ==========================================
-- 4. EMAIL VERIFICATIONS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.email_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own email verifications"
    ON public.email_verifications FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- ==========================================
-- 5. KYC VERIFICATIONS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.kyc_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
    id_type TEXT NOT NULL CHECK (id_type IN ('citizenship', 'nid', 'passport')),
    id_number VARCHAR(50),
    id_front_image VARCHAR(255) NOT NULL,
    id_back_image VARCHAR(255),
    license_number VARCHAR(50),
    license_front_image VARCHAR(255) NOT NULL,
    license_back_image VARCHAR(255),
    selfie_image VARCHAR(255),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES public.admins(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.kyc_verifications ENABLE ROW LEVEL SECURITY;

REVOKE UPDATE (status, rejection_reason, reviewed_by, reviewed_at) ON public.kyc_verifications FROM authenticated, anon;

CREATE POLICY "Users can view their own KYC record"
    ON public.kyc_verifications FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can submit their own KYC record"
    ON public.kyc_verifications FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their pending KYC resubmission"
    ON public.kyc_verifications FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- 6. VEHICLES TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    vehicle_name VARCHAR(100) NOT NULL,
    vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('car', 'bike', 'scooter', 'van', 'other')),
    color VARCHAR(30),
    number_plate VARCHAR(20) UNIQUE NOT NULL,
    vehicle_image VARCHAR(255),
    registration_doc_image VARCHAR(255),
    seats_available SMALLINT NOT NULL DEFAULT 1 CHECK (seats_available > 0),
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vehicles are viewable by authenticated users"
    ON public.vehicles FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Riders can insert their vehicles"
    ON public.vehicles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Riders can update their vehicles"
    ON public.vehicles FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Riders can delete their vehicles"
    ON public.vehicles FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- ==========================================
-- 7. RIDES TABLE (POSTGIS ENHANCED)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.rides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rider_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    origin_name VARCHAR(255) NOT NULL,
    origin_lat DECIMAL(10, 7) NOT NULL,
    origin_lng DECIMAL(10, 7) NOT NULL,
    destination_name VARCHAR(255) NOT NULL,
    destination_lat DECIMAL(10, 7) NOT NULL,
    destination_lng DECIMAL(10, 7) NOT NULL,
    encoded_polyline TEXT NOT NULL,
    route_geom GEOMETRY(LineString, 4326),
    distance_km DECIMAL(6, 2),
    duration_min INT,
    departure_time TIMESTAMPTZ NOT NULL,
    available_seats SMALLINT NOT NULL DEFAULT 1 CHECK (available_seats >= 0),
    price_per_seat DECIMAL(8, 2) NOT NULL CHECK (price_per_seat >= 0),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'full', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS rides_route_geom_idx ON public.rides USING GIST(route_geom);

CREATE POLICY "Rides are viewable by authenticated users"
    ON public.rides FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Riders can create ride offers"
    ON public.rides FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = rider_id);

CREATE POLICY "Riders can update their ride offers"
    ON public.rides FOR UPDATE
    TO authenticated
    USING (auth.uid() = rider_id)
    WITH CHECK (auth.uid() = rider_id);

CREATE POLICY "Riders can delete their ride offers"
    ON public.rides FOR DELETE
    TO authenticated
    USING (auth.uid() = rider_id);

-- Trigger to auto-generate PostGIS LineString geometry if route_geom is null on insert/update
CREATE OR REPLACE FUNCTION public.update_ride_route_geom()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.route_geom IS NULL AND NEW.origin_lat IS NOT NULL AND NEW.destination_lat IS NOT NULL THEN
        NEW.route_geom := ST_MakeLine(
            ST_SetSRID(ST_MakePoint(NEW.origin_lng, NEW.origin_lat), 4326),
            ST_SetSRID(ST_MakePoint(NEW.destination_lng, NEW.destination_lat), 4326)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_ride_route_geom ON public.rides;
CREATE TRIGGER trigger_update_ride_route_geom
    BEFORE INSERT OR UPDATE ON public.rides
    FOR EACH ROW EXECUTE FUNCTION public.update_ride_route_geom();

-- ==========================================
-- 8. RIDE REQUESTS (BOOKINGS) TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.ride_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
    passenger_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    pickup_name VARCHAR(255),
    pickup_lat DECIMAL(10, 7),
    pickup_lng DECIMAL(10, 7),
    drop_name VARCHAR(255),
    drop_lat DECIMAL(10, 7),
    drop_lng DECIMAL(10, 7),
    seats_requested SMALLINT NOT NULL DEFAULT 1 CHECK (seats_requested > 0),
    fare_amount DECIMAL(8, 2) NOT NULL CHECK (fare_amount >= 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'ongoing', 'completed')),
    start_pin_code CHAR(4),
    start_pin_verified_at TIMESTAMPTZ,
    end_pin_code CHAR(4),
    end_pin_verified_at TIMESTAMPTZ,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

ALTER TABLE public.ride_requests ENABLE ROW LEVEL SECURITY;

REVOKE SELECT (start_pin_code, end_pin_code) ON public.ride_requests FROM anon, authenticated;
REVOKE INSERT (start_pin_code, end_pin_code) ON public.ride_requests FROM anon, authenticated;
REVOKE UPDATE (start_pin_code, end_pin_code, status, start_pin_verified_at, end_pin_verified_at) ON public.ride_requests FROM anon, authenticated;

CREATE POLICY "Participants can view their ride requests"
    ON public.ride_requests FOR SELECT
    TO authenticated
    USING (
        auth.uid() = passenger_id 
        OR EXISTS (
            SELECT 1 FROM public.rides r
            WHERE r.id = ride_id AND r.rider_id = auth.uid()
        )
    );

CREATE POLICY "Passengers can create ride requests"
    ON public.ride_requests FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = passenger_id);

CREATE POLICY "Participants can update basic request details"
    ON public.ride_requests FOR UPDATE
    TO authenticated
    USING (
        auth.uid() = passenger_id 
        OR EXISTS (
            SELECT 1 FROM public.rides r
            WHERE r.id = ride_id AND r.rider_id = auth.uid()
        )
    );

-- ==========================================
-- 9. RIDE LIVE LOCATIONS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.ride_live_locations (
    ride_id UUID PRIMARY KEY REFERENCES public.rides(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(10, 7) NOT NULL,
    heading DECIMAL(5, 2),
    speed_kmh DECIMAL(5, 2),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ride_live_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ride participants can view live location"
    ON public.ride_live_locations FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.rides r
            WHERE r.id = ride_id AND r.rider_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.ride_requests rr
            WHERE rr.ride_id = ride_live_locations.ride_id AND rr.passenger_id = auth.uid()
        )
    );

CREATE POLICY "Riders can upsert live location"
    ON public.ride_live_locations FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.rides r
            WHERE r.id = ride_id AND r.rider_id = auth.uid()
        )
    );

-- ==========================================
-- 10. CONVERSATIONS & MESSAGES TABLES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_request_id UUID UNIQUE NOT NULL REFERENCES public.ride_requests(id) ON DELETE CASCADE,
    rider_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    passenger_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view conversations"
    ON public.conversations FOR SELECT
    TO authenticated
    USING (auth.uid() = rider_id OR auth.uid() = passenger_id);

CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    message_text TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Conversation participants can view messages"
    ON public.messages FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = conversation_id AND (c.rider_id = auth.uid() OR c.passenger_id = auth.uid())
        )
    );

CREATE POLICY "Conversation participants can insert messages"
    ON public.messages FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = sender_id
        AND EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = conversation_id AND (c.rider_id = auth.uid() OR c.passenger_id = auth.uid())
        )
    );

-- ==========================================
-- 11. NOTIFICATIONS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN (
        'kyc_approved', 'kyc_rejected', 'ride_request_received', 
        'request_accepted', 'request_rejected', 'ride_started', 
        'ride_completed', 'new_message', 'ride_cancelled'
    )),
    title VARCHAR(150) NOT NULL,
    body TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their notifications"
    ON public.notifications FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their notification read status"
    ON public.notifications FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- 12. RATINGS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_request_id UUID NOT NULL REFERENCES public.ride_requests(id) ON DELETE CASCADE,
    rated_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    rated_user UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ratings viewable by authenticated users"
    ON public.ratings FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Participants can leave ratings"
    ON public.ratings FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = rated_by);

-- ==========================================
-- 13. POSTGIS SPATIAL CORRIDOR ROUTE MATCHING RPC
-- ==========================================
CREATE OR REPLACE FUNCTION public.search_matching_rides(
    p_origin_lat DOUBLE PRECISION,
    p_origin_lng DOUBLE PRECISION,
    p_dest_lat DOUBLE PRECISION,
    p_dest_lng DOUBLE PRECISION,
    p_seats_needed INT DEFAULT 1,
    p_buffer_meters DOUBLE PRECISION DEFAULT 5000.0
)
RETURNS TABLE (
    ride_id UUID,
    rider_id UUID,
    rider_name VARCHAR,
    rider_photo VARCHAR,
    vehicle_name VARCHAR,
    number_plate VARCHAR,
    origin_name VARCHAR,
    destination_name VARCHAR,
    origin_lat DECIMAL,
    origin_lng DECIMAL,
    destination_lat DECIMAL,
    destination_lng DECIMAL,
    departure_time TIMESTAMPTZ,
    available_seats SMALLINT,
    price_per_seat DECIMAL,
    encoded_polyline TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id AS ride_id,
        r.rider_id,
        u.name AS rider_name,
        u.profile_image AS rider_photo,
        v.vehicle_name,
        v.number_plate,
        r.origin_name,
        r.destination_name,
        r.origin_lat,
        r.origin_lng,
        r.destination_lat,
        r.destination_lng,
        r.departure_time,
        r.available_seats,
        r.price_per_seat,
        r.encoded_polyline
    FROM public.rides r
    JOIN public.users u ON u.id = r.rider_id
    LEFT JOIN public.vehicles v ON v.id = r.vehicle_id
    WHERE r.status = 'active'
      AND r.available_seats >= p_seats_needed
      AND (
          (r.route_geom IS NOT NULL AND 
           ST_DWithin(r.route_geom, ST_SetSRID(ST_MakePoint(p_origin_lng, p_origin_lat), 4326)::geography, p_buffer_meters) AND
           ST_DWithin(r.route_geom, ST_SetSRID(ST_MakePoint(p_dest_lng, p_dest_lat), 4326)::geography, p_buffer_meters) AND
           (ST_LineLocatePoint(r.route_geom, ST_SetSRID(ST_MakePoint(p_origin_lng, p_origin_lat), 4326)) <=
            ST_LineLocatePoint(r.route_geom, ST_SetSRID(ST_MakePoint(p_dest_lng, p_dest_lat), 4326)) OR
            ST_LineLocatePoint(r.route_geom, ST_SetSRID(ST_MakePoint(p_origin_lng, p_origin_lat), 4326)) IS NULL))
          OR
          (ST_DWithin(ST_SetSRID(ST_MakePoint(r.origin_lng, r.origin_lat), 4326)::geography, ST_SetSRID(ST_MakePoint(p_origin_lng, p_origin_lat), 4326)::geography, p_buffer_meters) AND
           ST_DWithin(ST_SetSRID(ST_MakePoint(r.destination_lng, r.destination_lat), 4326)::geography, ST_SetSRID(ST_MakePoint(p_dest_lng, p_dest_lat), 4326)::geography, p_buffer_meters))
      );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 14. AUTH USER SIGNUP TRIGGER
-- ==========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    raw_provider TEXT;
    clean_phone TEXT;
BEGIN
    raw_provider := COALESCE(NEW.raw_app_meta_data->>'provider', 'local');
    IF raw_provider NOT IN ('local', 'google') THEN
        raw_provider := 'local';
    END IF;

    clean_phone := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'phone', '')), '');

    INSERT INTO public.users (id, email, name, phone, auth_provider, is_email_verified)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''), SPLIT_PART(NEW.email, '@', 1)),
        clean_phone,
        raw_provider,
        (NEW.email_confirmed_at IS NOT NULL)
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = COALESCE(EXCLUDED.name, public.users.name),
        phone = COALESCE(EXCLUDED.phone, public.users.phone),
        updated_at = NOW();

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Fallback insert if phone unique constraint or optional field triggers error
    INSERT INTO public.users (id, email, name, phone, auth_provider, is_email_verified)
    VALUES (
        NEW.id,
        NEW.email,
        SPLIT_PART(NEW.email, '@', 1),
        NULL,
        'local',
        (NEW.email_confirmed_at IS NOT NULL)
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- 15. STORAGE BUCKETS & RLS POLICIES
-- ==========================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing storage policies if present
DROP POLICY IF EXISTS "Public Read Access on avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload Access on avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update/Delete on avatars" ON storage.objects;

-- Allow public read access to all files in avatars bucket
CREATE POLICY "Public Read Access on avatars"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'avatars');

-- Allow authenticated users to upload files to avatars bucket
CREATE POLICY "Authenticated Upload Access on avatars"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'avatars');

-- Allow users to update/delete their own files in avatars bucket
CREATE POLICY "Authenticated Update/Delete on avatars"
    ON storage.objects FOR ALL
    TO authenticated
    USING (bucket_id = 'avatars');

