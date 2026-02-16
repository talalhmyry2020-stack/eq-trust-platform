
-- ==========================================
-- المرحلة 1: نظام الخزينة والإيداعات
-- ==========================================

-- جدول إيداعات الصفقات
CREATE TABLE public.deal_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  client_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  receipt_image_url TEXT,
  receipt_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  rejection_reason TEXT,
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deal_deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access to deposits" ON public.deal_deposits FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clients view own deposits" ON public.deal_deposits FOR SELECT
  USING (auth.uid() = client_id);

CREATE POLICY "Clients create own deposits" ON public.deal_deposits FOR INSERT
  WITH CHECK (auth.uid() = client_id);

-- ==========================================
-- المرحلة 2: مهام المفتش الميداني
-- ==========================================

-- إضافة حقل الدولة للموظفين
ALTER TABLE public.employee_details ADD COLUMN IF NOT EXISTS country TEXT DEFAULT '';

-- جدول مهام الفحص الميداني
CREATE TABLE public.deal_inspection_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  inspector_id UUID NOT NULL,
  factory_latitude DOUBLE PRECISION,
  factory_longitude DOUBLE PRECISION,
  factory_address TEXT,
  factory_country TEXT,
  geofence_radius_meters INTEGER NOT NULL DEFAULT 200,
  max_photos INTEGER NOT NULL DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'assigned', -- assigned, in_progress, completed, cancelled
  assigned_by UUID,
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deal_inspection_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access to missions" ON public.deal_inspection_missions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Inspectors view own missions" ON public.deal_inspection_missions FOR SELECT
  USING (auth.uid() = inspector_id);

CREATE POLICY "Inspectors update own missions" ON public.deal_inspection_missions FOR UPDATE
  USING (auth.uid() = inspector_id);

-- جدول صور الفحص
CREATE TABLE public.deal_inspection_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES public.deal_inspection_missions(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ai_analysis TEXT,
  ai_status TEXT, -- pending, approved, flagged
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deal_inspection_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access to inspection photos" ON public.deal_inspection_photos FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Inspectors insert own mission photos" ON public.deal_inspection_photos FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM deal_inspection_missions m
    WHERE m.id = deal_inspection_photos.mission_id AND m.inspector_id = auth.uid()
  ));

CREATE POLICY "Inspectors view own mission photos" ON public.deal_inspection_photos FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM deal_inspection_missions m
    WHERE m.id = deal_inspection_photos.mission_id AND m.inspector_id = auth.uid()
  ));

CREATE POLICY "Clients view own deal photos" ON public.deal_inspection_photos FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM deals WHERE deals.id = deal_inspection_photos.deal_id AND deals.client_id = auth.uid()
  ));

-- ==========================================
-- المرحلة 3: التوكنات والبنك التجريبي
-- ==========================================

-- جدول التوكنات المالية
CREATE TABLE public.deal_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  token_type TEXT NOT NULL, -- token_a (50%), token_b (30%), token_c (20%)
  amount NUMERIC NOT NULL,
  percentage NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, released, rejected
  rejection_reason TEXT,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deal_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access to tokens" ON public.deal_tokens FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clients view own deal tokens" ON public.deal_tokens FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM deals WHERE deals.id = deal_tokens.deal_id AND deals.client_id = auth.uid()
  ));

-- جدول الخزينة/البنك التجريبي (Escrow)
CREATE TABLE public.deal_escrow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE UNIQUE,
  total_deposited NUMERIC NOT NULL DEFAULT 0,
  total_released NUMERIC NOT NULL DEFAULT 0,
  balance NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'active', -- active, completed, refunded
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deal_escrow ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access to escrow" ON public.deal_escrow FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clients view own deal escrow" ON public.deal_escrow FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM deals WHERE deals.id = deal_escrow.deal_id AND deals.client_id = auth.uid()
  ));

-- ==========================================
-- مستودعات التخزين
-- ==========================================

-- مستودع صور الإيداعات
INSERT INTO storage.buckets (id, name, public) VALUES ('deposit-receipts', 'deposit-receipts', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Clients upload own deposit receipts" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'deposit-receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Clients view own deposit receipts" ON storage.objects FOR SELECT
  USING (bucket_id = 'deposit-receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins view all deposit receipts" ON storage.objects FOR SELECT
  USING (bucket_id = 'deposit-receipts' AND has_role(auth.uid(), 'admin'::app_role));

-- مستودع صور الفحص الميداني
INSERT INTO storage.buckets (id, name, public) VALUES ('inspection-photos', 'inspection-photos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Inspectors upload inspection photos" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'inspection-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Inspectors view own inspection photos" ON storage.objects FOR SELECT
  USING (bucket_id = 'inspection-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins view all inspection photos" ON storage.objects FOR SELECT
  USING (bucket_id = 'inspection-photos' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clients view own deal inspection photos" ON storage.objects FOR SELECT
  USING (bucket_id = 'inspection-photos' AND EXISTS (
    SELECT 1 FROM deal_inspection_photos p
    JOIN deals d ON d.id = p.deal_id
    WHERE d.client_id = auth.uid()
  ));

-- تريجرات التحديث التلقائي
CREATE TRIGGER update_deal_deposits_updated_at BEFORE UPDATE ON public.deal_deposits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_deal_inspection_missions_updated_at BEFORE UPDATE ON public.deal_inspection_missions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_deal_tokens_updated_at BEFORE UPDATE ON public.deal_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_deal_escrow_updated_at BEFORE UPDATE ON public.deal_escrow
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
