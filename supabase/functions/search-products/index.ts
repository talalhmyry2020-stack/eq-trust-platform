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
    const webhookUrl = Deno.env.get("N8N_PHASE2_WEBHOOK_URL");

    if (!webhookUrl) throw new Error("N8N_PHASE2_WEBHOOK_URL not configured");

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: deal, error: dealError } = await supabase
      .from("deals")
      .select("*")
      .eq("id", deal_id)
      .single();

    if (dealError || !deal) throw new Error("Deal not found");

    // إرسال صورة المنتج إذا كانت موجودة
    let productImageSignedUrl: string | null = null;
    if (deal.product_image_url) {
      const { data: signedData } = await supabase.storage
        .from("deal-documents")
        .createSignedUrl(deal.product_image_url, 3600);
      productImageSignedUrl = signedData?.signedUrl || null;
    }

    // إرسال وصف المنتج وبلد التصدير لـ n8n للبحث
    const payload = {
      deal_id: deal.id,
      deal_number: deal.deal_number,
      product_type: deal.product_type,
      product_description: deal.product_description,
      import_country: deal.import_country,
      product_image_signed_url: productImageSignedUrl,
      callback_url: `${supabaseUrl}/functions/v1/receive-search-results`,
    };

    console.log("Sending product search request to n8n:", JSON.stringify(payload));

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.text();
    console.log("Product search response:", response.status, result);

    // تحديث مرحلة الصفقة
    await supabase.from("deals").update({ 
      current_phase: "searching_products" 
    }).eq("id", deal_id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Product search error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
