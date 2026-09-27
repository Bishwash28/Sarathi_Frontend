-- Migration: Add role context and ensure rider_id and passenger_id in chat tables

ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_ride_request_id_fkey;
ALTER TABLE public.conversations ALTER COLUMN ride_request_id DROP NOT NULL;

ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS ride_id UUID REFERENCES public.rides(id) ON DELETE CASCADE;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS role_context VARCHAR(50) DEFAULT 'RIDER_PASSENGER';
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.chat_messages (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    ride_id TEXT NOT NULL,
    sender_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    sender_name VARCHAR(100),
    sender_photo VARCHAR(255),
    sender_phone VARCHAR(20),
    receiver_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    passenger_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    rider_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    role_context VARCHAR(50) DEFAULT 'RIDER_PASSENGER',
    sender_role VARCHAR(20) NOT NULL,
    message_text TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add role_context to chat_messages if table already exists
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS role_context VARCHAR(50) DEFAULT 'RIDER_PASSENGER';
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS passenger_id UUID REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS rider_id UUID REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view chat_messages" ON public.chat_messages;
CREATE POLICY "Participants can view chat_messages"
    ON public.chat_messages FOR SELECT
    TO authenticated
    USING (
        auth.uid() = sender_id OR 
        auth.uid() = receiver_id OR 
        auth.uid() = rider_id OR 
        auth.uid() = passenger_id
    );

DROP POLICY IF EXISTS "Participants can insert chat_messages" ON public.chat_messages;
CREATE POLICY "Participants can insert chat_messages"
    ON public.chat_messages FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Participants can update chat_messages" ON public.chat_messages;
CREATE POLICY "Participants can update chat_messages"
    ON public.chat_messages FOR UPDATE
    TO authenticated
    USING (auth.uid() = receiver_id OR auth.uid() = sender_id);
