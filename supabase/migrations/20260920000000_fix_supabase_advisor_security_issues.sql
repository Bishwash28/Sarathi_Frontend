-- ============================================================
-- MIGRATION: Fix Supabase Security Advisor Critical Issues
-- ============================================================

-- ------------------------------------------------------------
-- 1. FIX: RLS / API Exposure on public.spatial_ref_sys
-- Revoke PostgREST API access (anon, authenticated) from PostGIS spatial_ref_sys
-- ------------------------------------------------------------
REVOKE ALL ON TABLE public.spatial_ref_sys FROM anon, authenticated;


-- ------------------------------------------------------------
-- 2. FIX: Security Definer View (View: public.profiles)
-- Convert public.profiles view from SECURITY DEFINER to SECURITY INVOKER
-- ------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.views 
        WHERE table_schema = 'public' AND table_name = 'profiles'
    ) THEN
        ALTER VIEW public.profiles SET (security_invoker = true);
    ELSE
        CREATE OR REPLACE VIEW public.profiles
        WITH (security_invoker = true)
        AS
        SELECT 
            id,
            name,
            email,
            phone,
            profile_image,
            current_mode AS role,
            is_active,
            created_at
        FROM public.users;
    END IF;
END $$;
