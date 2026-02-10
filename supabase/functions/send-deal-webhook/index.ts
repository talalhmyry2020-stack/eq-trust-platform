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
    const supabase = createClient(supabaseUrl, serviceKey);

    // Try to get webhook URL from system_settings first, fallback to env
    let webhookUrl = Deno.env.get("N8N_WEBHOOK_URL");
    const { data: settingData } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "verification_webhook_url")
      .single();
    
    if (settingData?.value?.url) {
      webhookUrl = settingData.value.url;
    }

    if (!webhookUrl) throw new Error("Webhook URL not configured");

    // Fetch deal data
    const { data: deal, error: dealError } = await supabase
      .from("deals")
      .select("*")
      .eq("id", deal_id)
      .single();

    if (dealError || !deal) throw new Error("Deal not found: " + dealError?.message);

    // Generate signed URLs for documents (valid for 1 hour)
    const signedUrls: Record<string, string | null> = {};
    for (const field of ["identity_doc_url", "commercial_register_doc_url", "product_image_url"]) {
      const path = deal[field];
      if (path) {
        const { data } = await supabase.storage
          .from("deal-documents")
          .createSignedUrl(path, 3600);
        signedUrls[field] = data?.signedUrl || null;
      } else {
        signedUrls[field] = null;
      }
    }

    // Send ALL deal data + signed document URLs to webhook
    const payload = {
      deal_id: deal.id,
      deal_number: deal.deal_number,
      title: deal.title,
      deal_type: deal.deal_type,
      description: deal.description,
      status: deal.status,
      client_full_name: deal.client_full_name,
      national_id: deal.national_id,
      commercial_register_number: deal.commercial_register_number,
      entity_type: deal.entity_type,
      country: deal.country,
      city: deal.city,
      product_type: deal.product_type,
      product_description: deal.product_description,
      import_country: deal.import_country,
      identity_doc_signed_url: signedUrls.identity_doc_url,
      commercial_register_signed_url: signedUrls.commercial_register_doc_url,
      product_image_signed_url: signedUrls.product_image_url,
      created_at: deal.created_at,
      // Postback URL for n8n to send results back
      postback_url: `${supabaseUrl}/functions/v1/update-deal-status`,
    };

    console.log("Sending deal data to verification webhook...");
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.text();
    console.log("Webhook response:", response.status, result);

    let responseData: any = {};
    try { responseData = JSON.parse(result); } catch { /* ignore */ }

    // If webhook immediately returns a status, update the deal
    if (responseData.status === "approved" || responseData.status === "active") {
      await supabase.from("deals").update({ status: "active" as any }).eq("id", deal_id);
    } else if (responseData.status === "rejected" || responseData.status === "cancelled") {
      await supabase.from("deals").update({ status: "cancelled" as any }).eq("id", deal_id);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      webhook_status: response.status,
      final_status: responseData.status || "pending_review",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
