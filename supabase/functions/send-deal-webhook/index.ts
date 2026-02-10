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
    const phase1Url = Deno.env.get("N8N_WEBHOOK_URL");
    const phase2Url = Deno.env.get("N8N_PHASE2_WEBHOOK_URL");

    if (!phase1Url) throw new Error("N8N_WEBHOOK_URL not configured");
    if (!phase2Url) throw new Error("N8N_PHASE2_WEBHOOK_URL not configured");

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

    // ===== المرحلة الأولى: إرسال المستندات والبيانات القانونية =====
    const phase1Payload = {
      phase: 1,
      deal_id: deal.id,
      deal_number: deal.deal_number,
      client_full_name: deal.client_full_name,
      national_id: deal.national_id,
      commercial_register_number: deal.commercial_register_number,
      entity_type: deal.entity_type,
      country: deal.country,
      city: deal.city,
      identity_doc_signed_url: signedUrls.identity_doc_url,
      commercial_register_signed_url: signedUrls.commercial_register_doc_url,
    };

    console.log("Phase 1: Sending documents to webhook...");
    const phase1Response = await fetch(phase1Url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(phase1Payload),
    });

    const phase1Result = await phase1Response.text();
    console.log("Phase 1 response:", phase1Response.status, phase1Result);

    let phase1Data: any = {};
    try { phase1Data = JSON.parse(phase1Result); } catch { /* ignore */ }

    // إذا رفض في المرحلة الأولى، نوقف ونحدث الحالة
    if (phase1Data.status === "rejected" || phase1Data.status === "cancelled") {
      await supabase.from("deals").update({ status: "cancelled" as any }).eq("id", deal_id);
      return new Response(JSON.stringify({ 
        success: true, 
        phase: 1, 
        result: "rejected",
        final_status: "cancelled" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== المرحلة الثانية: إرسال بيانات المنتج مع المستندات =====
    const phase2Payload = {
      phase: 2,
      deal_id: deal.id,
      deal_number: deal.deal_number,
      product_type: deal.product_type,
      product_description: deal.product_description,
      import_country: deal.import_country,
      product_image_signed_url: signedUrls.product_image_url,
      // إعادة إرسال المستندات للمرجع
      national_id: deal.national_id,
      commercial_register_number: deal.commercial_register_number,
      identity_doc_signed_url: signedUrls.identity_doc_url,
      commercial_register_signed_url: signedUrls.commercial_register_doc_url,
    };

    console.log("Phase 2: Sending product data to webhook...");
    const phase2Response = await fetch(phase2Url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(phase2Payload),
    });

    const phase2Result = await phase2Response.text();
    console.log("Phase 2 response:", phase2Response.status, phase2Result);

    let phase2Data: any = {};
    try { phase2Data = JSON.parse(phase2Result); } catch { /* ignore */ }

    // تحديد الحالة النهائية بناءً على الرد
    let finalStatus = "pending_review";
    if (phase2Data.status === "approved" || phase2Data.status === "active") {
      finalStatus = "active";
    } else if (phase2Data.status === "rejected" || phase2Data.status === "cancelled") {
      finalStatus = "cancelled";
    } else if (phase2Data.status === "delayed") {
      finalStatus = "delayed";
    } else if (phase2Data.status === "paused") {
      finalStatus = "paused";
    }

    // تحديث حالة الصفقة
    if (finalStatus !== "pending_review") {
      await supabase.from("deals").update({ status: finalStatus as any }).eq("id", deal_id);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      phase1_status: phase1Data.status || "ok",
      phase2_status: phase2Data.status || "ok",
      final_status: finalStatus,
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
