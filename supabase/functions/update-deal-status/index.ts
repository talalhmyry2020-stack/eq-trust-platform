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
    const { deal_id, status, products } = body;

    if (!deal_id) throw new Error("deal_id is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // التحقق من وجود الصفقة
    const { data: deal, error: dealError } = await supabase
      .from("deals")
      .select("id, status, client_id, current_phase")
      .eq("id", deal_id)
      .single();

    if (dealError || !deal) {
      throw new Error("Deal not found");
    }

    // إذا أرسل n8n حالة الصفقة (نتيجة التحقق من المرحلة الأولى)
    if (status) {
      const validStatuses = ["active", "cancelled", "delayed", "paused", "pending_review"];
      if (!validStatuses.includes(status)) {
        throw new Error("Invalid status: " + status);
      }

      const updateData: any = { status };
      
      // إذا تم تفعيل الصفقة، ننقلها للمرحلة التالية (مقبولة - بانتظار الإرسال التلقائي)
      if (status === "active") {
        updateData.current_phase = "product_search";
      }

      await supabase.from("deals").update(updateData).eq("id", deal_id);

      // إرسال إشعار للعميل
      if (deal.client_id) {
        const statusLabels: Record<string, string> = {
          active: "تمت الموافقة على صفقتك وتم تفعيلها",
          cancelled: "تم رفض صفقتك",
          delayed: "صفقتك تحتاج مراجعة إضافية",
        };
        
        await supabase.from("notifications").insert({
          user_id: deal.client_id,
          title: "تحديث حالة الصفقة",
          message: statusLabels[status] || `تم تحديث حالة صفقتك إلى ${status}`,
          type: "deal_update",
          entity_type: "deal",
          entity_id: deal_id,
        });
      }

      console.log(`Deal ${deal_id} status updated to ${status}`);
    }

    // إذا أرسل n8n نتائج البحث عن المنتجات (المرحلة الثانية)
    if (products && Array.isArray(products) && products.length > 0) {
      const productRows = products.map((p: any) => ({
        deal_id,
        product_name: p.name || p.product_name || "منتج",
        product_image_url: p.image_url || p.image || null,
        price: p.price || null,
        currency: p.currency || "USD",
        specifications: p.specifications || p.specs || {},
        quality_rating: p.quality || p.rating || null,
      }));

      const { error: insertError } = await supabase
        .from("deal_product_results")
        .insert(productRows);

      if (insertError) {
        console.error("Error inserting products:", insertError);
        throw new Error("Failed to save product results");
      }

      // تحديث مرحلة الصفقة
      await supabase.from("deals").update({ 
        current_phase: "product_selection" 
      }).eq("id", deal_id);

      // إشعار العميل بوصول النتائج
      if (deal.client_id) {
        await supabase.from("notifications").insert({
          user_id: deal.client_id,
          title: "نتائج البحث جاهزة",
          message: `تم العثور على ${products.length} منتج(ات) مطابقة لطلبك. يرجى اختيار المنتج المناسب.`,
          type: "product_results",
          entity_type: "deal",
          entity_id: deal_id,
        });
      }

      console.log(`Added ${products.length} product results for deal ${deal_id}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Update deal error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
