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
    const phase2WebhookUrl = Deno.env.get("N8N_PHASE2_WEBHOOK_URL");

    if (!phase2WebhookUrl) throw new Error("N8N_PHASE2_WEBHOOK_URL not configured");

    const supabase = createClient(supabaseUrl, serviceKey);

    // جلب جميع الصفقات المقبولة التي تحتاج بحث عن منتجات
    // المرحلة product_search تعني أنها جاهزة للبحث ولم يتم إرسالها بعد
    const { data: deals, error: dealsError } = await supabase
      .from("deals")
      .select("*")
      .eq("status", "active")
      .eq("current_phase", "product_search")
      .order("created_at", { ascending: true });

    if (dealsError) throw new Error("Failed to fetch deals: " + dealsError.message);

    if (!deals || deals.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: "لا توجد صفقات تحتاج معالجة",
        processed: 0 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    // معالجة كل صفقة على حدة - كل صفقة لها طلب مستقل
    for (const deal of deals) {
      try {
        // تحديث المرحلة فوراً لمنع التكرار
        await supabase.from("deals").update({ 
          current_phase: "searching_products" 
        }).eq("id", deal.id);

        // إعداد بيانات المنتج للإرسال
        const payload = {
          deal_id: deal.id,
          deal_number: deal.deal_number,
          product_type: deal.product_type,
          product_description: deal.product_description,
          import_country: deal.import_country,
          // رابط استقبال النتائج - كل صفقة لها رابط خاص بها
          callback_url: `${supabaseUrl}/functions/v1/receive-search-results`,
        };

        // إرسال صورة المنتج إذا كانت موجودة
        let productImageSignedUrl: string | null = null;
        if (deal.product_image_url) {
          const { data: signedData } = await supabase.storage
            .from("deal-documents")
            .createSignedUrl(deal.product_image_url, 3600);
          productImageSignedUrl = signedData?.signedUrl || null;
        }

        const fullPayload = {
          ...payload,
          product_image_signed_url: productImageSignedUrl,
        };

        console.log(`[Auto-Process] Sending deal ${deal.deal_number} (${deal.id}) to n8n`);

        const response = await fetch(phase2WebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fullPayload),
        });

        const responseText = await response.text();
        console.log(`[Auto-Process] Deal ${deal.deal_number} response: ${response.status}`);

        results.push({
          deal_id: deal.id,
          deal_number: deal.deal_number,
          status: response.status,
          success: response.ok,
        });

      } catch (dealError) {
        console.error(`[Auto-Process] Error processing deal ${deal.deal_number}:`, dealError);
        
        // إرجاع المرحلة في حال الخطأ
        await supabase.from("deals").update({ 
          current_phase: "product_search" 
        }).eq("id", deal.id);

        results.push({
          deal_id: deal.id,
          deal_number: deal.deal_number,
          success: false,
          error: dealError.message,
        });
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      total: deals.length,
      processed: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[Auto-Process] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
