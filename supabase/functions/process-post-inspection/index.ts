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

      // === المصنع أكمل الإنتاج → إرسال مهمة فحص جودة تلقائياً لنفس المفتش ===
      case "factory_completed": {
        await supabase.from("deals").update({ current_phase: "factory_completed" }).eq("id", deal_id);

        // جلب المهمة الأولى لنفس الصفقة لاستخدام نفس المفتش والموقع
        const { data: initialMission } = await supabase
          .from("deal_inspection_missions")
          .select("*")
          .eq("deal_id", deal_id)
          .eq("mission_type", "initial")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (initialMission) {
          // إنشاء مهمة فحص جودة تلقائياً بنفس المفتش والموقع
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
            notes: "مهمة فحص جودة تلقائية — التحقق من البضاعة والعدد المطلوب بعد اكتمال الإنتاج",
          });

          await supabase.from("deals").update({ current_phase: "quality_inspection_assigned" }).eq("id", deal_id);

          // إشعار المفتش بالمهمة الجديدة
          await supabase.from("notifications").insert({
            user_id: initialMission.inspector_id,
            title: "مهمة فحص جودة جديدة 🔍",
            message: `تم تكليفك تلقائياً بمهمة فحص جودة الإنتاج للصفقة #${deal.deal_number}. توجه لنفس الموقع السابق للتحقق من البضاعة والكمية.`,
            type: "inspection",
            entity_type: "deal",
            entity_id: deal_id,
          });
        }

        // إشعار المدير
        const { data: admins } = await supabase.rpc("get_admin_contacts");
        for (const admin of admins || []) {
          await supabase.from("notifications").insert({
            user_id: admin.user_id,
            title: "المصنع أكمل الإنتاج ✅",
            message: `الصفقة #${deal.deal_number}: المصنع أبلغ بإكمال الإنتاج.${initialMission ? " تم تعيين نفس المفتش تلقائياً لفحص الجودة." : " يرجى تعيين مفتش لفحص الجودة يدوياً."}`,
            type: "factory_update",
            entity_type: "deal",
            entity_id: deal_id,
          });
        }

        result.message = initialMission 
          ? "تم تسجيل اكتمال الإنتاج وتعيين مفتش الجودة تلقائياً" 
          : "تم تسجيل اكتمال الإنتاج — يرجى تعيين مفتش يدوياً";
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

      // === المرحلة 5: وصلت ميناء الوجهة ===
      case "at_destination_port": {
        await supabase.from("deals").update({ current_phase: "at_destination_port" }).eq("id", deal_id);
        if (deal.client_id) {
          await supabase.from("notifications").insert({
            user_id: deal.client_id,
            title: "🏁 البضاعة وصلت ميناء الوجهة",
            message: `الصفقة #${deal.deal_number}: البضاعة وصلت الميناء. سيتم فحصها قبل بدء العداد السيادي.`,
            type: "shipping_update", entity_type: "deal", entity_id: deal_id,
          });
        }
        result.message = "البضاعة وصلت ميناء الوجهة";
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

      // === انتهاء العداد → إغلاق الصفقة ===
      case "complete_deal": {
        await supabase.from("deals").update({
          current_phase: "completed",
          status: "completed" as any,
        }).eq("id", deal_id);

        // تحديث الضمان
        await supabase.from("deal_escrow")
          .update({ status: "completed" })
          .eq("deal_id", deal_id);

        if (deal.client_id) {
          await supabase.from("notifications").insert({
            user_id: deal.client_id,
            title: "🎉 الصفقة مكتملة",
            message: `تم إغلاق الصفقة #${deal.deal_number} بنجاح بعد انتهاء العداد السيادي دون اعتراض.`,
            type: "deal_completed",
            entity_type: "deal",
            entity_id: deal_id,
          });
        }

        result.message = "تم إغلاق الصفقة بنجاح";
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
