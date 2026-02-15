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

    // بحث متعدد باستخدام Tavily للحصول على أكبر عدد من النتائج
    const searchQueries = [
      `${deal.product_type} ${deal.product_description || ""} manufacturers suppliers factories in ${deal.import_country || "China"} contact email website high rated`,
      `best ${deal.product_type} factory supplier ${deal.import_country || "China"} wholesale export contact information email`,
      `top rated ${deal.product_type} manufacturer ${deal.import_country || "China"} verified supplier email phone website`,
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
            max_results: 10,
            include_answer: true,
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
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `أنت وكيل بحث متخصص في إيجاد المصانع والموردين الموثوقين. مهمتك:
1. استخراج أكبر عدد ممكن من المصانع (10 نتائج أو أكثر)
2. التركيز على المصانع ذات التقييم العالي والسمعة الجيدة
3. جلب معلومات التواصل الكاملة (إيميل، هاتف، موقع)
4. أعد النتائج كـ JSON array فقط بدون أي نص إضافي أو markdown أو backticks`,
          },
          {
            role: "user",
            content: `ابحث في النتائج التالية عن مصانع وموردين لمنتج: "${deal.product_type}"
وصف المنتج: "${deal.product_description || "غير متوفر"}"
الدولة المطلوبة: "${deal.import_country || "الصين"}"

نتائج البحث:
${resultsText}

استخرج على الأقل 10 مصانع/موردين بالصيغة التالية (JSON array فقط):
[{
  "factory_name": "اسم المصنع بالإنجليزية",
  "factory_name_ar": "اسم المصنع بالعربية إن وجد",
  "country": "البلد",
  "city": "المدينة",
  "email": "البريد الإلكتروني",
  "phone": "رقم الهاتف",
  "website": "الموقع الإلكتروني",
  "products": "المنتجات الرئيسية",
  "rating": "تقييم المصنع (ممتاز/جيد جداً/جيد)",
  "certifications": "الشهادات والمعايير",
  "min_order": "الحد الأدنى للطلب",
  "notes": "ملاحظات إضافية"
}]

إذا لم تجد 10 نتائج من البيانات المتاحة، أضف مصانع معروفة ذات صلة بهذا المنتج في ${deal.import_country || "الصين"} من معرفتك العامة.
أعد JSON array فقط.`,
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

    console.log(`[Search Agent] Extracted ${factories.length} factories for deal #${deal.deal_number}`);

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
