
-- جدول نتائج التفاوض
CREATE TABLE public.deal_negotiations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  factory_name TEXT NOT NULL,
  factory_email TEXT,
  factory_phone TEXT,
  factory_country TEXT,
  message_sent TEXT,
  factory_response TEXT,
  offered_price NUMERIC,
  currency TEXT DEFAULT 'USD',
  product_image_url TEXT,
  product_name TEXT,
  specifications JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  response_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.deal_negotiations ENABLE ROW LEVEL SECURITY;

-- Admins full access
CREATE POLICY "Admins full access to negotiations"
ON public.deal_negotiations FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Clients view own deal negotiations
CREATE POLICY "Clients view own deal negotiations"
ON public.deal_negotiations FOR SELECT
USING (EXISTS (
  SELECT 1 FROM deals WHERE deals.id = deal_negotiations.deal_id AND deals.client_id = auth.uid()
));

-- Trigger for updated_at
CREATE TRIGGER update_deal_negotiations_updated_at
BEFORE UPDATE ON public.deal_negotiations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update phase change notification function to include negotiation phases
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
      WHEN 'negotiation_complete' THEN 'اكتمل التفاوض'
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
