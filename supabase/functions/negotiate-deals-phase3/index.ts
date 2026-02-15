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

    const { data: deal, error: dealError } = await supabase
      .from("deals")
      .select("*")
      .eq("id", deal_id)
      .single();

    if (dealError || !deal) throw new Error("Deal not found");

    console.log(`[Negotiation Phase3] Processing deal #${deal.deal_number}`);

    // جلب عروض المرحلة 2 التي تم الرد عليها
    const { data: phase2Negs, error: negsError } = await supabase
      .from("deal_negotiations")
      .select("*")
      .eq("deal_id", deal_id)
      .eq("negotiation_phase", 2)
      .eq("status", "responded");

    if (negsError || !phase2Negs || phase2Negs.length === 0) {
      throw new Error("No phase 2 negotiations found");
    }

    console.log(`[Negotiation Phase3] Found ${phase2Negs.length} phase 2 offers`);

    const phase3Results = [];

    for (const neg of phase2Negs) {
      const quantity = neg.requested_quantity || 100;
      const unit = neg.quantity_unit || "وحدة";
      const finalPrice = neg.final_price || neg.offered_price || 1000;

      // المصنع يوافق نهائياً على السعر والكمية
      const phase3Neg = {
        deal_id,
        factory_name: neg.factory_name,
        factory_email: neg.factory_email,
        factory_phone: neg.factory_phone,
        factory_country: neg.factory_country,
        product_name: neg.product_name,
        product_image_url: neg.product_image_url,
        specifications: neg.specifications,
        offered_price: neg.offered_price,
        final_price: finalPrice,
        requested_quantity: quantity,
        quantity_unit: unit,
        shipping_time: neg.shipping_time,
        currency: neg.currency || "USD",
        negotiation_phase: 3,
        status: "accepted",
        message_sent: `نؤكد طلبنا لشراء ${quantity} ${unit} من المنتج "${neg.product_name}" بسعر $${finalPrice} لكل ${unit}. يرجى تأكيد الموافقة النهائية وتاريخ الشحن.`,
        factory_response: `تمت الموافقة النهائية على طلبكم. الكمية: ${quantity} ${unit} بسعر $${finalPrice} لكل ${unit}. سيتم بدء التجهيز والشحن خلال ${neg.shipping_time}. شكراً لثقتكم.`,
        response_date: new Date().toISOString(),
      };

      phase3Results.push(phase3Neg);
    }

    // إدراج نتائج المرحلة 3
    const { error: insertError } = await supabase
      .from("deal_negotiations")
      .insert(phase3Results);

    if (insertError) {
      console.error("[Negotiation Phase3] Insert error:", insertError);
      throw new Error("Failed to save phase 3 negotiations: " + insertError.message);
    }

    // تحديث مرحلة الصفقة
    await supabase.from("deals").update({ current_phase: "negotiation_phase3_complete" }).eq("id", deal_id);

    // إشعار المدير
    const adminContacts = await supabase.rpc("get_admin_contacts");
    const admins = adminContacts.data || [];

    for (const admin of admins) {
      await supabase.from("notifications").insert({
        user_id: admin.user_id,
        title: `موافقة المصانع النهائية - صفقة #${deal.deal_number}`,
        message: `وافقت ${phase3Results.length} مصنع(مصانع) نهائياً على الكمية والسعر للصفقة #${deal.deal_number}. الصفقة جاهزة للمرحلة التالية.`,
        type: "negotiation_phase3_complete",
        entity_type: "deal",
        entity_id: deal_id,
      });
    }

    console.log(`[Negotiation Phase3] Completed deal #${deal.deal_number}: ${phase3Results.length} factory acceptances`);

    return new Response(JSON.stringify({
      success: true,
      deal_number: deal.deal_number,
      total: phase3Results.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[Negotiation Phase3] Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
