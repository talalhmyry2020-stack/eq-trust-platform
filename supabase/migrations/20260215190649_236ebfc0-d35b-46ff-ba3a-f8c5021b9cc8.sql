
-- Function to notify client when deal phase changes
CREATE OR REPLACE FUNCTION public.notify_deal_phase_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  phase_label TEXT;
  notif_title TEXT;
  notif_message TEXT;
BEGIN
  -- Only fire when current_phase actually changes
  IF OLD.current_phase IS DISTINCT FROM NEW.current_phase AND NEW.client_id IS NOT NULL THEN
    phase_label := CASE NEW.current_phase
      WHEN 'verification' THEN 'التحقق من المستندات'
      WHEN 'product_search' THEN 'البحث عن المنتج'
      WHEN 'searching_products' THEN 'جاري البحث عن المنتجات'
      WHEN 'results_ready' THEN 'نتائج البحث جاهزة'
      WHEN 'product_selection' THEN 'اختيار المنتج'
      ELSE NEW.current_phase
    END;

    notif_title := 'تحديث الصفقة #' || NEW.deal_number;
    notif_message := 'انتقلت صفقتك إلى مرحلة: ' || phase_label;

    INSERT INTO public.notifications (user_id, title, message, type, entity_type, entity_id)
    VALUES (NEW.client_id, notif_title, notif_message, 'deal_update', 'deal', NEW.id);
  END IF;

  -- Also notify on status change
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
$$;

-- Create trigger on deals table
CREATE TRIGGER on_deal_phase_or_status_change
  AFTER UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_deal_phase_change();
