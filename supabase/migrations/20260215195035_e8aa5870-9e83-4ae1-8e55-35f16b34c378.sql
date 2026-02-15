
-- Create deal_objections table for client appeals
CREATE TABLE public.deal_objections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.deals(id),
  client_id UUID NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_response TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.deal_objections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can create own objections"
ON public.deal_objections FOR INSERT
WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Clients view own objections"
ON public.deal_objections FOR SELECT
USING (auth.uid() = client_id);

CREATE POLICY "Admins full access to objections"
ON public.deal_objections FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_deal_objections_updated_at
BEFORE UPDATE ON public.deal_objections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
