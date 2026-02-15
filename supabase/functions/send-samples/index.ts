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

    // GET: استرجاع حالة العينات لصفقة معينة
    if (req.method === "GET") {
      const url = new URL(req.url);
      const dealId = url.searchParams.get("deal_id");

      if (!dealId) throw new Error("deal_id query param is required");

      const { data: samples, error } = await supabase
        .from("deal_samples")
        .select("*")
        .eq("deal_id", dealId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, samples }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST: إرسال طلب عينة إلى n8n
    if (req.method === "POST") {
      const { deal_id, sample_details, notes } = await req.json();
      if (!deal_id) throw new Error("deal_id is required");

      const webhookUrl = Deno.env.get("N8N_SAMPLES_WEBHOOK_URL");
      if (!webhookUrl) throw new Error("N8N_SAMPLES_WEBHOOK_URL not configured");

      // جلب بيانات الصفقة
      const { data: deal, error: dealError } = await supabase
        .from("deals")
        .select("*")
        .eq("id", deal_id)
        .single();

      if (dealError || !deal) throw new Error("Deal not found");

      // إنشاء سجل العينة في قاعدة البيانات
      const { data: sample, error: sampleError } = await supabase
        .from("deal_samples")
        .insert({
          deal_id,
          status: "pending",
          notes: notes || "",
          sample_details: sample_details || {},
        })
        .select()
        .single();

      if (sampleError) throw sampleError;

      // إرسال البيانات إلى n8n
      const payload = {
        sample_id: sample.id,
        deal_id: deal.id,
        deal_number: deal.deal_number,
        client_full_name: deal.client_full_name,
        product_type: deal.product_type,
        product_description: deal.product_description,
        import_country: deal.import_country,
        sample_details: sample_details || {},
        notes: notes || "",
        callback_url: `${supabaseUrl}/functions/v1/receive-sample-results`,
      };

      console.log("[Send Samples] Sending to n8n:", JSON.stringify(payload));

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.text();
      console.log("[Send Samples] n8n response:", response.status, result);

      // تحديث مرحلة الصفقة
      await supabase.from("deals").update({
        current_phase: "samples_requested",
      }).eq("id", deal_id);

      // إشعار العميل
      if (deal.client_id) {
        await supabase.from("notifications").insert({
          user_id: deal.client_id,
          title: "تم طلب عينة",
          message: `تم طلب عينة لصفقتك رقم ${deal.deal_number}`,
          type: "sample_requested",
          entity_type: "deal",
          entity_id: deal_id,
        });
      }

      return new Response(JSON.stringify({ success: true, sample }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Send Samples] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
