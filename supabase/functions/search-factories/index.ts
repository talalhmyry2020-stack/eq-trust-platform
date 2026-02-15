import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, country } = await req.json();
    if (!query) throw new Error("query is required");

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const searchPrompt = `ابحث عن مصانع وموردين لـ "${query}"${country ? ` في ${country}` : ""}.

أريد قائمة بأهم المصانع والموردين مع المعلومات التالية لكل مصنع:
1. اسم المصنع/الشركة
2. العنوان الكامل
3. البريد الإلكتروني
4. رقم الهاتف
5. الموقع الإلكتروني
6. البلد
7. المنتجات الرئيسية
8. ملاحظات إضافية

أعطني النتائج بصيغة JSON array فقط بدون أي نص إضافي، بالشكل التالي:
[
  {
    "name": "اسم المصنع",
    "address": "العنوان الكامل",
    "email": "البريد الإلكتروني",
    "phone": "رقم الهاتف",
    "website": "الموقع الإلكتروني",
    "country": "البلد",
    "products": "المنتجات الرئيسية",
    "notes": "ملاحظات"
  }
]

أعطني 5-10 نتائج حقيقية ومفصلة قدر الإمكان.`;

    console.log("Searching factories for:", query, country);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "أنت مساعد متخصص في البحث عن المصانع والموردين حول العالم. أجب دائماً بصيغة JSON array فقط بدون أي نص إضافي أو markdown.",
          },
          { role: "user", content: searchPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI Gateway error:", response.status, errText);
      throw new Error(`AI request failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "[]";

    // Parse JSON from response, handling potential markdown wrapping
    let factories = [];
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        factories = JSON.parse(jsonMatch[0]);
      }
    } catch (parseErr) {
      console.error("JSON parse error:", parseErr, "Content:", content);
      factories = [];
    }

    console.log(`Found ${factories.length} factories`);

    return new Response(JSON.stringify({ success: true, factories }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Factory search error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
