
-- Notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info', -- info, deal_update, delay, admin_message
  is_read BOOLEAN NOT NULL DEFAULT false,
  entity_type TEXT, -- e.g. 'deal', 'support'
  entity_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only view their own notifications
CREATE POLICY "Users view own notifications"
ON public.notifications FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Users can update own notifications (mark as read)
CREATE POLICY "Users update own notifications"
ON public.notifications FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

-- Admins/system can insert notifications
CREATE POLICY "Admins insert notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- No delete policy - notifications are permanent for audit

-- Support tickets table
CREATE TABLE public.support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', -- open, in_progress, resolved, closed
  priority TEXT NOT NULL DEFAULT 'normal', -- low, normal, high
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own tickets"
ON public.support_tickets FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users create own tickets"
ON public.support_tickets FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all tickets"
ON public.support_tickets FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update tickets"
ON public.support_tickets FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Support messages table
CREATE TABLE public.support_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Users can view messages of their own tickets
CREATE POLICY "Users view own ticket messages"
ON public.support_messages FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.support_tickets 
  WHERE id = ticket_id AND user_id = auth.uid()
));

-- Users can send messages on their own tickets
CREATE POLICY "Users send messages on own tickets"
ON public.support_messages FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = sender_id AND
  EXISTS (
    SELECT 1 FROM public.support_tickets 
    WHERE id = ticket_id AND user_id = auth.uid()
  )
);

-- Admins can view all messages
CREATE POLICY "Admins view all messages"
ON public.support_messages FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can send messages on any ticket
CREATE POLICY "Admins send messages"
ON public.support_messages FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = sender_id AND
  has_role(auth.uid(), 'admin'::app_role)
);

-- Trigger for updated_at on support_tickets
CREATE TRIGGER update_support_tickets_updated_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
