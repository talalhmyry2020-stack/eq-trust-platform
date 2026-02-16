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

    const { deal_id, admin_notes } = await req.json();
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

    // Determine shipping type from existing contract or default
    const shippingType = existingContract?.[0]?.shipping_type || "FOB";
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

    // Build AI prompt
    const systemPrompt = `أنت وكيل صياغة عقود خبير في "منصة EQ للوساطة التجارية". تصيغ عقوداً تجارية دولية احترافية باللغة العربية.

قواعد الصياغة:
1. العقد يكون بين ثلاثة أطراف: الطرف الأول (العميل/المستورد)، الطرف الثاني (المصنع/المورد)، الطرف الثالث (منصة EQ للوساطة التجارية)
2. يجب مراعاة النظام القانوني والضريبي لبلد العميل (${clientCountry}) وبلد المصنع (${factoryCountry})
3. إضافة 10 أيام احتياطية على فترة التسليم المتفق عليها
4. نسبة ربح المنصة: ${platformFee}% (حسب نوع الشحن ${shippingType})
5. يجب تضمين بنود السيادة الرقمية التالية:

بنود إلزامية في العقد:
- بوابة العهد: التوقيع الإلزامي على ميثاق السيادة الرقمية
- المرجعية القانونية: القانون البرمجي للمنصة هو المرجع الوحيد والنهائي
- قاعدة الصمت (168 ساعة): عدم اتخاذ إجراء خلال المهلة يعتبر قبولاً حكمياً
- الملاءة المالية: إيداع 100% من قيمة الصفقة كاعتماد مستندي (LC)
- التجميد المالي: حساب وسيط ذكي (Escrow Account)
- التوكن A (50%): دفعة الإنتاج - تُحرر بعد فحص المفتش الميداني
- التوكن B (30%): دفعة الشحن - تُحرر بعد المطابقة الثلاثية (رقم الحاوية + الختم الملاحي + بوليصة الشحن)
- التوكن C (20%): الدفعة النهائية - تُحرر بعد 168 ساعة من الوصول (أو قبول حكمي)
- آلية فض النزاعات: سيناريوهات مبرمجة (خديعة المواصفات، تأخير التصنيع، خيانة الوكيل)
- صلاحيات حارس البوابة: حق الرفض القطعي لأي مورد
- المسطرة الرقمية: اعتماد معايير رقمية فقط (لا مصطلحات وصفية)
- كشف الاحتيال: إيقاف تلقائي للأسعار المشبوهة
- شرط التصوير المقيد: حصراً عبر كاميرا التطبيق

6. رتب العقد بحسب المعايير الدولية:
   - ديباجة العقد (الأطراف والتعريفات)
   - موضوع العقد ونطاقه
   - الالتزامات المالية والدفعات
   - شروط التسليم والشحن
   - ضمانات الجودة والمطابقة
   - فض النزاعات والتحكيم
   - الأحكام العامة والختامية

7. استخدم تنسيق HTML نظيف مع جداول وعناوين منظمة
8. أضف ترقيم المواد والبنود بشكل احترافي`;

    const userPrompt = `اصغ العقد التالي:

بيانات الصفقة:
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
- نوع الشحن: ${shippingType}
- مدة الشحن المقدرة: ${phase3?.shipping_time || phase2?.shipping_time || "30 يوم"} + 10 أيام احتياطية

${admin_notes ? `\n\nملاحظات المدير للتعديل:\n${admin_notes}` : ""}
${isRevision ? `\n\nهذه مراجعة رقم ${revisionCount}. يرجى تعديل العقد بناءً على ملاحظات المدير أعلاه.` : ""}

اصغ العقد بتنسيق HTML احترافي مع كل البنود والشروط. يجب أن يكون العقد شاملاً ومفصلاً.`;

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

    if (isRevision && existingContract?.[0]) {
      // Update existing contract
      await supabase
        .from("deal_contracts")
        .update({
          contract_html: cleanHtml,
          contract_text: contractText,
          status: "admin_review",
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

      await supabase
        .from("deals")
        .update({ current_phase: "contract_review" })
        .eq("id", deal_id);
    } else {
      // Create new contract
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
        status: "admin_review",
      });

      await supabase
        .from("deals")
        .update({ current_phase: "contract_review" })
        .eq("id", deal_id);
    }

    // Notify admin
    const { data: admins } = await supabase.rpc("get_admin_contacts");
    for (const admin of admins || []) {
      await supabase.from("notifications").insert({
        user_id: admin.user_id,
        title: `عقد جاهز للمراجعة - الصفقة #${deal.deal_number}`,
        message: isRevision
          ? `تم تعديل عقد الصفقة #${deal.deal_number} (المراجعة ${revisionCount}) وهو جاهز لمراجعتك.`
          : `تم صياغة عقد الصفقة #${deal.deal_number} بواسطة وكيل العقود وهو جاهز لمراجعتك.`,
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
