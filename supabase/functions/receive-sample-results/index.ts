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
    const body = await req.json();
    const {
      sample_id,
      deal_id,
      status,
      tracking_number,
      shipping_company,
      shipping_date,
      estimated_arrival,
      notes,
      callback_data,
    } = body;

    if (!sample_id && !deal_id) {
      throw new Error("sample_id or deal_id is required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // بناء التحديث
    const updateData: Record<string, any> = {};
    if (status) updateData.status = status;
    if (tracking_number) updateData.tracking_number = tracking_number;
    if (shipping_company) updateData.shipping_company = shipping_company;
    if (shipping_date) updateData.shipping_date = shipping_date;
    if (estimated_arrival) updateData.estimated_arrival = estimated_arrival;
    if (notes) updateData.notes = notes;
    if (callback_data) updateData.callback_data = callback_data;

    let query = supabase.from("deal_samples").update(updateData);

    if (sample_id) {
      query = query.eq("id", sample_id);
    } else {
      // تحديث آخر عينة لهذه الصفقة
      query = query.eq("deal_id", deal_id).order("created_at", { ascending: false }).limit(1);
    }

    const { error: updateError } = await query;
    if (updateError) throw updateError;

    // تحديث مرحلة الصفقة حسب الحالة
    const targetDealId = deal_id || sample_id;
    let resolvedDealId = deal_id;

    if (!resolvedDealId && sample_id) {
      const { data: sampleData } = await supabase
        .from("deal_samples")
        .select("deal_id")
        .eq("id", sample_id)
        .single();
      resolvedDealId = sampleData?.deal_id;
    }

    if (resolvedDealId) {
      let newPhase = "samples_requested";
      if (status === "shipped") newPhase = "samples_shipped";
      if (status === "delivered") newPhase = "samples_delivered";
      if (status === "approved") newPhase = "samples_approved";
      if (status === "rejected") newPhase = "samples_rejected";

      await supabase.from("deals").update({ current_phase: newPhase }).eq("id", resolvedDealId);

      // إشعار العميل
      const { data: deal } = await supabase
        .from("deals")
        .select("client_id, deal_number")
        .eq("id", resolvedDealId)
        .single();

      if (deal?.client_id) {
        const statusLabels: Record<string, string> = {
          shipped: "تم شحن العينة",
          delivered: "تم استلام العينة",
          approved: "تمت الموافقة على العينة",
          rejected: "تم رفض العينة",
        };

        await supabase.from("notifications").insert({
          user_id: deal.client_id,
          title: statusLabels[status] || "تحديث العينة",
          message: `تم تحديث حالة العينة لصفقتك رقم ${deal.deal_number}`,
          type: "sample_update",
          entity_type: "deal",
          entity_id: resolvedDealId,
        });
      }
    }

    console.log(`[Receive Sample Results] Updated sample for deal ${resolvedDealId}, status: ${status}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Receive Sample Results] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
