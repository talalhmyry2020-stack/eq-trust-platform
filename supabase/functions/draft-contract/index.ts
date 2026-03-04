import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { deal_id, admin_notes, shipping_type: requestedShippingType } = await req.json();
    if (!deal_id) throw new Error("deal_id is required");

    // Fetch deal data
    const { data: deal, error: dealError } = await supabase
      .from("deals")
      .select("*")
      .eq("id", deal_id)
      .single();

    if (dealError || !deal) throw new Error("Deal not found");

    // Fetch client profile
    const { data: clientProfile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("user_id", deal.client_id)
      .single();

    // Fetch phase 3 negotiation data (factory approval)
    const { data: negotiations } = await supabase
      .from("deal_negotiations")
      .select("*")
      .eq("deal_id", deal_id)
      .eq("negotiation_phase", 3)
      .eq("status", "accepted")
      .limit(1);

    const phase3 = negotiations?.[0];

    // Fetch phase 2 negotiation data for pricing
    const { data: phase2Negs } = await supabase
      .from("deal_negotiations")
      .select("*")
      .eq("deal_id", deal_id)
      .eq("negotiation_phase", 2)
      .limit(1);

    const phase2 = phase2Negs?.[0];

    // Check if contract already exists (for revision)
    const { data: existingContract } = await supabase
      .from("deal_contracts")
      .select("*")
      .eq("deal_id", deal_id)
      .order("created_at", { ascending: false })
      .limit(1);

    const isRevision = existingContract && existingContract.length > 0 && admin_notes;
    const revisionCount = isRevision ? (existingContract[0].revision_count || 0) + 1 : 0;

    // Use requested shipping type, or existing, or default
    const shippingType = requestedShippingType || existingContract?.[0]?.shipping_type || "FOB";
    const feeMap: Record<string, number> = { CIF: 3, FOB: 5, DOOR_TO_DOOR: 7 };
    const platformFee = feeMap[shippingType] || 7;

    const finalPrice = phase2?.final_price || phase3?.final_price || 0;
    const quantity = phase3?.requested_quantity || phase2?.requested_quantity || 1;
    const unit = phase3?.quantity_unit || phase2?.quantity_unit || "وحدة";
    const totalAmount = finalPrice * quantity;
    const platformAmount = totalAmount * (platformFee / 100);

    const clientName = deal.client_full_name || clientProfile?.full_name || "العميل";
    const factoryName = phase3?.factory_name || phase2?.factory_name || "المصنع";
    const clientCountry = deal.country || deal.import_country || "غير محدد";
    const factoryCountry = phase3?.factory_country || phase2?.factory_country || "غير محدد";

    const shippingLabel = shippingType === "CIF" ? "CIF - التسليم في ميناء المستورد" 
      : shippingType === "FOB" ? "FOB - التسليم في ميناء المورّد" 
      : "Door to Door - التسليم من الباب للباب";

    // Build AI prompt
    const systemPrompt = `أنت وكيل صياغة عقود خبير في "منصة EQ للوساطة التجارية". تصيغ عقوداً تجارية دولية احترافية باللغة العربية.

** تعليمات التنسيق الإلزامية: **
- أنشئ العقد بتنسيق HTML نظيف واحترافي يشبه ورقة رسمية حقيقية
- استخدم خط أسود فقط على خلفية بيضاء
- العناوين الرئيسية بحجم كبير وخط عريض (bold) ومحاذاة للوسط
- العناوين الفرعية بخط عريض وحجم متوسط
- ترقيم المواد والبنود بشكل واضح (المادة الأولى، المادة الثانية...)
- فقرات مرتبة مع مسافات بينها
- استخدم جداول HTML منظمة للبيانات المالية
- لا تستخدم ألواناً أو خلفيات ملونة، فقط أسود وأبيض
- أضف خطوط فاصلة بين الأقسام
- اجعل العقد يبدو كوثيقة قانونية رسمية مطبوعة
- استخدم <h1> لعنوان العقد الرئيسي، <h2> للمواد، <h3> للبنود الفرعية
- استخدم <table> مع حدود واضحة للجداول المالية
- أضف <hr> بين المواد الرئيسية
- النص الأساسي بحجم 14px وارتفاع سطر 1.8
- لا تستخدم أي CSS مضمن للألوان، فقط للحجم والمحاذاة والهوامش

قواعد الصياغة:
1. العقد يكون بين ثلاثة أطراف: الطرف الأول (العميل/المستورد)، الطرف الثاني (المصنع/المورد)، الطرف الثالث (منصة EQ للوساطة التجارية)
2. يجب مراعاة النظام القانوني والضريبي لبلد العميل (${clientCountry}) وبلد المصنع (${factoryCountry})
3. إضافة 10 أيام احتياطية على فترة التسليم المتفق عليها
4. نسبة ربح المنصة: ${platformFee}% (حسب نوع الشحن ${shippingLabel})
5. يجب تضمين بنود السيادة الرقمية

** شرط إلزامي في العقد: **
"لا يبدأ تنفيذ أي عمل إنتاجي أو تصنيعي من قبل الطرف الثاني (المصنع) إلا بعد تأكيد استلام المبلغ المالي كاملاً في حساب الوسيط الذكي (Escrow Account) التابع للمنصة، وتفعيل التوكنات المالية (Token A, B, C) رسمياً من قبل النظام."

بنود إلزامية في العقد:
- بوابة العهد: التوقيع الإلزامي على ميثاق السيادة الرقمية
- المرجعية القانونية: القانون البرمجي للمنصة هو المرجع الوحيد والنهائي
- قاعدة الصمت (168 ساعة): عدم اتخاذ إجراء خلال المهلة يعتبر قبولاً حكمياً
- الملاءة المالية: إيداع 100% من قيمة الصفقة كاعتماد مستندي (LC)
- التجميد المالي: حساب وسيط ذكي (Escrow Account)
- التوكن A (50%): دفعة الإنتاج - تُحرر بعد فحص المفتش الميداني
- التوكن B (30%): دفعة الشحن - تُحرر بعد المطابقة الثلاثية
- التوكن C (20%): الدفعة النهائية - تُحرر بعد 168 ساعة من الوصول
- آلية فض النزاعات: سيناريوهات مبرمجة
- صلاحيات حارس البوابة: حق الرفض القطعي لأي مورد
- كشف الاحتيال: إيقاف تلقائي للأسعار المشبوهة
- شرط التصوير المقيد: حصراً عبر كاميرا التطبيق

رتب العقد:
1. ديباجة العقد (الأطراف والتعريفات)
2. موضوع العقد ونطاقه
3. الالتزامات المالية والدفعات
4. شروط التسليم والشحن
5. ضمانات الجودة والمطابقة
6. فض النزاعات والتحكيم
7. الأحكام العامة والختامية
8. التوقيعات`;

    const contractDate = new Date().toLocaleDateString("ar-SA", { dateStyle: "full", timeZone: "Asia/Riyadh" });

    const userPrompt = `اصغ العقد التالي:

تاريخ تحرير العقد: ${contractDate}
- رقم الصفقة: #${deal.deal_number}
- عنوان الصفقة: ${deal.title}
- نوع الصفقة: ${deal.deal_type}
- وصف المنتج: ${deal.product_description || deal.product_type || "غير محدد"}

بيانات الأطراف:
- الطرف الأول (العميل): ${clientName}
- بلد العميل: ${clientCountry}
- مدينة العميل: ${deal.city || "غير محدد"}
- نوع الكيان: ${deal.entity_type || "غير محدد"}
- رقم الهوية: ${deal.national_id || "غير محدد"}
- رقم السجل التجاري: ${deal.commercial_register_number || "غير محدد"}

- الطرف الثاني (المصنع): ${factoryName}
- بلد المصنع: ${factoryCountry}

- الطرف الثالث: منصة EQ للوساطة التجارية

بيانات مالية:
- سعر الوحدة المتفق عليه: ${finalPrice} ${phase2?.currency || "USD"}
- الكمية: ${quantity} ${unit}
- المبلغ الإجمالي: ${totalAmount} ${phase2?.currency || "USD"}
- نسبة ربح المنصة: ${platformFee}% = ${platformAmount.toFixed(2)} ${phase2?.currency || "USD"}
- نوع الشحن: ${shippingLabel}
- مدة الشحن المقدرة: ${phase3?.shipping_time || phase2?.shipping_time || "30 يوم"} + 10 أيام احتياطية

${admin_notes ? `\n\nملاحظات للتعديل:\n${admin_notes}` : ""}
${isRevision ? `\n\nهذه مراجعة رقم ${revisionCount}. يرجى تعديل العقد بناءً على الملاحظات أعلاه.` : ""}

اصغ العقد بتنسيق HTML احترافي. يجب أن يبدو كورقة قانونية رسمية مطبوعة بخط أسود واضح على خلفية بيضاء.`;

    console.log(`[Contract Agent] Drafting contract for deal #${deal.deal_number}`);

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("[Contract Agent] AI error:", errText);
      if (aiResponse.status === 429) throw new Error("Rate limit exceeded");
      if (aiResponse.status === 402) throw new Error("Payment required");
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const contractHtml = aiData.choices?.[0]?.message?.content || "";

    // Strip markdown code fences if present
    const cleanHtml = contractHtml.replace(/```html\n?/g, "").replace(/```\n?/g, "").trim();

    // Plain text version
    const contractText = cleanHtml.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

    // After revision → send back to client_review
    // New contract → also goes to client_review
    const newStatus = "client_review";
    const newPhase = "contract_client_review";

    if (isRevision && existingContract?.[0]) {
      await supabase
        .from("deal_contracts")
        .update({
          contract_html: cleanHtml,
          contract_text: contractText,
          status: newStatus,
          revision_count: revisionCount,
          admin_notes: null,
          platform_fee_percentage: platformFee,
          total_amount: totalAmount,
          client_name: clientName,
          factory_name: factoryName,
          client_country: clientCountry,
          factory_country: factoryCountry,
        })
        .eq("id", existingContract[0].id);
    } else {
      await supabase.from("deal_contracts").insert({
        deal_id,
        contract_html: cleanHtml,
        contract_text: contractText,
        shipping_type: shippingType,
        platform_fee_percentage: platformFee,
        total_amount: totalAmount,
        currency: phase2?.currency || "USD",
        client_name: clientName,
        factory_name: factoryName,
        client_country: clientCountry,
        factory_country: factoryCountry,
        platform_name: "منصة EQ للوساطة التجارية",
        status: newStatus,
      });
    }

    await supabase
      .from("deals")
      .update({ current_phase: newPhase })
      .eq("id", deal_id);

    // Notify admin
    const { data: admins } = await supabase.rpc("get_admin_contacts");
    for (const admin of admins || []) {
      await supabase.from("notifications").insert({
        user_id: admin.user_id,
        title: `عقد جاهز - الصفقة #${deal.deal_number}`,
        message: isRevision
          ? `تم تعديل عقد الصفقة #${deal.deal_number} (المراجعة ${revisionCount}) وهو جاهز لمراجعتك.`
          : `تم صياغة عقد الصفقة #${deal.deal_number} وأُرسل للعميل لاختيار نوع الشحن.`,
        type: "contract_ready",
        entity_type: "deal",
        entity_id: deal_id,
      });
    }

    console.log(`[Contract Agent] Contract drafted for deal #${deal.deal_number}`);

    return new Response(JSON.stringify({
      success: true,
      message: `تم صياغة العقد للصفقة #${deal.deal_number}`,
      is_revision: isRevision,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[Contract Agent] Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
