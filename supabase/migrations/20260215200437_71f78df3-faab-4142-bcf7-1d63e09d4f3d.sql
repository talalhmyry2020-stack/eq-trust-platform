
-- Direct messages table for chat between admin and users
CREATE TABLE public.direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins full access to messages"
ON public.direct_messages
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can view messages they sent or received
CREATE POLICY "Users view own messages"
ON public.direct_messages
FOR SELECT
TO authenticated
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Users can send messages (insert where they are sender)
CREATE POLICY "Users send messages"
ON public.direct_messages
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = sender_id);

-- Users can mark messages as read
CREATE POLICY "Users mark own received as read"
ON public.direct_messages
FOR UPDATE
TO authenticated
USING (auth.uid() = receiver_id);

-- Allow service role to insert notifications (for edge functions)
-- Add INSERT policy for notifications that allows service_role inserts
CREATE POLICY "Service role insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Enable realtime for direct_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
