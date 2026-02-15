import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FAKE_SHIPPING_TIMES = [
  "15-20 يوم عمل",
  "10-15 يوم عمل",
  "20-25 يوم عمل",
  "7-12 يوم عمل",
  "25-30 يوم عمل",
];

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

    // جلب بيانات الصفقة
    const { data: deal, error: dealError } = await supabase
      .from("deals")
      .select("*")
      .eq("id", deal_id)
      .single();

    if (dealError || !deal) throw new Error("Deal not found");

    console.log(`[Negotiation Phase2] Processing deal #${deal.deal_number}`);

    // جلب العروض المقبولة من المرحلة 1
    const { data: acceptedNegs, error: negsError } = await supabase
      .from("deal_negotiations")
      .select("*")
      .eq("deal_id", deal_id)
      .eq("status", "accepted")
      .eq("negotiation_phase", 1);

    if (negsError || !acceptedNegs || acceptedNegs.length === 0) {
      throw new Error("No accepted negotiations found for phase 2");
    }

    console.log(`[Negotiation Phase2] Found ${acceptedNegs.length} accepted offers`);

    const phase2Results = [];

    for (const neg of acceptedNegs) {
      const quantity = neg.requested_quantity || 100;
      const unit = neg.quantity_unit || "وحدة";
      const basePrice = neg.offered_price || 1000;
      
      // محاكاة: خصم بناءً على الكمية
      let discount = 0;
      if (quantity >= 500) discount = 0.15;
      else if (quantity >= 200) discount = 0.10;
      else if (quantity >= 100) discount = 0.05;
      
      const finalPrice = Math.round(basePrice * (1 - discount) * 100) / 100;
      const shippingTime = FAKE_SHIPPING_TIMES[Math.floor(Math.random() * FAKE_SHIPPING_TIMES.length)];

      const phase2Neg = {
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
        shipping_time: shippingTime,
        currency: neg.currency || "USD",
        negotiation_phase: 2,
        status: "responded",
        message_sent: `نرغب في طلب ${quantity} ${unit} من المنتج "${neg.product_name}". يرجى تأكيد السعر النهائي لكل ${unit} وفترة الشحن المتوقعة.`,
        factory_response: `شكراً لطلبكم. بناءً على الكمية المطلوبة (${quantity} ${unit})، السعر النهائي هو $${finalPrice} لكل ${unit}. فترة الشحن المتوقعة: ${shippingTime}.`,
        response_date: new Date().toISOString(),
      };

      phase2Results.push(phase2Neg);
    }

    // إدراج نتائج المرحلة 2
    const { error: insertError } = await supabase
      .from("deal_negotiations")
      .insert(phase2Results);

    if (insertError) {
      console.error("[Negotiation Phase2] Insert error:", insertError);
      throw new Error("Failed to save phase 2 negotiations: " + insertError.message);
    }

    // تحديث مرحلة الصفقة - تبقى في انتظار قرار المدير
    await supabase.from("deals").update({ current_phase: "negotiation_phase2_complete" }).eq("id", deal_id);

    // إشعار المدير فقط
    const adminContacts = await supabase.rpc("get_admin_contacts");
    const admins = adminContacts.data || [];

    for (const admin of admins) {
      await supabase.from("notifications").insert({
        user_id: admin.user_id,
        title: `نتائج التفاوض النهائي - صفقة #${deal.deal_number}`,
        message: `تم استلام ${phase2Results.length} رد(ود) نهائي من المصانع للصفقة #${deal.deal_number} بالأسعار النهائية والكميات. بانتظار قرارك.`,
        type: "negotiation_phase2_complete",
        entity_type: "deal",
        entity_id: deal_id,
      });
    }

    console.log(`[Negotiation Phase2] Completed deal #${deal.deal_number}: ${phase2Results.length} final offers`);

    return new Response(JSON.stringify({
      success: true,
      deal_number: deal.deal_number,
      total: phase2Results.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[Negotiation Phase2] Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
