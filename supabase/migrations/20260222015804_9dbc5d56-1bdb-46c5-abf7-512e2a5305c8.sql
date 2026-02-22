
-- Create supplier_messages table for tracking factory/supplier communications
CREATE TABLE public.supplier_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.deals(id),
  factory_name TEXT NOT NULL DEFAULT '',
  sender_type TEXT NOT NULL DEFAULT 'factory', -- factory, system, admin
  message TEXT NOT NULL,
  is_completion_signal BOOLEAN NOT NULL DEFAULT false,
  detection_confidence NUMERIC DEFAULT 0,
  auto_action_taken TEXT, -- e.g. 'factory_completed'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.supplier_messages ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins full access to supplier_messages"
  ON public.supplier_messages
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Clients can view messages for their own deals
CREATE POLICY "Clients view own deal supplier messages"
  ON public.supplier_messages
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM deals WHERE deals.id = supplier_messages.deal_id AND deals.client_id = auth.uid()
  ));
