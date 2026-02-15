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
    const { deal_id } = await req.json();
    if (!deal_id) throw new Error("deal_id is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const tavilyKey = Deno.env.get("TAVILY_API_KEY");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, serviceKey);

    if (!tavilyKey) throw new Error("TAVILY_API_KEY not configured");
    if (!lovableKey) throw new Error("LOVABLE_API_KEY not configured");

    // جلب بيانات الصفقة
    const { data: deal, error: dealError } = await supabase
      .from("deals")
      .select("*")
      .eq("id", deal_id)
      .single();

    if (dealError || !deal) throw new Error("Deal not found");

    console.log(`[Search Agent] Processing deal #${deal.deal_number}: ${deal.product_type} - ${deal.import_country}`);

    // تحديث المرحلة
    await supabase.from("deals").update({ current_phase: "searching_products" }).eq("id", deal_id);

    // بحث عميق متعدد باستخدام Tavily - 5 استعلامات مختلفة لنتائج أدق
    const country = deal.import_country || "China";
    const product = deal.product_type || "";
    const desc = deal.product_description || "";

    const searchQueries = [
      `"${product}" manufacturer supplier factory ${country} email contact wholesale export`,
      `"${product}" factory ${country} email phone website verified high rating alibaba`,
      `best "${product}" manufacturer ${country} contact email address export supplier`,
      `"${product}" industrial company ${country} gmail yahoo hotmail email supplier`,
      `top rated "${product}" factory exporter ${country} phone number email wholesale`,
    ];

    let allResults: any[] = [];

    for (const query of searchQueries) {
      try {
        console.log(`[Search Agent] Tavily query: ${query.substring(0, 80)}...`);
        const tavilyResponse = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: tavilyKey,
            query,
            search_depth: "advanced",
            max_results: 15,
            include_answer: true,
            include_raw_content: true,
          }),
        });

        if (tavilyResponse.ok) {
          const data = await tavilyResponse.json();
          if (data.results) {
            allResults.push(...data.results);
            if (data.answer) allResults.push({ title: "AI Summary", content: data.answer, url: "" });
          }
        }
      } catch (err) {
        console.error(`[Search Agent] Tavily search error:`, err);
      }
    }

    console.log(`[Search Agent] Total raw results: ${allResults.length}`);

    // إزالة التكرارات بناءً على URL
    const uniqueResults = allResults.filter((r, i, arr) => 
      !r.url || arr.findIndex(x => x.url === r.url) === i
    );

    const resultsText = uniqueResults.map((r: any, i: number) =>
      `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content}`
    ).join("\n\n");

    // استخدام Gemini لاستخراج بيانات المصانع المنظمة
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content: `أنت خبير في التجارة الدولية والمصانع العالمية. لديك قاعدة بيانات ضخمة من المصانع الحقيقية مع بيانات تواصلهم.

مهمتك الأساسية: إيجاد 15-20 مصنع حقيقي مع بريد إلكتروني أو هاتف حقيقي.

الطريقة:
1. استخرج المصانع من نتائج البحث المرفقة مع بيانات تواصلهم
2. الأهم: أضف مصانع حقيقية ومعروفة من معرفتك الخاصة بالسوق - مصانع فعلية تعرفها مع إيميلاتها وأرقامها الحقيقية
3. ابحث في ذاكرتك عن مصانع في Alibaba, Made-in-China, GlobalSources, IndiaMART وغيرها

⛔ شروط:
- كل مصنع يجب أن يكون لديه إيميل حقيقي (يحتوي @) أو هاتف حقيقي (6+ أرقام)
- لا تكتب "N/A" أو "غير متوفر" - إذا لا تعرفه اكتب ""
- يجب أن تعطيني 15 نتيجة على الأقل
- JSON array فقط بدون نص إضافي أو markdown`,
          },
          {
            role: "user",
            content: `أريد قائمة مصانع وموردين لمنتج: "${product}"
وصف المنتج: "${desc}"
الدولة: "${country}"

نتائج البحث من الإنترنت:
${resultsText}

المطلوب:
1. استخرج المصانع من النتائج أعلاه
2. أضف من معرفتك مصانع موثوقة ومعروفة في ${country} تنتج "${product}" مع بيانات تواصلهم الحقيقية
3. كل مصنع يجب أن يكون لديه إيميل حقيقي أو رقم هاتف حقيقي على الأقل

الصيغة (JSON array فقط):
[{
  "factory_name": "اسم المصنع بالإنجليزية",
  "factory_name_ar": "ترجمة الاسم",
  "country": "البلد",
  "city": "المدينة",
  "email": "بريد إلكتروني حقيقي أو فارغ",
  "phone": "رقم هاتف حقيقي بصيغة دولية أو فارغ",
  "website": "الموقع",
  "products": "المنتجات",
  "rating": "ممتاز/جيد جداً/جيد",
  "certifications": "شهادات ISO وغيرها",
  "min_order": "الحد الأدنى للطلب",
  "notes": "ملاحظات"
}]`,
          },
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("[Search Agent] AI error:", aiResponse.status, errText);
      throw new Error(`AI request failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "[]";

    let factories: any[] = [];
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        factories = JSON.parse(jsonMatch[0]);
      }
    } catch (parseErr) {
      console.error("[Search Agent] JSON parse error:", parseErr);
      factories = [];
    }

    // تصفية صارمة: فقط المصانع التي لديها إيميل حقيقي أو رقم هاتف حقيقي
    const invalidValues = ["", "n/a", "غير متوفر", "غير معروف", "لا يوجد", "-", "none", "null", "undefined"];
    const hasRealEmail = (email: string) => email && !invalidValues.includes(email.toLowerCase().trim()) && email.includes("@");
    const hasRealPhone = (phone: string) => phone && !invalidValues.includes(phone.toLowerCase().trim()) && /\d{6,}/.test(phone.replace(/[\s\-\+\(\)]/g, ""));

    factories = factories.filter((f: any) => hasRealEmail(f.email || "") || hasRealPhone(f.phone || ""));

    console.log(`[Search Agent] After filtering (email/phone required): ${factories.length} factories for deal #${deal.deal_number}`);

    if (factories.length === 0) {
      // إرجاع المرحلة في حال عدم وجود نتائج
      await supabase.from("deals").update({ current_phase: "product_search" }).eq("id", deal_id);
      throw new Error("No factories found");
    }

    // حذف النتائج القديمة
    await supabase.from("deal_search_rows").delete().eq("deal_id", deal_id);
    await supabase.from("deal_search_columns").delete().eq("deal_id", deal_id);

    // إنشاء الأعمدة
    const columns = [
      "اسم المصنع",
      "البلد",
      "المدينة",
      "البريد الإلكتروني",
      "الهاتف",
      "الموقع الإلكتروني",
      "المنتجات",
      "التقييم",
      "الشهادات",
      "الحد الأدنى للطلب",
      "ملاحظات",
    ];

    const columnInserts = columns.map((col, i) => ({
      deal_id,
      column_name: col,
      column_order: i,
    }));

    await supabase.from("deal_search_columns").insert(columnInserts);

    // إنشاء الصفوف
    const rowInserts = factories.map((f: any, i: number) => ({
      deal_id,
      row_order: i,
      row_data: {
        "اسم المصنع": f.factory_name || f.factory_name_ar || "",
        "البلد": f.country || "",
        "المدينة": f.city || "",
        "البريد الإلكتروني": f.email || "",
        "الهاتف": f.phone || "",
        "الموقع الإلكتروني": f.website || "",
        "المنتجات": f.products || "",
        "التقييم": f.rating || "",
        "الشهادات": f.certifications || "",
        "الحد الأدنى للطلب": f.min_order || "",
        "ملاحظات": f.notes || "",
      },
    }));

    await supabase.from("deal_search_rows").insert(rowInserts);

    // تحديث مرحلة الصفقة
    await supabase.from("deals").update({ current_phase: "results_ready" }).eq("id", deal_id);

    // إرسال إشعار للعميل والمدير
    if (deal.client_id) {
      await supabase.from("notifications").insert({
        user_id: deal.client_id,
        title: "نتائج البحث جاهزة",
        message: `تم العثور على ${factories.length} مصنع/مورد لصفقتك رقم ${deal.deal_number}`,
        type: "product_results",
        entity_type: "deal",
        entity_id: deal_id,
      });
    }

    console.log(`[Search Agent] ✅ Saved ${factories.length} results for deal #${deal.deal_number}`);

    return new Response(JSON.stringify({
      success: true,
      deal_number: deal.deal_number,
      factories_count: factories.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[Search Agent] Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
