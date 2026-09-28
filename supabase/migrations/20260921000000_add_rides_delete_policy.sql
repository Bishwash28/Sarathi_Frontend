-- ============================================================
-- MIGRATION: Add RLS DELETE Policy on public.rides
-- ============================================================

DROP POLICY IF EXISTS "Riders can delete their ride offers" ON public.rides;

CREATE POLICY "Riders can delete their ride offers"
    ON public.rides FOR DELETE
    TO authenticated
    USING (auth.uid() = rider_id);
