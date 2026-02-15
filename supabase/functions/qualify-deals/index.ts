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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // تحقق من تفعيل وكيل التأهيل
    const { data: settingData } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "qualification_agent_enabled")
      .maybeSingle();

    const isEnabled = settingData?.value?.enabled === true;
    if (!isEnabled) {
      return new Response(JSON.stringify({
        success: true,
        message: "وكيل التأهيل معطّل في الإعدادات",
        processed: 0,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // جلب الصفقات قيد المراجعة
    const { data: deals, error: dealsError } = await supabase
      .from("deals")
      .select("*")
      .eq("status", "pending_review")
      .eq("current_phase", "verification")
      .order("created_at", { ascending: true })
      .limit(5);

    if (dealsError) throw new Error("Failed to fetch deals: " + dealsError.message);

    if (!deals || deals.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: "لا توجد صفقات قيد المراجعة",
        processed: 0,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    for (const deal of deals) {
      try {
        console.log(`[Qualify] Processing deal #${deal.deal_number}`);

        // التحقق من وجود البيانات الأساسية
        const hasIdentityDoc = !!deal.identity_doc_url;
        const hasCommercialDoc = !!deal.commercial_register_doc_url;
        const hasNationalId = !!deal.national_id;
        const hasCommercialRegNum = !!deal.commercial_register_number;
        const hasClientName = !!deal.client_full_name;

        // إذا لم توجد مستندات أو بيانات كافية → رفض مباشر
        if (!hasIdentityDoc && !hasCommercialDoc && !hasNationalId && !hasCommercialRegNum) {
          await rejectDeal(supabase, deal, "لم يتم تقديم أي مستندات أو بيانات قانونية. يرجى رفع صورة الهوية والسجل التجاري مع إدخال الأرقام.");
          results.push({ deal_number: deal.deal_number, status: "rejected", reason: "no_documents" });
          continue;
        }

        // إعداد روابط موقّعة للصور
        const imageContents: { type: string; image_url: { url: string } }[] = [];
        let analysisContext = "";

        if (hasIdentityDoc) {
          const { data: signedData } = await supabase.storage
            .from("deal-documents")
            .createSignedUrl(deal.identity_doc_url, 3600);
          if (signedData?.signedUrl) {
            imageContents.push({
              type: "image_url",
              image_url: { url: signedData.signedUrl },
            });
            analysisContext += `\n- صورة الهوية الوطنية مرفقة (الصورة ${imageContents.length})`;
          }
        }

        if (hasCommercialDoc) {
          const { data: signedData } = await supabase.storage
            .from("deal-documents")
            .createSignedUrl(deal.commercial_register_doc_url, 3600);
          if (signedData?.signedUrl) {
            imageContents.push({
              type: "image_url",
              image_url: { url: signedData.signedUrl },
            });
            analysisContext += `\n- صورة السجل التجاري مرفقة (الصورة ${imageContents.length})`;
          }
        }

        // البيانات المدخلة من العميل
        const enteredData = `
البيانات المدخلة من العميل:
- الاسم الكامل: ${deal.client_full_name || "غير محدد"}
- رقم الهوية الوطنية: ${deal.national_id || "غير محدد"}
- رقم السجل التجاري: ${deal.commercial_register_number || "غير محدد"}
- نوع الكيان: ${deal.entity_type || "غير محدد"}
- الدولة: ${deal.country || "غير محدد"}
- المدينة: ${deal.city || "غير محدد"}
`;

        const systemPrompt = `أنت وكيل تأهيل ذكي متخصص في التحقق من المستندات القانونية. مهمتك هي فحص صور المستندات المرفقة (الهوية الوطنية والسجل التجاري) ومقارنة البيانات المستخرجة مع البيانات المدخلة.

قواعد التحقق:
1. استخرج البيانات من الصور باستخدام OCR
2. قارن الاسم ورقم الهوية ورقم السجل التجاري مع البيانات المدخلة
3. المطابقة الجزئية في الاسم مقبولة (مثلاً: محمد أحمد = محمد احمد)
4. الأرقام يجب أن تتطابق تماماً
5. إذا لم تتوفر صورة لمستند معين، تحقق فقط من المستندات المتاحة

يجب أن تردّ بصيغة JSON فقط بدون أي نص إضافي:
{
  "approved": true/false,
  "confidence": 0-100,
  "extracted_data": {
    "name_from_id": "الاسم من الهوية",
    "national_id_from_doc": "رقم الهوية من المستند",
    "commercial_reg_from_doc": "رقم السجل من المستند"
  },
  "matching_details": {
    "name_match": true/false,
    "id_match": true/false,
    "commercial_reg_match": true/false
  },
  "rejection_reason": "سبب الرفض إن وجد باللغة العربية"
}`;

        const userMessage: any[] = [
          { type: "text", text: `تحقق من المستندات التالية:\n${enteredData}\n\nالمستندات المرفقة:${analysisContext || "\nلا توجد مستندات مرفقة"}` },
          ...imageContents,
        ];

        // إذا لا توجد صور أصلاً، نحتاج فقط التحقق من اكتمال البيانات
        if (imageContents.length === 0) {
          // لا مستندات مرفوعة - رفض
          await rejectDeal(supabase, deal, "لم يتم رفع صور المستندات المطلوبة (الهوية الوطنية / السجل التجاري). يرجى رفع المستندات وإعادة إرسال الصفقة.");
          results.push({ deal_number: deal.deal_number, status: "rejected", reason: "no_images" });
          continue;
        }

        // استدعاء AI
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMessage },
            ],
          }),
        });

        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          console.error(`[Qualify] AI error for deal #${deal.deal_number}:`, aiResponse.status, errText);
          
          if (aiResponse.status === 429 || aiResponse.status === 402) {
            results.push({ deal_number: deal.deal_number, status: "skipped", reason: "rate_limited" });
            continue;
          }
          results.push({ deal_number: deal.deal_number, status: "error", reason: "ai_error" });
          continue;
        }

        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content || "";

        // استخراج JSON من الرد
        let verification: any;
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (!jsonMatch) throw new Error("No JSON found");
          verification = JSON.parse(jsonMatch[0]);
        } catch (parseError) {
          console.error(`[Qualify] Failed to parse AI response for deal #${deal.deal_number}:`, content);
          results.push({ deal_number: deal.deal_number, status: "error", reason: "parse_error" });
          continue;
        }

        console.log(`[Qualify] Deal #${deal.deal_number} result:`, JSON.stringify(verification));

        // جلب قائمة المدراء لإرسال الإشعارات
        const { data: adminRoles } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");
        const adminIds = (adminRoles || []).map((r: any) => r.user_id);

        if (verification.approved) {
          // قبول الصفقة
          await supabase.from("deals").update({
            status: "active",
            current_phase: "product_search",
          }).eq("id", deal.id);

          // إشعار العميل
          if (deal.client_id) {
            await supabase.from("notifications").insert({
              user_id: deal.client_id,
              title: `✅ تم قبول الصفقة #${deal.deal_number}`,
              message: `تم التحقق من مستنداتك بنجاح وقبول صفقتك. سيتم الآن البحث عن أفضل الخيارات لك.`,
              type: "deal_update",
              entity_type: "deal",
              entity_id: deal.id,
            });
          }

          // إشعار المدراء
          for (const adminId of adminIds) {
            await supabase.from("notifications").insert({
              user_id: adminId,
              title: `✅ وكيل التأهيل: قبول الصفقة #${deal.deal_number}`,
              message: `تم قبول الصفقة "${deal.title}" تلقائياً بعد التحقق من المستندات بنسبة ثقة ${verification.confidence || 0}%.`,
              type: "deal_update",
              entity_type: "deal",
              entity_id: deal.id,
            });
          }

          // سجل النشاط
          await supabase.from("activity_logs").insert({
            action: "deal_qualified",
            entity_type: "deal",
            entity_id: deal.id,
            details: { agent: "qualification_agent", verification_result: verification },
          });

          results.push({ deal_number: deal.deal_number, status: "approved", confidence: verification.confidence });
        } else {
          // رفض الصفقة
          const reason = verification.rejection_reason || "لم تتطابق البيانات المدخلة مع المستندات المرفقة.";
          await rejectDeal(supabase, deal, reason, verification, adminIds);
          results.push({ deal_number: deal.deal_number, status: "rejected", reason: verification.rejection_reason });
        }

      } catch (dealError) {
        console.error(`[Qualify] Error processing deal #${deal.deal_number}:`, dealError);
        results.push({ deal_number: deal.deal_number, status: "error", reason: (dealError as Error).message });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: results.length,
      results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[Qualify] Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function rejectDeal(supabase: any, deal: any, reason: string, verificationData?: any, adminIds?: string[]) {
  // تحديث الصفقة إلى ملغاة
  await supabase.from("deals").update({
    status: "cancelled",
    current_phase: "verification",
  }).eq("id", deal.id);

  // إرسال إشعار للعميل بسبب الرفض
  if (deal.client_id) {
    await supabase.from("notifications").insert({
      user_id: deal.client_id,
      title: `❌ تم رفض الصفقة #${deal.deal_number}`,
      message: `سبب الرفض: ${reason}\n\nيمكنك تقديم اعتراض من صفحة صفقاتك.`,
      type: "deal_update",
      entity_type: "deal",
      entity_id: deal.id,
    });
  }

  // إشعار المدراء
  if (adminIds) {
    for (const adminId of adminIds) {
      await supabase.from("notifications").insert({
        user_id: adminId,
        title: `❌ وكيل التأهيل: رفض الصفقة #${deal.deal_number}`,
        message: `تم رفض الصفقة "${deal.title}" تلقائياً.\nسبب الرفض: ${reason}`,
        type: "deal_update",
        entity_type: "deal",
        entity_id: deal.id,
      });
    }
  }

  // سجل النشاط
  await supabase.from("activity_logs").insert({
    action: "deal_rejected",
    entity_type: "deal",
    entity_id: deal.id,
    details: {
      agent: "qualification_agent",
      rejection_reason: reason,
      verification_result: verificationData || null,
    },
  });
}
