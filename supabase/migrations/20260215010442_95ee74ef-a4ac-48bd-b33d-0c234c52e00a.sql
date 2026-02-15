
-- جدول لتتبع العينات المرسلة
CREATE TABLE public.deal_samples (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  tracking_number TEXT,
  shipping_company TEXT,
  shipping_date TIMESTAMP WITH TIME ZONE,
  estimated_arrival TIMESTAMP WITH TIME ZONE,
  actual_arrival TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  sample_details JSONB DEFAULT '{}'::jsonb,
  callback_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.deal_samples ENABLE ROW LEVEL SECURITY;

-- Admins full access
CREATE POLICY "Admins full access to samples"
ON public.deal_samples FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Employees view assigned deal samples
CREATE POLICY "Employees view assigned deal samples"
ON public.deal_samples FOR SELECT
USING (
  has_role(auth.uid(), 'employee'::app_role)
  AND EXISTS (
    SELECT 1 FROM deals WHERE deals.id = deal_samples.deal_id AND deals.employee_id = auth.uid()
  )
);

-- Clients view own deal samples
CREATE POLICY "Clients view own deal samples"
ON public.deal_samples FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM deals WHERE deals.id = deal_samples.deal_id AND deals.client_id = auth.uid()
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_deal_samples_updated_at
BEFORE UPDATE ON public.deal_samples
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
