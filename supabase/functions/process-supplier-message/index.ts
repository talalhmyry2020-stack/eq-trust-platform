import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// كلمات مفتاحية تدل على اكتمال الإنتاج
const COMPLETION_KEYWORDS = [
  "تم اكتمال الإنتاج",
  "اكتمل الإنتاج",
  "الإنتاج جاهز",
  "البضاعة جاهزة",
  "تم الانتهاء من الإنتاج",
  "الطلبية جاهزة",
  "production completed",
  "production complete",
  "order ready",
  "goods ready",
  "manufacturing done",
  "finished production",
  "ready for shipment",
  "ready to ship",
  "production finished",
  "الشحنة جاهزة",
  "جاهز للشحن",
  "تم التصنيع",
  "انتهى التصنيع",
];

function detectCompletion(message: string): { isCompletion: boolean; confidence: number } {
  const lower = message.toLowerCase().trim();
  
  let matchCount = 0;
  for (const keyword of COMPLETION_KEYWORDS) {
    if (lower.includes(keyword.toLowerCase())) {
      matchCount++;
    }
  }

  if (matchCount === 0) {
    return { isCompletion: false, confidence: 0 };
  }

  // Confidence based on match count
  const confidence = Math.min(matchCount * 40 + 20, 100);
  return { isCompletion: true, confidence };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { deal_id, message, factory_name, is_test } = body;

    if (!deal_id || !message) throw new Error("deal_id and message are required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // تحليل الرسالة
    const { isCompletion, confidence } = detectCompletion(message);

    // تسجيل الرسالة
    const { data: savedMsg } = await supabase.from("supplier_messages").insert({
      deal_id,
      factory_name: factory_name || "",
      sender_type: is_test ? "system" : "factory",
      message,
      is_completion_signal: isCompletion,
      detection_confidence: confidence,
      auto_action_taken: isCompletion ? "factory_completed" : null,
    }).select().single();

    let actionResult: any = null;

    if (isCompletion) {
      // تفعيل إجراء اكتمال الإنتاج تلقائياً
      const postInspectionUrl = `${supabaseUrl}/functions/v1/process-post-inspection`;
      const res = await fetch(postInspectionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ deal_id, action: "factory_completed" }),
      });
      actionResult = await res.json();

      // إشعار المدير
      const { data: admins } = await supabase.rpc("get_admin_contacts");
      const { data: deal } = await supabase.from("deals").select("deal_number").eq("id", deal_id).single();
      
      for (const admin of admins || []) {
        await supabase.from("notifications").insert({
          user_id: admin.user_id,
          title: `📩 رسالة مورد — اكتمال إنتاج مكتشف${is_test ? " 🧪" : ""}`,
          message: `الصفقة #${deal?.deal_number}: المورد أرسل "${message.substring(0, 80)}". الثقة: ${confidence}%. تم تفعيل إجراء اكتمال الإنتاج تلقائياً.`,
          type: "supplier_message",
          entity_type: "deal",
          entity_id: deal_id,
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message_id: savedMsg?.id,
      is_completion_signal: isCompletion,
      confidence,
      auto_action: isCompletion ? "factory_completed" : null,
      action_result: actionResult,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Supplier message error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
