-- ============================================================
-- MIGRATION: User Account Self-Deletion RPC & RLS Policies
-- ============================================================

-- 1. Create RPC function to allow authenticated users to delete their account from auth.users
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void AS $$
DECLARE
    current_uid UUID;
BEGIN
    current_uid := auth.uid();
    IF current_uid IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;

    -- Deleting from auth.users cascades to public.users and all related data (rides, bookings, kyc, etc.)
    DELETE FROM auth.users WHERE id = current_uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution permission to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;

-- 2. Add RLS DELETE Policy on public.users
DROP POLICY IF EXISTS "Users can delete their own profile" ON public.users;

CREATE POLICY "Users can delete their own profile"
    ON public.users FOR DELETE
    TO authenticated
    USING (auth.uid() = id);
