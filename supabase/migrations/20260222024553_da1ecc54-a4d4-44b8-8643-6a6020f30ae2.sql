
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
      WHEN 'contract_client_review' THEN 'العقد جاهز لمراجعتك'
      WHEN 'contract_objection' THEN 'تم إرسال ملاحظاتك على العقد'
      WHEN 'contract_revision' THEN 'جاري تعديل العقد بناءً على ملاحظاتك'
      WHEN 'contract_review' THEN 'العقد قيد مراجعة المدير'
      WHEN 'contract_signing' THEN 'العقد جاهز للتوقيع الإلكتروني'
      WHEN 'contract_admin_approval' THEN 'بانتظار اعتماد المدير'
      WHEN 'contract_factory_approval' THEN 'بانتظار موافقة المورّد'
      WHEN 'contract_signed' THEN 'تم اعتماد العقد نهائياً من جميع الأطراف'
      WHEN 'loading_goods' THEN 'البضاعة قيد التحميل'
      WHEN 'leaving_factory' THEN 'البضاعة غادرت المصنع'
      WHEN 'at_source_port' THEN 'البضاعة في ميناء التصدير'
      WHEN 'in_transit' THEN 'البضاعة في البحر'
      WHEN 'at_destination_port' THEN 'البضاعة وصلت ميناء الوجهة'
      WHEN 'token_a_pending' THEN 'بانتظار صرف التوكن A'
      WHEN 'token_a_released' THEN 'تم صرف التوكن A — بدء الإنتاج'
      WHEN 'factory_production' THEN 'المصنع يعمل على الإنتاج'
      WHEN 'factory_completed' THEN 'المصنع أكمل الإنتاج'
      WHEN 'quality_inspection_assigned' THEN 'تم تعيين مفتش الجودة'
      WHEN 'quality_approved' THEN 'فحص الجودة ناجح'
      WHEN 'token_b_pending' THEN 'بانتظار صرف التوكن B'
      WHEN 'token_b_released' THEN 'تم صرف التوكن B — 50%'
      WHEN 'sovereignty_timer' THEN 'العداد السيادي بدأ'
      WHEN 'objection_raised' THEN 'تم تسجيل اعتراض'
      WHEN 'completed' THEN 'الصفقة مكتملة'
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
