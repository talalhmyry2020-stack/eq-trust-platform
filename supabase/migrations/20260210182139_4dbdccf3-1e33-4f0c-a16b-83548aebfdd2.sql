
-- جدول نتائج البحث عن المنتجات من n8n
CREATE TABLE public.deal_product_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  product_image_url TEXT,
  price NUMERIC,
  currency TEXT DEFAULT 'USD',
  specifications JSONB DEFAULT '{}',
  quality_rating TEXT,
  selected BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.deal_product_results ENABLE ROW LEVEL SECURITY;

-- العملاء يرون نتائج صفقاتهم فقط
CREATE POLICY "Clients view own deal products" ON public.deal_product_results
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.deals WHERE deals.id = deal_product_results.deal_id AND deals.client_id = auth.uid())
  );

-- العملاء يمكنهم اختيار منتج (تحديث selected)
CREATE POLICY "Clients can select products" ON public.deal_product_results
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.deals WHERE deals.id = deal_product_results.deal_id AND deals.client_id = auth.uid())
  );

-- المدير يملك صلاحية كاملة
CREATE POLICY "Admins full access to deal products" ON public.deal_product_results
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- إضافة عمود لتتبع مرحلة الصفقة الحالية
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS current_phase TEXT DEFAULT 'verification';
