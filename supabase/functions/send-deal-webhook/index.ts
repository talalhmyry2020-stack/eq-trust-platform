import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    const webhookUrl = Deno.env.get("N8N_WEBHOOK_URL");

    if (!webhookUrl) throw new Error("N8N_WEBHOOK_URL not configured");

    const supabase = createClient(supabaseUrl, serviceKey);

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

    // Send to n8n webhook
    const payload = {
      deal_id: deal.id,
      deal_number: deal.deal_number,
      title: deal.title,
      deal_type: deal.deal_type,
      status: deal.status,
      client_id: deal.client_id,
      client_full_name: deal.client_full_name,
      country: deal.country,
      city: deal.city,
      national_id: deal.national_id,
      commercial_register_number: deal.commercial_register_number,
      entity_type: deal.entity_type,
      product_type: deal.product_type,
      product_description: deal.product_description,
      import_country: deal.import_country,
      created_at: deal.created_at,
      // Signed URLs for downloading files
      identity_doc_signed_url: signedUrls.identity_doc_url,
      commercial_register_signed_url: signedUrls.commercial_register_doc_url,
      product_image_signed_url: signedUrls.product_image_url,
    };

    const webhookResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const webhookResult = await webhookResponse.text();
    console.log("n8n webhook response:", webhookResponse.status, webhookResult);

    return new Response(JSON.stringify({ success: true }), {
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
