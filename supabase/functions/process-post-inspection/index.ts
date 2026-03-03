import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { deal_id, action, data } = body;

    if (!deal_id || !action) throw new Error("deal_id and action are required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: deal, error: dealError } = await supabase
      .from("deals")
      .select("*")
      .eq("id", deal_id)
      .single();

    if (dealError || !deal) throw new Error("Deal not found");

    let result: any = { success: true };

    switch (action) {
      // === بعد اكتمال الفحص الأول → إنشاء Token A (30%) ===
      case "create_token_a": {
        // جلب مبلغ العقد
        const { data: contract } = await supabase
          .from("deal_contracts")
          .select("total_amount, currency, platform_fee_percentage")
          .eq("deal_id", deal_id)
          .single();

        const totalAmount = contract?.total_amount || deal.estimated_amount || 0;
        const currency = contract?.currency || "USD";
        const feePercent = contract?.platform_fee_percentage || 7;
        
        // خصم العمولة أولاً
        const netAmount = totalAmount * (1 - feePercent / 100);
        const tokenAAmount = netAmount * 0.3;

        // إنشاء التوكن
        await supabase.from("deal_tokens").insert({
          deal_id,
          token_type: "token_a",
          amount: tokenAAmount,
          percentage: 30,
          currency,
          status: "pending",
        });

        // تحديث مرحلة الصفقة
        await supabase.from("deals").update({ current_phase: "token_a_pending" }).eq("id", deal_id);

        // إشعار المدير
        const { data: admins } = await supabase.rpc("get_admin_contacts");
        for (const admin of admins || []) {
          await supabase.from("notifications").insert({
            user_id: admin.user_id,
            title: "طلب صرف توكن A — 30%",
            message: `الصفقة #${deal.deal_number}: المفتش أكمل الفحص. مبلغ التوكن: ${tokenAAmount.toFixed(2)} ${currency}. يرجى الاعتماد.`,
            type: "token_request",
            entity_type: "deal",
            entity_id: deal_id,
          });
        }

        result.token_amount = tokenAAmount;
        result.message = "تم إنشاء طلب Token A بنجاح";
        break;
      }

      // === اعتماد Token A → صرف 30% للمصنع ===
      case "approve_token_a": {
        await supabase.from("deal_tokens")
          .update({ status: "approved", approved_at: new Date().toISOString() })
          .eq("deal_id", deal_id)
          .eq("token_type", "token_a");

        await supabase.from("deals").update({ current_phase: "token_a_released" }).eq("id", deal_id);

        // تحديث الضمان
        const { data: token } = await supabase
          .from("deal_tokens")
          .select("amount")
          .eq("deal_id", deal_id)
          .eq("token_type", "token_a")
          .single();

        if (token) {
          await supabase.from("deal_escrow")
            .update({ total_released: token.amount })
            .eq("deal_id", deal_id);
        }

        // إشعار العميل
        if (deal.client_id) {
          await supabase.from("notifications").insert({
            user_id: deal.client_id,
            title: "تم صرف التوكن A",
            message: `تم صرف 30% من مبلغ صفقتك #${deal.deal_number} للمصنع لبدء الإنتاج.`,
            type: "token_released",
            entity_type: "deal",
            entity_id: deal_id,
          });
        }

        // الانتقال لمرحلة إنتاج المصنع
        setTimeout(async () => {
          await supabase.from("deals").update({ current_phase: "factory_production" }).eq("id", deal_id);
        }, 500);

        result.message = "تم اعتماد Token A وبدء الإنتاج";
        break;
      }

      // === المصنع أكمل الإنتاج → إرسال مهمة فحص جودة تلقائياً لوكيل الجودة ===
      case "factory_completed": {
        await supabase.from("deals").update({ current_phase: "factory_completed" }).eq("id", deal_id);

        // جلب بيانات الموقع من المهمة الأولى
        const { data: initialMission } = await supabase
          .from("deal_inspection_missions")
          .select("*")
          .eq("deal_id", deal_id)
          .eq("mission_type", "initial")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        // البحث عن وكيل الجودة (quality_agent) بدلاً من المفتش الميداني
        const { data: qualityAgents } = await supabase
          .from("employee_details")
          .select("user_id")
          .eq("job_code", "quality_agent");

        const qualityAgentId = qualityAgents?.[0]?.user_id;

        if (qualityAgentId && initialMission) {
          // إنشاء مهمة فحص جودة لوكيل الجودة مع نفس بيانات الموقع
          await supabase.from("deal_inspection_missions").insert({
            deal_id,
            inspector_id: qualityAgentId,
            mission_type: "quality",
            factory_latitude: initialMission.factory_latitude,
            factory_longitude: initialMission.factory_longitude,
            factory_address: initialMission.factory_address,
            factory_country: initialMission.factory_country,
            geofence_radius_meters: initialMission.geofence_radius_meters,
            max_photos: initialMission.max_photos,
            assigned_by: initialMission.assigned_by,
            notes: "مهمة فحص جودة — المطابقة الفنية للمنتجات مع العينة المرجعية قبل الشحن",
          });

          await supabase.from("deals").update({ current_phase: "quality_inspection_assigned" }).eq("id", deal_id);

          // إشعار وكيل الجودة بالمهمة الجديدة
          await supabase.from("notifications").insert({
            user_id: qualityAgentId,
            title: "مهمة فحص جودة جديدة 🔍",
            message: `تم تكليفك بمهمة فحص جودة الإنتاج للصفقة #${deal.deal_number}. توجه للموقع للتحقق من مطابقة البضاعة للعينة المرجعية.`,
            type: "inspection",
            entity_type: "deal",
            entity_id: deal_id,
          });
        } else if (initialMission) {
          // لا يوجد وكيل جودة — تعيين للمفتش الميداني كخطة بديلة
          await supabase.from("deal_inspection_missions").insert({
            deal_id,
            inspector_id: initialMission.inspector_id,
            mission_type: "quality",
            factory_latitude: initialMission.factory_latitude,
            factory_longitude: initialMission.factory_longitude,
            factory_address: initialMission.factory_address,
            factory_country: initialMission.factory_country,
            geofence_radius_meters: initialMission.geofence_radius_meters,
            max_photos: initialMission.max_photos,
            assigned_by: initialMission.assigned_by,
            notes: "مهمة فحص جودة — لا يوجد وكيل جودة متاح، أُسندت للمفتش الميداني",
          });

          await supabase.from("deals").update({ current_phase: "quality_inspection_assigned" }).eq("id", deal_id);

          await supabase.from("notifications").insert({
            user_id: initialMission.inspector_id,
            title: "مهمة فحص جودة جديدة 🔍",
            message: `تم تكليفك بمهمة فحص جودة الإنتاج للصفقة #${deal.deal_number} (لا يوجد وكيل جودة متاح).`,
            type: "inspection",
            entity_type: "deal",
            entity_id: deal_id,
          });
        }

        const assignedTo = qualityAgentId ? "وكيل الجودة" : (initialMission ? "المفتش الميداني (بديل)" : "لم يُعيّن");

        // إشعار المدير
        const { data: admins } = await supabase.rpc("get_admin_contacts");
        for (const admin of admins || []) {
          await supabase.from("notifications").insert({
            user_id: admin.user_id,
            title: "المصنع أكمل الإنتاج ✅",
            message: `الصفقة #${deal.deal_number}: المصنع أبلغ بإكمال الإنتاج. تم تعيين ${assignedTo} لفحص الجودة.`,
            type: "factory_update",
            entity_type: "deal",
            entity_id: deal_id,
          });
        }

        result.assigned_to = assignedTo;
        result.message = `تم تسجيل اكتمال الإنتاج وتعيين ${assignedTo} لفحص الجودة`;
        break;
      }

      // === تعيين مفتش جودة (المهمة الثانية) ===
      case "assign_quality_inspector": {
        const { inspector_id, factory_latitude, factory_longitude, factory_address, factory_country, assigned_by } = data || {};
        if (!inspector_id) throw new Error("inspector_id required");

        await supabase.from("deal_inspection_missions").insert({
          deal_id,
          inspector_id,
          mission_type: "quality",
          factory_latitude: factory_latitude || deal.factory_latitude,
          factory_longitude: factory_longitude || deal.factory_longitude,
          factory_address: factory_address || "",
          factory_country: factory_country || "",
          assigned_by,
        });

        await supabase.from("deals").update({ current_phase: "quality_inspection_assigned" }).eq("id", deal_id);

        await supabase.from("notifications").insert({
          user_id: inspector_id,
          title: "مهمة فحص جودة جديدة",
          message: `تم تكليفك بمهمة فحص جودة الإنتاج للصفقة #${deal.deal_number}.`,
          type: "inspection",
          entity_type: "deal",
          entity_id: deal_id,
        });

        result.message = "تم تعيين مفتش الجودة";
        break;
      }

      // === فحص الجودة مكتمل ===
      case "quality_approved": {
        await supabase.from("deals").update({ current_phase: "quality_approved" }).eq("id", deal_id);

        // إنشاء Token B (50%)
        const { data: contract } = await supabase
          .from("deal_contracts")
          .select("total_amount, currency, platform_fee_percentage")
          .eq("deal_id", deal_id)
          .single();

        const totalAmount = contract?.total_amount || deal.estimated_amount || 0;
        const currency = contract?.currency || "USD";
        const feePercent = contract?.platform_fee_percentage || 7;
        const netAmount = totalAmount * (1 - feePercent / 100);
        const tokenBAmount = netAmount * 0.5;

        await supabase.from("deal_tokens").insert({
          deal_id,
          token_type: "token_b",
          amount: tokenBAmount,
          percentage: 50,
          currency,
          status: "pending",
        });

        await supabase.from("deals").update({ current_phase: "token_b_pending" }).eq("id", deal_id);

        const { data: admins } = await supabase.rpc("get_admin_contacts");
        for (const admin of admins || []) {
          await supabase.from("notifications").insert({
            user_id: admin.user_id,
            title: "طلب صرف توكن B — 50%",
            message: `الصفقة #${deal.deal_number}: فحص الجودة ناجح. مبلغ التوكن: ${tokenBAmount.toFixed(2)} ${currency}.`,
            type: "token_request",
            entity_type: "deal",
            entity_id: deal_id,
          });
        }

        result.token_amount = tokenBAmount;
        result.message = "تم إنشاء طلب Token B";
        break;
      }

      // === اعتماد Token B ===
      case "approve_token_b": {
        await supabase.from("deal_tokens")
          .update({ status: "approved", approved_at: new Date().toISOString() })
          .eq("deal_id", deal_id)
          .eq("token_type", "token_b");

        const { data: tokens } = await supabase
          .from("deal_tokens")
          .select("amount")
          .eq("deal_id", deal_id)
          .in("token_type", ["token_a", "token_b"])
          .eq("status", "approved");

        const totalReleased = (tokens || []).reduce((sum: number, t: any) => sum + Number(t.amount), 0);
        await supabase.from("deal_escrow")
          .update({ total_released: totalReleased })
          .eq("deal_id", deal_id);

        await supabase.from("deals").update({ current_phase: "token_b_released" }).eq("id", deal_id);

        if (deal.client_id) {
          await supabase.from("notifications").insert({
            user_id: deal.client_id,
            title: "تم صرف التوكن B",
            message: `تم صرف 50% من مبلغ صفقتك #${deal.deal_number} للمصنع بعد اعتماد الجودة.`,
            type: "token_released",
            entity_type: "deal",
            entity_id: deal_id,
          });
        }

        // الانتقال لمرحلة التحميل
        await supabase.from("deals").update({ current_phase: "loading_goods" }).eq("id", deal_id);

        result.message = "تم اعتماد Token B — البضاعة قيد التحميل";
        break;
      }

      // === محاكاة تجريبية: فحص جودة → توكن B → تحميل بخطوة واحدة ===
      case "test_auto_token_b": {
        const { data: contract } = await supabase
          .from("deal_contracts")
          .select("total_amount, currency, platform_fee_percentage")
          .eq("deal_id", deal_id)
          .single();

        const totalAmount = contract?.total_amount || deal.estimated_amount || 0;
        const currency = contract?.currency || "USD";
        const feePercent = contract?.platform_fee_percentage || 7;
        const netAmount = totalAmount * (1 - feePercent / 100);
        const tokenBAmount = netAmount * 0.5;

        await supabase.from("deal_tokens").insert({
          deal_id,
          token_type: "token_b",
          amount: tokenBAmount,
          percentage: 50,
          currency,
          status: "approved",
          approved_at: new Date().toISOString(),
        });

        const { data: escrow } = await supabase
          .from("deal_escrow")
          .select("*")
          .eq("deal_id", deal_id)
          .single();

        if (escrow) {
          await supabase.from("deal_escrow").update({
            total_released: Number(escrow.total_released) + tokenBAmount,
            balance: Number(escrow.balance) - tokenBAmount,
          }).eq("deal_id", deal_id);
        }

        await supabase.from("deals").update({ current_phase: "loading_goods" }).eq("id", deal_id);

        if (deal.client_id) {
          await supabase.from("notifications").insert({
            user_id: deal.client_id,
            title: "🧪 [تجريبي] تم صرف توكن B — 50%",
            message: `تم خصم ${tokenBAmount.toFixed(2)} ${currency} من حساب الضمان — الصفقة #${deal.deal_number}. البضاعة قيد التحميل.`,
            type: "token_released",
            entity_type: "deal",
            entity_id: deal_id,
          });
        }

        const { data: admins } = await supabase.rpc("get_admin_contacts");
        for (const admin of admins || []) {
          await supabase.from("notifications").insert({
            user_id: admin.user_id,
            title: "🧪 [تجريبي] صرف توكن B تلقائي",
            message: `الصفقة #${deal.deal_number}: تم صرف ${tokenBAmount.toFixed(2)} ${currency} (50%) تلقائياً. الرصيد: ${escrow ? (Number(escrow.balance) - tokenBAmount).toFixed(2) : "—"} ${currency}`,
            type: "token_released",
            entity_type: "deal",
            entity_id: deal_id,
          });
        }

        result.token_amount = tokenBAmount;
        result.message = `🧪 تجريبي: تم صرف Token B وانتقال البضاعة لمرحلة التحميل`;
        break;
      }

      // === المرحلة 1: تحميل البضاعة ===
      case "loading_goods": {
        await supabase.from("deals").update({ current_phase: "loading_goods" }).eq("id", deal_id);
        if (deal.client_id) {
          await supabase.from("notifications").insert({
            user_id: deal.client_id,
            title: "📦 بضاعتك قيد التحميل",
            message: `الصفقة #${deal.deal_number}: يتم الآن تحميل بضاعتك استعداداً للشحن.`,
            type: "shipping_update", entity_type: "deal", entity_id: deal_id,
          });
        }
        result.message = "البضاعة قيد التحميل";
        break;
      }

      // === المرحلة 2: مغادرة المصنع ===
      case "leaving_factory": {
        await supabase.from("deals").update({ current_phase: "leaving_factory" }).eq("id", deal_id);
        if (deal.client_id) {
          await supabase.from("notifications").insert({
            user_id: deal.client_id,
            title: "🚛 البضاعة غادرت المصنع",
            message: `الصفقة #${deal.deal_number}: البضاعة في الطريق إلى ميناء التصدير.`,
            type: "shipping_update", entity_type: "deal", entity_id: deal_id,
          });
        }
        result.message = "البضاعة غادرت المصنع";
        break;
      }

      // === المرحلة 3: وصلت ميناء المصدر ===
      case "at_source_port": {
        await supabase.from("deals").update({ current_phase: "at_source_port" }).eq("id", deal_id);
        if (deal.client_id) {
          await supabase.from("notifications").insert({
            user_id: deal.client_id,
            title: "⚓ البضاعة في ميناء التصدير",
            message: `الصفقة #${deal.deal_number}: البضاعة وصلت ميناء التصدير وجاري إجراءات الشحن البحري.`,
            type: "shipping_update", entity_type: "deal", entity_id: deal_id,
          });
        }
        result.message = "البضاعة في ميناء التصدير";
        break;
      }

      // === المرحلة 4: شحن بحري — في البحر ===
      case "in_transit": {
        const { tracking_url } = data || {};
        await supabase.from("deals").update({ 
          current_phase: "in_transit",
          shipping_tracking_url: tracking_url || deal.shipping_tracking_url || "",
        }).eq("id", deal_id);
        if (deal.client_id) {
          await supabase.from("notifications").insert({
            user_id: deal.client_id,
            title: "🚢 البضاعة في البحر",
            message: `الصفقة #${deal.deal_number}: البضاعة تبحر الآن نحو ميناء الوجهة.${tracking_url ? " يمكنك تتبعها من لوحتك." : ""}`,
            type: "shipping_update", entity_type: "deal", entity_id: deal_id,
          });
        }
        result.message = "البضاعة في البحر";
        break;
      }

      // === المرحلة 5: وصلت ميناء الوجهة → تعيين لوجستيك الوجهة تلقائياً ===
      case "at_destination_port": {
        // البحث عن موظف لوجستيك في بلد العميل (import_country)
        const clientCountry = deal.import_country || deal.country || "";
        let destLogisticsId: string | null = null;

        if (clientCountry) {
          const { data: destAgents } = await supabase
            .from("employee_details")
            .select("user_id")
            .eq("job_code", "agent_07")
            .eq("country", clientCountry);

          // اختيار موظف مختلف عن لوجستيك المصنع
          const available = (destAgents || []).filter(
            (a: any) => a.user_id !== deal.logistics_employee_id
          );
          destLogisticsId = available[0]?.user_id || destAgents?.[0]?.user_id || null;
        }

        // إذا لم يُعثر على موظف بنفس البلد، البحث عن أي لوجستيك متاح
        if (!destLogisticsId) {
          const { data: anyAgents } = await supabase
            .from("employee_details")
            .select("user_id")
            .eq("job_code", "agent_07");
          const fallback = (anyAgents || []).filter(
            (a: any) => a.user_id !== deal.logistics_employee_id
          );
          destLogisticsId = fallback[0]?.user_id || null;
        }

        const updateData: any = {
          current_phase: "destination_inspection",
        };
        if (destLogisticsId) {
          updateData.destination_logistics_employee_id = destLogisticsId;
        }
        await supabase.from("deals").update(updateData).eq("id", deal_id);

        // إشعار موظف لوجستيك الوجهة
        if (destLogisticsId) {
          await supabase.from("notifications").insert({
            user_id: destLogisticsId,
            title: "📦 مهمة فحص وصول جديدة",
            message: `الصفقة #${deal.deal_number}: البضاعة وصلت ميناء الوجهة. يرجى التوجه لفحصها وتأكيد سلامتها لبدء العداد السيادي.`,
            type: "shipping_update",
            entity_type: "deal",
            entity_id: deal_id,
          });
        }

        if (deal.client_id) {
          await supabase.from("notifications").insert({
            user_id: deal.client_id,
            title: "🏁 البضاعة وصلت ميناء الوجهة",
            message: `الصفقة #${deal.deal_number}: البضاعة وصلت الميناء. سيتم فحصها من قبل وكيلنا قبل بدء العداد السيادي.`,
            type: "shipping_update", entity_type: "deal", entity_id: deal_id,
          });
        }

        const { data: admins } = await supabase.rpc("get_admin_contacts");
        for (const admin of admins || []) {
          await supabase.from("notifications").insert({
            user_id: admin.user_id,
            title: "🏁 وصول ميناء الوجهة + تعيين لوجستيك",
            message: `الصفقة #${deal.deal_number}: البضاعة وصلت. ${destLogisticsId ? "تم تعيين موظف لوجستيك الوجهة تلقائياً." : "⚠️ لم يُعثر على موظف لوجستيك للوجهة!"}`,
            type: "shipping_update", entity_type: "deal", entity_id: deal_id,
          });
        }

        result.destination_logistics_assigned = !!destLogisticsId;
        result.message = destLogisticsId 
          ? "البضاعة وصلت — تم تعيين لوجستيك الوجهة للفحص"
          : "البضاعة وصلت — ⚠️ لا يوجد موظف لوجستيك للوجهة";
        break;
      }

      // === تأكيد فحص الوصول من لوجستيك الوجهة → بدء العداد السيادي ===
      case "destination_arrival_confirmed": {
        const now = new Date();
        const timerEnd = new Date(now.getTime() + 168 * 60 * 60 * 1000);

        await supabase.from("deals").update({
          current_phase: "sovereignty_timer",
          sovereignty_timer_start: now.toISOString(),
          sovereignty_timer_end: timerEnd.toISOString(),
        }).eq("id", deal_id);

        if (deal.client_id) {
          await supabase.from("notifications").insert({
            user_id: deal.client_id,
            title: "⏱️ بدء العداد السيادي — 168 ساعة",
            message: `الصفقة #${deal.deal_number}: تم فحص البضاعة وتأكيد سلامتها. لديك 168 ساعة للاعتراض.`,
            type: "sovereignty_timer",
            entity_type: "deal",
            entity_id: deal_id,
          });
        }

        const { data: admins } = await supabase.rpc("get_admin_contacts");
        for (const admin of admins || []) {
          await supabase.from("notifications").insert({
            user_id: admin.user_id,
            title: "⏱️ العداد السيادي بدأ",
            message: `الصفقة #${deal.deal_number}: لوجستيك الوجهة أكّد سلامة البضاعة. العداد ينتهي في ${timerEnd.toISOString()}.`,
            type: "sovereignty_timer",
            entity_type: "deal",
            entity_id: deal_id,
          });
        }

        result.message = "تم تأكيد سلامة البضاعة — بدأ العداد السيادي 168 ساعة";
        result.timer_end = timerEnd.toISOString();
        break;
      }

      // === إعادة تشغيل العداد السيادي يدوياً (بعد حل اعتراض) ===
      case "restart_sovereignty_timer": {
        const now = new Date();
        const timerEnd = new Date(now.getTime() + 168 * 60 * 60 * 1000);

        await supabase.from("deals").update({
          current_phase: "sovereignty_timer",
          sovereignty_timer_start: now.toISOString(),
          sovereignty_timer_end: timerEnd.toISOString(),
        }).eq("id", deal_id);

        if (deal.client_id) {
          await supabase.from("notifications").insert({
            user_id: deal.client_id,
            title: "⏱️ إعادة تشغيل العداد السيادي",
            message: `الصفقة #${deal.deal_number}: تمت معالجة اعتراضك. بدأ العداد السيادي من جديد (168 ساعة).`,
            type: "sovereignty_timer",
            entity_type: "deal",
            entity_id: deal_id,
          });
        }

        result.message = "تم إعادة تشغيل العداد السيادي يدوياً";
        result.timer_end = timerEnd.toISOString();
        break;
      }

      // === توثيق لوجستي (رابط تتبع + صور أختام) ===
      case "logistics_documented": {
        const { tracking_url, seal_confirmed, seal_photo_url, notes: logNotes } = data || {};
        
        await supabase.from("deals").update({
          shipping_tracking_url: tracking_url || deal.shipping_tracking_url || "",
        }).eq("id", deal_id);

        result.message = "تم توثيق بيانات الشحنة";
        break;
      }

      // === تعيين مفتش الميناء ===
      case "assign_port_inspector": {
        const { inspector_id, port_address, port_country, port_lat, port_lng, assigned_by } = data || {};
        if (!inspector_id) throw new Error("inspector_id required");

        await supabase.from("deal_inspection_missions").insert({
          deal_id,
          inspector_id,
          mission_type: "port",
          factory_latitude: port_lat || 0,
          factory_longitude: port_lng || 0,
          factory_address: port_address || "الميناء",
          factory_country: port_country || "",
          assigned_by,
        });

        await supabase.from("deals").update({ current_phase: "port_inspection_assigned" }).eq("id", deal_id);

        await supabase.from("notifications").insert({
          user_id: inspector_id,
          title: "مهمة فحص ميناء جديدة",
          message: `تم تكليفك بمهمة فحص البضاعة عند وصولها للميناء — الصفقة #${deal.deal_number}.`,
          type: "inspection",
          entity_type: "deal",
          entity_id: deal_id,
        });

        result.message = "تم تعيين مفتش الميناء";
        break;
      }

      // === فحص الميناء مكتمل → بدء العداد السيادي ===
      case "port_inspection_complete": {
        const now = new Date();
        const timerEnd = new Date(now.getTime() + 168 * 60 * 60 * 1000); // 168 ساعة

        await supabase.from("deals").update({
          current_phase: "sovereignty_timer",
          sovereignty_timer_start: now.toISOString(),
          sovereignty_timer_end: timerEnd.toISOString(),
        }).eq("id", deal_id);

        if (deal.client_id) {
          await supabase.from("notifications").insert({
            user_id: deal.client_id,
            title: "بدء العداد السيادي — 168 ساعة",
            message: `البضاعة وصلت وتم فحصها. لديك 168 ساعة للاعتراض. بعدها تُغلق الصفقة نهائياً.`,
            type: "sovereignty_timer",
            entity_type: "deal",
            entity_id: deal_id,
          });
        }

        const { data: admins } = await supabase.rpc("get_admin_contacts");
        for (const admin of admins || []) {
          await supabase.from("notifications").insert({
            user_id: admin.user_id,
            title: "العداد السيادي بدأ",
            message: `الصفقة #${deal.deal_number}: بدأ العداد السيادي 168 ساعة. ينتهي في ${timerEnd.toISOString()}.`,
            type: "sovereignty_timer",
            entity_type: "deal",
            entity_id: deal_id,
          });
        }

        result.message = "بدأ العداد السيادي 168 ساعة";
        result.timer_end = timerEnd.toISOString();
        break;
      }

      // === انتهاء العداد → صرف التوكن C (20%) + عمولة المنصة → إغلاق الصفقة ===
      case "complete_deal": {
        // 1. جلب بيانات العقد
        const { data: contract } = await supabase
          .from("deal_contracts")
          .select("total_amount, currency, platform_fee_percentage")
          .eq("deal_id", deal_id)
          .single();

        const totalAmount = contract?.total_amount || deal.estimated_amount || 0;
        const currency = contract?.currency || "USD";
        const feePercent = contract?.platform_fee_percentage || 7;
        
        // صافي المبلغ بعد خصم العمولة
        const netAmount = totalAmount * (1 - feePercent / 100);
        const tokenCAmount = netAmount * 0.2;
        const platformFee = totalAmount * (feePercent / 100);

        // 2. إنشاء التوكن C
        await supabase.from("deal_tokens").insert({
          deal_id,
          token_type: "token_c",
          amount: tokenCAmount,
          percentage: 20,
          currency,
          status: "approved",
          approved_at: new Date().toISOString(),
          released_at: new Date().toISOString(),
        });

        // 3. تحديث حساب الضمان — خصم التوكن C + تحويل العمولة
        const { data: escrow } = await supabase
          .from("deal_escrow")
          .select("*")
          .eq("deal_id", deal_id)
          .single();

        if (escrow) {
          const newReleased = Number(escrow.total_released) + tokenCAmount + platformFee;
          await supabase.from("deal_escrow").update({
            total_released: newReleased,
            balance: 0,
            status: "completed",
          }).eq("deal_id", deal_id);
        } else {
          await supabase.from("deal_escrow")
            .update({ status: "completed" })
            .eq("deal_id", deal_id);
        }

        // 4. إغلاق الصفقة
        await supabase.from("deals").update({
          current_phase: "completed",
          status: "completed" as any,
        }).eq("id", deal_id);

        // 5. إشعار العميل
        if (deal.client_id) {
          await supabase.from("notifications").insert({
            user_id: deal.client_id,
            title: "🎉 الصفقة مكتملة — تم صرف الدفعة النهائية",
            message: `الصفقة #${deal.deal_number}: انتهى العداد السيادي دون اعتراض. تم صرف الدفعة النهائية (${tokenCAmount.toFixed(2)} ${currency}) للمصنع وعمولة المنصة (${platformFee.toFixed(2)} ${currency}). الصفقة مغلقة رسمياً.`,
            type: "deal_completed",
            entity_type: "deal",
            entity_id: deal_id,
          });
        }

        // 6. إشعار المدير
        const { data: admins } = await supabase.rpc("get_admin_contacts");
        for (const admin of admins || []) {
          await supabase.from("notifications").insert({
            user_id: admin.user_id,
            title: "🎉 صفقة مكتملة + توكن C + عمولة",
            message: `الصفقة #${deal.deal_number}: تم صرف التوكن C (${tokenCAmount.toFixed(2)} ${currency} — 20%) + عمولة المنصة (${platformFee.toFixed(2)} ${currency} — ${feePercent}%). الرصيد النهائي: 0 ${currency}. الصفقة مغلقة.`,
            type: "deal_completed",
            entity_type: "deal",
            entity_id: deal_id,
          });
        }

        result.token_c_amount = tokenCAmount;
        result.platform_fee = platformFee;
        result.message = `تم إغلاق الصفقة — توكن C: ${tokenCAmount.toFixed(2)} ${currency} + عمولة: ${platformFee.toFixed(2)} ${currency}`;
        break;
      }

      // === اعتراض العميل — إيقاف العداد السيادي ===
      case "client_objection": {
        const { reason, client_id: objClientId } = data || {};
        if (!reason || !objClientId) throw new Error("reason and client_id required");

        // إيقاف العداد
        await supabase.from("deals").update({
          current_phase: "objection_raised",
          sovereignty_timer_end: null,
        }).eq("id", deal_id);

        // تسجيل الاعتراض
        await supabase.from("deal_objections").insert({
          deal_id,
          client_id: objClientId,
          reason,
          status: "pending",
        });

        // إشعار المدير
        const { data: admins } = await supabase.rpc("get_admin_contacts");
        for (const admin of admins || []) {
          await supabase.from("notifications").insert({
            user_id: admin.user_id,
            title: "🚨 اعتراض عميل — تم إيقاف العداد السيادي",
            message: `الصفقة #${deal.deal_number}: اعترض العميل. السبب: ${reason.substring(0, 100)}`,
            type: "objection",
            entity_type: "deal",
            entity_id: deal_id,
          });
        }

        result.message = "تم تسجيل الاعتراض وإيقاف العداد السيادي";
        break;
      }

      // === محاكاة تجريبية: فحص → توكن A → إيداع للمصنع بخطوة واحدة ===
      case "test_auto_token_a": {
        // 1) جلب مبلغ العقد
        const { data: contract } = await supabase
          .from("deal_contracts")
          .select("total_amount, currency, platform_fee_percentage")
          .eq("deal_id", deal_id)
          .single();

        const totalAmount = contract?.total_amount || deal.estimated_amount || 0;
        const currency = contract?.currency || "USD";
        const feePercent = contract?.platform_fee_percentage || 7;
        const netAmount = totalAmount * (1 - feePercent / 100);
        const tokenAAmount = netAmount * 0.3;

        // 2) إنشاء التوكن
        await supabase.from("deal_tokens").insert({
          deal_id,
          token_type: "token_a",
          amount: tokenAAmount,
          percentage: 30,
          currency,
          status: "approved",
          approved_at: new Date().toISOString(),
        });

        // 3) تحديث الضمان — خصم المبلغ
        const { data: escrow } = await supabase
          .from("deal_escrow")
          .select("*")
          .eq("deal_id", deal_id)
          .single();

        if (escrow) {
          await supabase.from("deal_escrow").update({
            total_released: Number(escrow.total_released) + tokenAAmount,
            balance: Number(escrow.balance) - tokenAAmount,
          }).eq("deal_id", deal_id);
        }

        // 4) تحديث المرحلة
        await supabase.from("deals").update({ current_phase: "token_a_released" }).eq("id", deal_id);

        // 5) إشعارات
        if (deal.client_id) {
          await supabase.from("notifications").insert({
            user_id: deal.client_id,
            title: "🧪 [تجريبي] تم صرف توكن A — 30%",
            message: `تم خصم ${tokenAAmount.toFixed(2)} ${currency} من حساب الضمان وإيداعه لحساب المصنع — الصفقة #${deal.deal_number}.`,
            type: "token_released",
            entity_type: "deal",
            entity_id: deal_id,
          });
        }

        const { data: admins } = await supabase.rpc("get_admin_contacts");
        for (const admin of admins || []) {
          await supabase.from("notifications").insert({
            user_id: admin.user_id,
            title: "🧪 [تجريبي] صرف توكن A تلقائي",
            message: `الصفقة #${deal.deal_number}: تم صرف ${tokenAAmount.toFixed(2)} ${currency} (30%) تلقائياً للمصنع. الرصيد المتبقي: ${escrow ? (Number(escrow.balance) - tokenAAmount).toFixed(2) : "—"} ${currency}`,
            type: "token_released",
            entity_type: "deal",
            entity_id: deal_id,
          });
        }

        result.token_amount = tokenAAmount;
        result.remaining_balance = escrow ? Number(escrow.balance) - tokenAAmount : null;
        result.message = `🧪 تجريبي: تم خصم ${tokenAAmount.toFixed(2)} ${currency} وإيداعه للمصنع`;
        break;
      }

      // === محاكاة تجريبية شاملة: كل المراحل اللوجستية بخطوة واحدة ===
      case "test_full_logistics_simulation": {
        const testTrackingUrl = `https://www.searates.com/container/tracking/?number=TEST${deal.deal_number}`;
        const testContainerNumber = `TSTU${String(deal.deal_number).padStart(7, "0")}`;
        const testSealNumber = `SEAL-${Date.now().toString(36).toUpperCase()}`;
        const testBolNumber = `BOL-${deal.deal_number}-${Date.now().toString(36).toUpperCase()}`;
        const logisticsEmployeeId = deal.logistics_employee_id;

        const phases = [
          { phase: "loading_goods", label: "📦 تحميل البضاعة" },
          { phase: "leaving_factory", label: "🚛 مغادرة المصنع" },
          { phase: "at_source_port", label: "⚓ ميناء التصدير" },
          { phase: "in_transit", label: "🚢 في البحر" },
          { phase: "at_destination_port", label: "🏁 ميناء الوجهة" },
        ];

        for (const p of phases) {
          // إنشاء تقرير لكل مرحلة
          const reportData: any = {
            deal_id,
            phase: p.phase,
            employee_id: logisticsEmployeeId || deal.employee_id,
            status: "submitted",
            report_text: `🧪 [تقرير تجريبي] ${p.label} — الصفقة #${deal.deal_number}. كل شيء تمام. تم التحقق من البضاعة والمستندات.`,
            checklist_completed: JSON.stringify(["report"]),
            notes: "تقرير محاكاة تجريبية",
          };

          if (p.phase === "loading_goods") {
            reportData.container_number = testContainerNumber;
            reportData.seal_number = testSealNumber;
          }
          if (p.phase === "leaving_factory") {
            reportData.bol_number = testBolNumber;
          }
          if (p.phase === "at_source_port" || p.phase === "in_transit") {
            reportData.tracking_url = testTrackingUrl;
          }

          await supabase.from("logistics_reports").insert(reportData);

          // تحديث المرحلة
          const updateData: any = { current_phase: p.phase };
          if (p.phase === "at_source_port" || p.phase === "in_transit") {
            updateData.shipping_tracking_url = testTrackingUrl;
          }
          await supabase.from("deals").update(updateData).eq("id", deal_id);

          // إشعار العميل
          if (deal.client_id) {
            const msg = p.phase === "in_transit"
              ? `الصفقة #${deal.deal_number}: البضاعة في البحر 🚢. رابط التتبع: ${testTrackingUrl}`
              : `الصفقة #${deal.deal_number}: ${p.label}`;
            await supabase.from("notifications").insert({
              user_id: deal.client_id,
              title: `🧪 ${p.label}`,
              message: msg,
              type: "shipping_update",
              entity_type: "deal",
              entity_id: deal_id,
            });
          }
        }

        // بعد الوصول لميناء الوجهة → بدء العداد السيادي
        const now = new Date();
        const timerEnd = new Date(now.getTime() + 168 * 60 * 60 * 1000);
        await supabase.from("deals").update({
          current_phase: "sovereignty_timer",
          sovereignty_timer_start: now.toISOString(),
          sovereignty_timer_end: timerEnd.toISOString(),
          shipping_tracking_url: testTrackingUrl,
        }).eq("id", deal_id);

        // إشعار العميل ببدء العداد السيادي
        if (deal.client_id) {
          await supabase.from("notifications").insert({
            user_id: deal.client_id,
            title: "🧪 بدء العداد السيادي — 168 ساعة",
            message: `الصفقة #${deal.deal_number}: البضاعة وصلت وتم فحصها. لديك 168 ساعة للاعتراض. رقم الحاوية: ${testContainerNumber}. رقم التتبع: ${testTrackingUrl}`,
            type: "sovereignty_timer",
            entity_type: "deal",
            entity_id: deal_id,
          });
        }

        // إشعار المدير
        const { data: admins } = await supabase.rpc("get_admin_contacts");
        for (const admin of admins || []) {
          await supabase.from("notifications").insert({
            user_id: admin.user_id,
            title: "🧪 محاكاة لوجستية كاملة",
            message: `الصفقة #${deal.deal_number}: تمت محاكاة كل المراحل اللوجستية. حاوية: ${testContainerNumber}، ختم: ${testSealNumber}، BOL: ${testBolNumber}. العداد السيادي بدأ.`,
            type: "sovereignty_timer",
            entity_type: "deal",
            entity_id: deal_id,
          });
        }

        result.message = `🧪 تمت محاكاة كل المراحل اللوجستية وبدأ العداد السيادي`;
        result.tracking_url = testTrackingUrl;
        result.container_number = testContainerNumber;
        result.timer_end = timerEnd.toISOString();
        break;
      }

      // === تعيين المفتش الميداني آلياً بعد اعتماد الإيداع ===
      case "auto_assign_inspector": {
        // جلب بيانات التفاوض المقبولة للحصول على بلد المصنع
        const { data: acceptedNeg } = await supabase
          .from("deal_negotiations")
          .select("factory_name, factory_country, factory_email, factory_phone")
          .eq("deal_id", deal_id)
          .eq("status", "accepted")
          .limit(1)
          .maybeSingle();

        const factoryCountry = acceptedNeg?.factory_country || deal.import_country || deal.country || "";

        // البحث عن مفتشين لديهم صلاحية capture_evidence
        const { data: inspectorPerms } = await supabase
          .from("employee_permissions")
          .select("user_id")
          .eq("permission", "capture_evidence");

        if (!inspectorPerms?.length) {
          // لا يوجد مفتشون — إشعار المدير
          const { data: admins } = await supabase.rpc("get_admin_contacts");
          for (const admin of admins || []) {
            await supabase.from("notifications").insert({
              user_id: admin.user_id,
              title: "⚠️ لا يوجد مفتش ميداني",
              message: `الصفقة #${deal.deal_number}: تم اعتماد الإيداع لكن لا يوجد مفتش ميداني في النظام. يرجى إضافة مفتش يدوياً.`,
              type: "inspection", entity_type: "deal", entity_id: deal_id,
            });
          }
          result.message = "لا يوجد مفتش — تم إشعار المدير";
          break;
        }

        const inspectorIds = inspectorPerms.map(p => p.user_id);

        // جلب بيانات الموظفين لمطابقة البلد
        const { data: inspectorDetails } = await supabase
          .from("employee_details")
          .select("user_id, country")
          .in("user_id", inspectorIds);

        // اختيار المفتش: الأولوية لمن يطابق بلد المصنع
        let selectedInspectorId = inspectorIds[0]; // افتراضي: أول مفتش
        if (factoryCountry && inspectorDetails?.length) {
          const matched = inspectorDetails.find(d => 
            d.country && d.country.toLowerCase().includes(factoryCountry.toLowerCase())
          );
          if (matched) selectedInspectorId = matched.user_id;
        }

        // البحث الجغرافي عن إحداثيات المصنع
        let factoryLat = 0, factoryLng = 0, factoryAddress = "";
        const geoQuery = [acceptedNeg?.factory_name, factoryCountry].filter(Boolean).join(", ");
        
        if (geoQuery) {
          try {
            const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(geoQuery)}&limit=1`, {
              headers: { "User-Agent": "EQ-Platform/1.0" }
            });
            const geoData = await geoRes.json();
            if (geoData?.length > 0) {
              factoryLat = parseFloat(geoData[0].lat);
              factoryLng = parseFloat(geoData[0].lon);
              factoryAddress = geoData[0].display_name || geoQuery;
            }
          } catch (e) {
            console.error("Geocoding error:", e);
            factoryAddress = geoQuery;
          }
        }

        // إنشاء مهمة الفحص
        await supabase.from("deal_inspection_missions").insert({
          deal_id,
          inspector_id: selectedInspectorId,
          factory_latitude: factoryLat || null,
          factory_longitude: factoryLng || null,
          factory_address: factoryAddress,
          factory_country: factoryCountry,
          assigned_by: null, // تعيين آلي
          notes: "تعيين آلي بعد اعتماد الإيداع",
        });

        // تحديث مرحلة الصفقة
        await supabase.from("deals").update({ current_phase: "inspection_assigned" }).eq("id", deal_id);

        // جلب اسم المفتش
        const { data: inspProfile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", selectedInspectorId)
          .single();

        // إشعار المفتش
        await supabase.from("notifications").insert({
          user_id: selectedInspectorId,
          title: "مهمة فحص جديدة 🔍",
          message: `تم تكليفك آلياً بمهمة فحص للصفقة #${deal.deal_number}. يرجى التوجه للموقع المحدد.`,
          type: "inspection", entity_type: "deal", entity_id: deal_id,
        });

        // إشعار المدير
        const { data: admins } = await supabase.rpc("get_admin_contacts");
        for (const admin of admins || []) {
          await supabase.from("notifications").insert({
            user_id: admin.user_id,
            title: "✅ تعيين مفتش آلي",
            message: `الصفقة #${deal.deal_number}: تم تعيين المفتش "${inspProfile?.full_name || "غير معروف"}" آلياً بناءً على بلد المصنع (${factoryCountry}).`,
            type: "inspection", entity_type: "deal", entity_id: deal_id,
          });
        }

        result.inspector_id = selectedInspectorId;
        result.inspector_name = inspProfile?.full_name;
        result.message = `تم تعيين المفتش آلياً: ${inspProfile?.full_name || selectedInspectorId}`;
        break;
      }

      default:
        throw new Error("Unknown action: " + action);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Post-inspection error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
