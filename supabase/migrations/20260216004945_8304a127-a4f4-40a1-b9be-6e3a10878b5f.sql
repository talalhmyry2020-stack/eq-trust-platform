
-- Create deal_contracts table
CREATE TABLE public.deal_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  contract_text TEXT NOT NULL DEFAULT '',
  contract_html TEXT NOT NULL DEFAULT '',
  shipping_type TEXT NOT NULL DEFAULT 'FOB',
  platform_fee_percentage NUMERIC NOT NULL DEFAULT 7,
  total_amount NUMERIC,
  currency TEXT NOT NULL DEFAULT 'USD',
  buffer_days INTEGER NOT NULL DEFAULT 10,
  client_country TEXT,
  factory_country TEXT,
  client_name TEXT,
  factory_name TEXT,
  platform_name TEXT NOT NULL DEFAULT 'منصة EQ للوساطة التجارية',
  status TEXT NOT NULL DEFAULT 'drafting',
  admin_notes TEXT,
  revision_count INTEGER NOT NULL DEFAULT 0,
  signature_code TEXT,
  signature_code_expires_at TIMESTAMPTZ,
  client_signed BOOLEAN NOT NULL DEFAULT false,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.deal_contracts ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins full access to contracts"
ON public.deal_contracts FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Clients view own deal contracts
CREATE POLICY "Clients view own deal contracts"
ON public.deal_contracts FOR SELECT
USING (EXISTS (
  SELECT 1 FROM deals WHERE deals.id = deal_contracts.deal_id AND deals.client_id = auth.uid()
));

-- Clients can update for signing
CREATE POLICY "Clients can sign contracts"
ON public.deal_contracts FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM deals WHERE deals.id = deal_contracts.deal_id AND deals.client_id = auth.uid()
));

-- Trigger for updated_at
CREATE TRIGGER update_deal_contracts_updated_at
BEFORE UPDATE ON public.deal_contracts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Update notification trigger to include contract phases
CREATE OR REPLACE FUNCTION public.notify_deal_phase_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  phase_label TEXT;
  notif_title TEXT;
  notif_message TEXT;
BEGIN
  IF OLD.current_phase IS DISTINCT FROM NEW.current_phase AND NEW.client_id IS NOT NULL THEN
    phase_label := CASE NEW.current_phase
      WHEN 'verification' THEN 'التحقق من المستندات'
      WHEN 'product_search' THEN 'البحث عن المنتج'
      WHEN 'searching_products' THEN 'جاري البحث عن المنتجات'
      WHEN 'results_ready' THEN 'نتائج البحث جاهزة'
      WHEN 'product_selection' THEN 'اختيار المنتج'
      WHEN 'negotiation' THEN 'بدء التفاوض مع المصانع'
      WHEN 'negotiating' THEN 'جاري التفاوض'
      WHEN 'negotiation_complete' THEN 'عروض الأسعار جاهزة'
      WHEN 'product_selected' THEN 'تم اختيار المنتج'
      WHEN 'negotiating_phase2' THEN 'جاري التفاوض النهائي'
      WHEN 'negotiation_phase2_complete' THEN 'العرض النهائي جاهز'
      WHEN 'negotiating_phase3' THEN 'جاري موافقة المصنع'
      WHEN 'negotiation_phase3_complete' THEN 'المصنع وافق نهائياً'
      WHEN 'contract_drafting' THEN 'جاري صياغة العقد'
      WHEN 'contract_review' THEN 'العقد قيد مراجعة المدير'
      WHEN 'contract_revision' THEN 'جاري تعديل العقد'
      WHEN 'contract_signing' THEN 'العقد جاهز للتوقيع'
      WHEN 'contract_signed' THEN 'تم توقيع العقد'
      ELSE NEW.current_phase
    END;

    notif_title := 'تحديث الصفقة #' || NEW.deal_number;
    notif_message := 'انتقلت صفقتك إلى مرحلة: ' || phase_label;

    INSERT INTO public.notifications (user_id, title, message, type, entity_type, entity_id)
    VALUES (NEW.client_id, notif_title, notif_message, 'deal_update', 'deal', NEW.id);
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.client_id IS NOT NULL THEN
    DECLARE
      status_label TEXT;
    BEGIN
      status_label := CASE NEW.status::text
        WHEN 'active' THEN 'نشطة'
        WHEN 'completed' THEN 'مكتملة'
        WHEN 'delayed' THEN 'متأخرة'
        WHEN 'paused' THEN 'متوقفة'
        WHEN 'cancelled' THEN 'ملغاة'
        WHEN 'pending_review' THEN 'قيد المراجعة'
        ELSE NEW.status::text
      END;

      INSERT INTO public.notifications (user_id, title, message, type, entity_type, entity_id)
      VALUES (NEW.client_id, 'تحديث حالة الصفقة #' || NEW.deal_number, 'تم تغيير حالة صفقتك إلى: ' || status_label, 'deal_update', 'deal', NEW.id);
    END;
  END IF;

  RETURN NEW;
END;
$function$;
