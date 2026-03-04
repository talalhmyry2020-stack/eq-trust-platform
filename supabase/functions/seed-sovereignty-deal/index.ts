import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find demo client
    const { data: clientProfile } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .eq("email", "demo-client@eq-platform.test")
      .maybeSingle();

    if (!clientProfile) {
      throw new Error("Demo client not found. Run seed-demo first.");
    }

    const clientId = clientProfile.user_id;
    const now = new Date();
    const timerStart = now.toISOString();
    const timerEnd = new Date(now.getTime() + 168 * 60 * 60 * 1000).toISOString(); // 168 hours

    // Create deal at sovereignty_timer phase
    const { data: deal, error: dealError } = await supabase
      .from("deals")
      .insert({
        client_id: clientId,
        client_full_name: clientProfile.full_name,
        title: "صفقة تجريبية — العداد السيادي",
        deal_type: "import",
        status: "active",
        current_phase: "sovereignty_timer",
        sovereignty_timer_start: timerStart,
        sovereignty_timer_end: timerEnd,
        estimated_amount: 25000,
        product_type: "إلكترونيات",
        product_description: "شاشات LED 55 بوصة",
        import_country: "السعودية",
        country: "الصين",
        shipping_tracking_url: "https://www.maersk.com/tracking/123456789",
        description: "صفقة تجريبية لاختبار العداد السيادي والاعتراض",
      })
      .select("id, deal_number")
      .single();

    if (dealError) throw dealError;

    // Create escrow record
    await supabase.from("deal_escrow").insert({
      deal_id: deal.id,
      total_deposited: 25000,
      total_released: 20000, // Token A (30%) + Token B (50%) already released
      balance: 5000, // Token C (20%) remaining
      currency: "USD",
      status: "active",
    });

    // Create token records
    const tokens = [
      { deal_id: deal.id, token_type: "token_a", amount: 7500, percentage: 30, status: "released", released_at: timerStart },
      { deal_id: deal.id, token_type: "token_b", amount: 12500, percentage: 50, status: "released", released_at: timerStart },
      { deal_id: deal.id, token_type: "token_c", amount: 5000, percentage: 20, status: "pending" },
    ];
    await supabase.from("deal_tokens").insert(tokens);

    // Send notification to client
    await supabase.from("notifications").insert({
      user_id: clientId,
      title: `صفقة تجريبية #${deal.deal_number} — العداد السيادي`,
      message: "تم إنشاء صفقة تجريبية في مرحلة العداد السيادي (168 ساعة). يمكنك اختبار الاعتراض أو إنهاء الصفقة.",
      type: "deal_update",
      entity_type: "deal",
      entity_id: deal.id,
    });

    return new Response(JSON.stringify({
      success: true,
      deal_id: deal.id,
      deal_number: deal.deal_number,
      sovereignty_timer_start: timerStart,
      sovereignty_timer_end: timerEnd,
      message: `تم إنشاء صفقة #${deal.deal_number} في مرحلة العداد السيادي بنجاح`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
