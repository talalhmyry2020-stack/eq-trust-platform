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

    // قراءة الإعدادات: رابط الـ Webhook + الفترة الزمنية
    const { data: settings, error: settingsError } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["phase1_webhook_url", "auto_process_interval", "last_auto_process_time"]);

    if (settingsError) throw new Error("Failed to read settings");

    const settingsMap: Record<string, any> = {};
    for (const s of settings || []) {
      settingsMap[s.key] = s.value;
    }

    const webhookUrl = settingsMap["phase1_webhook_url"]?.url;
    if (!webhookUrl) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "رابط Webhook غير مُعد في الإعدادات" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const intervalMinutes = settingsMap["auto_process_interval"]?.minutes || 5;
    const lastProcessTime = settingsMap["last_auto_process_time"]?.timestamp;

    // التحقق من الفترة الزمنية - هل مضى وقت كافٍ منذ آخر إرسال؟
    if (lastProcessTime) {
      const elapsed = (Date.now() - new Date(lastProcessTime).getTime()) / 60000;
      if (elapsed < intervalMinutes) {
        return new Response(JSON.stringify({ 
          success: true, 
          message: `لم يحن وقت الإرسال بعد. المتبقي: ${Math.ceil(intervalMinutes - elapsed)} دقيقة`,
          next_in_minutes: Math.ceil(intervalMinutes - elapsed),
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // جلب أقدم صفقة مقبولة في انتظار البحث (صفقة واحدة فقط)
    const { data: deals, error: dealsError } = await supabase
      .from("deals")
      .select("*")
      .eq("status", "active")
      .eq("current_phase", "product_search")
      .order("created_at", { ascending: true })
      .limit(1);

    if (dealsError) throw new Error("Failed to fetch deals: " + dealsError.message);

    if (!deals || deals.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: "لا توجد صفقات تحتاج معالجة",
        processed: 0 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const deal = deals[0];

    // تحديث المرحلة فوراً لمنع التكرار
    await supabase.from("deals").update({ 
      current_phase: "searching_products" 
    }).eq("id", deal.id);

    // إعداد رابط موقّع لصورة المنتج
    let productImageSignedUrl: string | null = null;
    if (deal.product_image_url) {
      const { data: signedData } = await supabase.storage
        .from("deal-documents")
        .createSignedUrl(deal.product_image_url, 3600);
      productImageSignedUrl = signedData?.signedUrl || null;
    }

    const payload = {
      deal_id: deal.id,
      deal_number: deal.deal_number,
      product_type: deal.product_type,
      product_description: deal.product_description,
      import_country: deal.import_country,
      product_image_signed_url: productImageSignedUrl,
      callback_url: `${supabaseUrl}/functions/v1/receive-search-results`,
    };

    console.log(`[Auto-Process] Sending deal #${deal.deal_number} to webhook`);

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    console.log(`[Auto-Process] Deal #${deal.deal_number} response: ${response.status}`);

    if (!response.ok) {
      // إرجاع المرحلة في حال فشل الإرسال
      await supabase.from("deals").update({ 
        current_phase: "product_search" 
      }).eq("id", deal.id);

      throw new Error(`Webhook returned ${response.status}`);
    }

    // تسجيل وقت آخر إرسال
    await supabase.from("system_settings").upsert({
      key: "last_auto_process_time",
      value: { timestamp: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    }, { onConflict: "key" });

    return new Response(JSON.stringify({ 
      success: true,
      deal_id: deal.id,
      deal_number: deal.deal_number,
      message: `تم إرسال الصفقة #${deal.deal_number} بنجاح`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[Auto-Process] Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
