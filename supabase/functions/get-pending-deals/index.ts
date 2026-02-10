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

    const url = new URL(req.url);
    const dealId = url.searchParams.get("deal_id");

    // If deal_id provided, return single deal; otherwise return all pending_review deals
    let query = supabase.from("deals").select("*");
    
    if (dealId) {
      query = query.eq("id", dealId);
    } else {
      query = query.eq("status", "pending_review");
    }

    const { data: deals, error } = await query.order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    if (!deals || deals.length === 0) {
      return new Response(JSON.stringify({ deals: [], count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate signed URLs for all documents
    const enrichedDeals = await Promise.all(
      deals.map(async (deal: any) => {
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

        return {
          deal_id: deal.id,
          deal_number: deal.deal_number,
          title: deal.title,
          deal_type: deal.deal_type,
          description: deal.description,
          status: deal.status,
          current_phase: deal.current_phase,
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
        };
      })
    );

    return new Response(JSON.stringify({ 
      deals: enrichedDeals, 
      count: enrichedDeals.length 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Get pending deals error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
