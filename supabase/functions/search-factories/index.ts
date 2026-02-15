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

    const tavilyKey = Deno.env.get("TAVILY_API_KEY");
    if (!tavilyKey) throw new Error("TAVILY_API_KEY not configured");

    const searchQuery = `${query} manufacturers suppliers factories${country ? ` in ${country}` : ""} contact email phone address website`;

    console.log("Tavily search:", searchQuery);

    const tavilyResponse = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: tavilyKey,
        query: searchQuery,
        search_depth: "advanced",
        max_results: 10,
        include_answer: true,
      }),
    });

    if (!tavilyResponse.ok) {
      const errText = await tavilyResponse.text();
      console.error("Tavily error:", tavilyResponse.status, errText);
      throw new Error(`Tavily request failed: ${tavilyResponse.status}`);
    }

    const tavilyData = await tavilyResponse.json();
    console.log("Tavily results count:", tavilyData.results?.length);

    // Now use Lovable AI to extract structured factory data from Tavily results
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) throw new Error("LOVABLE_API_KEY not configured");

    const resultsText = tavilyData.results?.map((r: any, i: number) => 
      `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content}`
    ).join("\n\n") || "";

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
            content: "أنت مساعد متخصص في استخراج بيانات المصانع والموردين. استخرج المعلومات من نتائج البحث وأرجعها كـ JSON array فقط بدون أي نص إضافي أو markdown.",
          },
          {
            role: "user",
            content: `من نتائج البحث التالية، استخرج بيانات المصانع والموردين بصيغة JSON array:

${resultsText}

${tavilyData.answer ? `\nملخص البحث: ${tavilyData.answer}` : ""}

أريد لكل مصنع:
[{"name":"اسم المصنع","address":"العنوان","email":"الإيميل","phone":"الهاتف","website":"الموقع","country":"البلد","products":"المنتجات","notes":"ملاحظات"}]

إذا لم تجد معلومة معينة اتركها فارغة. أعط أكبر عدد ممكن من النتائج.`,
          },
        ],
        temperature: 0.2,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error(`AI request failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "[]";

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

    console.log(`Extracted ${factories.length} factories`);

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
