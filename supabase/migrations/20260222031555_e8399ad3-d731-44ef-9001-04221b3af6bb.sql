
-- جدول تقارير اللوجستيك: تقرير لكل مرحلة شحن
CREATE TABLE public.logistics_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  phase TEXT NOT NULL, -- loading_goods, leaving_factory, at_source_port, in_transit, at_destination_port
  employee_id UUID NOT NULL,
  
  -- بيانات التوثيق
  container_number TEXT,
  seal_number TEXT,
  bol_number TEXT,
  tracking_url TEXT,
  
  -- الملاحظات والتقرير
  notes TEXT,
  report_text TEXT,
  
  -- Checklist items (JSON array of completed items)
  checklist_completed JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- الحالة
  status TEXT NOT NULL DEFAULT 'draft', -- draft, submitted
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- مرحلة واحدة لكل صفقة
  UNIQUE(deal_id, phase)
);

-- جدول صور اللوجستيك
CREATE TABLE public.logistics_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.logistics_reports(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  phase TEXT NOT NULL,
  photo_type TEXT NOT NULL, -- container, seal, bol, goods, truck, ship, other
  photo_url TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.logistics_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logistics_photos ENABLE ROW LEVEL SECURITY;

-- سياسات الأمان لتقارير اللوجستيك
CREATE POLICY "Admins full access to logistics_reports"
  ON public.logistics_reports FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees manage own logistics reports"
  ON public.logistics_reports FOR ALL
  USING (auth.uid() = employee_id)
  WITH CHECK (auth.uid() = employee_id);

CREATE POLICY "Clients view own deal logistics reports"
  ON public.logistics_reports FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM deals WHERE deals.id = logistics_reports.deal_id AND deals.client_id = auth.uid()
  ));

-- سياسات الأمان لصور اللوجستيك
CREATE POLICY "Admins full access to logistics_photos"
  ON public.logistics_photos FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees manage own logistics photos"
  ON public.logistics_photos FOR ALL
  USING (EXISTS (
    SELECT 1 FROM logistics_reports lr WHERE lr.id = logistics_photos.report_id AND lr.employee_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM logistics_reports lr WHERE lr.id = logistics_photos.report_id AND lr.employee_id = auth.uid()
  ));

CREATE POLICY "Clients view own deal logistics photos"
  ON public.logistics_photos FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM deals WHERE deals.id = logistics_photos.deal_id AND deals.client_id = auth.uid()
  ));

-- Trigger لتحديث updated_at
CREATE TRIGGER update_logistics_reports_updated_at
  BEFORE UPDATE ON public.logistics_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
