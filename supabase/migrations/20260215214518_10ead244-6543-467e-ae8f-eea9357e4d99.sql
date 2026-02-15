
-- إضافة أعمدة المرحلة 2 لجدول التفاوض
ALTER TABLE public.deal_negotiations 
ADD COLUMN IF NOT EXISTS negotiation_phase integer NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS requested_quantity integer NULL,
ADD COLUMN IF NOT EXISTS final_price numeric NULL,
ADD COLUMN IF NOT EXISTS shipping_time text NULL;

-- تحديث trigger إشعارات المراحل لدعم المراحل الجديدة
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
