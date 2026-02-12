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
    const supabase = createClient(supabaseUrl, serviceKey);

    // قراءة رابط الـ Webhook من إعدادات النظام
    const { data: settingData, error: settingError } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "phase1_webhook_url")
      .single();

    if (settingError || !settingData) {
      throw new Error("رابط Webhook المرحلة الأولى غير مُعد في الإعدادات");
    }

    const phase1WebhookUrl = (settingData.value as any)?.url;
    if (!phase1WebhookUrl) {
      throw new Error("رابط Webhook المرحلة الأولى فارغ");
    }

    // جلب الصفقات المقبولة في المرحلة الأولى (product_search)
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

    for (const deal of deals) {
      try {
        // تحديث المرحلة فوراً لمنع التكرار
        await supabase.from("deals").update({ 
          current_phase: "searching_products" 
        }).eq("id", deal.id);

        // إعداد رابط موقّع لصورة المنتج
        let productImageSignedUrl: string | null = null;
        if (deal.product_image_url) {
          const { data: signedData } = await supabase.storage
            .from("deal-documents")
            .createSignedUrl(deal.product_image_url, 3600);
          productImageSignedUrl = signedData?.signedUrl || null;
        }

        const payload = {
          deal_id: deal.id,
          deal_number: deal.deal_number,
          product_type: deal.product_type,
          product_description: deal.product_description,
          import_country: deal.import_country,
          product_image_signed_url: productImageSignedUrl,
          callback_url: `${supabaseUrl}/functions/v1/receive-search-results`,
        };

        console.log(`[Auto-Process] Sending deal ${deal.deal_number} (${deal.id}) to webhook`);

        const response = await fetch(phase1WebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
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
          error: (dealError as Error).message,
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
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
