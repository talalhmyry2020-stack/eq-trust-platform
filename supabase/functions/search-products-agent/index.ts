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

    // بحث عميق - 5 استعلامات متوازية لسرعة وتغطية أفضل
    const country = deal.import_country || "China";
    const product = deal.product_type || "";
    const desc = deal.product_description || "";

    const searchQueries = [
      `"${product}" manufacturer ${country} email contact wholesale export`,
      `"${product}" factory supplier ${country} phone email address export trading`,
      `"${product}" company ${country} "@gmail.com" OR "@yahoo.com" OR "@hotmail.com"`,
      `"${product}" exporter ${country} contact us email tel wholesale verified`,
      `"${product}" industrial supplier ${country} email phone website export`,
    ];

    // تنفيذ جميع الاستعلامات بالتوازي لتسريع البحث
    console.log(`[Search Agent] Running ${searchQueries.length} parallel Tavily searches...`);
    const searchPromises = searchQueries.map(async (query) => {
      try {
        const resp = await fetch("https://api.tavily.com/search", {
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
        if (resp.ok) {
          const data = await resp.json();
          const results: any[] = data.results || [];
          if (data.answer) results.push({ title: "AI Summary", content: data.answer, url: "" });
          return results;
        }
        return [];
      } catch { return []; }
    });

    const allResults = (await Promise.all(searchPromises)).flat();
    console.log(`[Search Agent] Total raw results: ${allResults.length}`);

    // إزالة التكرارات
    const uniqueResults = allResults.filter((r, i, arr) => 
      !r.url || arr.findIndex(x => x.url === r.url) === i
    );

    const resultsText = uniqueResults.map((r: any, i: number) =>
      `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content}\n${r.raw_content ? r.raw_content.substring(0, 300) : ""}`
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
            content: `أنت خبير في التجارة الدولية. مهمتك استخراج بيانات المصانع الحقيقية فقط.

⛔ قاعدة صارمة جداً:
- لا تضف أي مصنع إلا إذا كان لديه بريد إلكتروني حقيقي (يحتوي @) أو رقم هاتف حقيقي (6 أرقام على الأقل)
- المصنع بدون إيميل وبدون رقم هاتف = لا تضفه نهائياً
- لا تخترع أو تتوقع إيميلات أو أرقام - فقط ما هو موجود في البيانات
- إذا لا تجد بريد أو هاتف حقيقي، لا تكتب "N/A" أو "غير متوفر"، ببساطة لا تضف المصنع

✅ ما أريده:
- فقط المصانع التي لديها وسيلة تواصل حقيقية (إيميل أو هاتف)
- أعطني أكبر عدد ممكن من النتائج المؤكدة
- JSON array فقط بدون أي نص إضافي`,
          },
          {
            role: "user",
            content: `استخرج فقط المصانع التي لديها إيميل حقيقي أو رقم هاتف حقيقي من النتائج التالية.
المنتج: "${product}" | الوصف: "${desc}" | الدولة: "${country}"

نتائج البحث:
${resultsText}

⚠️ تذكر: فقط المصانع التي لديها إيميل حقيقي (يحتوي @) أو رقم هاتف حقيقي. لا تضف أي مصنع بدون وسيلة تواصل.

الصيغة:
[{"factory_name":"","factory_name_ar":"","country":"","city":"","email":"","phone":"","website":"","products":"","rating":"","certifications":"","min_order":"","notes":""}]`,
          },
        ],
        temperature: 0.1,
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

    // تصفية صارمة مزدوجة: فقط من لديه إيميل حقيقي أو رقم هاتف حقيقي
    const invalidValues = ["", "n/a", "غير متوفر", "غير معروف", "لا يوجد", "-", "none", "null", "undefined", "not available", "not found"];
    const hasRealEmail = (email: string) => {
      if (!email) return false;
      const e = email.toLowerCase().trim();
      if (invalidValues.includes(e)) return false;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
    };
    const hasRealPhone = (phone: string) => {
      if (!phone) return false;
      const p = phone.toLowerCase().trim();
      if (invalidValues.includes(p)) return false;
      return /\d{6,}/.test(p.replace(/[\s\-\+\(\)\.]/g, ""));
    };

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
