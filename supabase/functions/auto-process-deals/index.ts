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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // أولاً: تشغيل وكيل التأهيل لفحص الصفقات قيد المراجعة
    try {
      console.log("[Auto-Process] Running qualification agent...");
      const qualifyRes = await fetch(`${supabaseUrl}/functions/v1/qualify-deals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${anonKey}`,
        },
      });
      const qualifyData = await qualifyRes.json();
      console.log("[Auto-Process] Qualification result:", JSON.stringify(qualifyData));
    } catch (qualifyError) {
      console.error("[Auto-Process] Qualification error:", qualifyError);
    }

    // قراءة الإعدادات: الفترة الزمنية
    const { data: settings, error: settingsError } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["auto_process_interval", "last_auto_process_time"]);

    if (settingsError) throw new Error("Failed to read settings");

    const settingsMap: Record<string, any> = {};
    for (const s of settings || []) {
      settingsMap[s.key] = s.value;
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

    // التحقق: هل هناك صفقة حالياً في انتظار نتائج البحث أو جاري التفاوض أو صياغة عقد؟
    const { count: searchingCount } = await supabase
      .from("deals")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .in("current_phase", ["searching_products", "contract_drafting"]);

    if ((searchingCount || 0) > 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: "هناك صفقة قيد المعالجة حالياً.",
        waiting_count: searchingCount,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // التحقق: هل هناك صفقات بحاجة لصياغة العقد؟
    const { data: readyForContract } = await supabase
      .from("deals")
      .select("*")
      .eq("status", "active")
      .in("current_phase", ["negotiation_phase3_complete", "contract_revision"])
      .order("created_at", { ascending: true })
      .limit(1);

    if (readyForContract && readyForContract.length > 0) {
      const cDeal = readyForContract[0];
      console.log(`[Auto-Process] Running contract drafting agent for deal #${cDeal.deal_number}`);
      
      // Update phase to drafting
      await supabase.from("deals").update({ current_phase: "contract_drafting" }).eq("id", cDeal.id);

      try {
        const cRes = await fetch(`${supabaseUrl}/functions/v1/draft-contract`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${anonKey}`,
          },
          body: JSON.stringify({ 
            deal_id: cDeal.id,
            admin_notes: cDeal.current_phase === "contract_revision" ? undefined : undefined,
          }),
        });
        const cData = await cRes.json();
        console.log(`[Auto-Process] Contract draft result:`, JSON.stringify(cData));
      } catch (cError) {
        console.error(`[Auto-Process] Contract draft error:`, cError);
      }

      await supabase.from("system_settings").upsert({
        key: "last_auto_process_time",
        value: { timestamp: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" });

      return new Response(JSON.stringify({ 
        success: true,
        deal_id: cDeal.id,
        message: `تم تشغيل وكيل صياغة العقود للصفقة #${cDeal.deal_number}`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // التحقق: هل هناك صفقات بحاجة لوكيل التفاوض المرحلة 3 (موافقة المصنع النهائية)؟
    const { data: readyForPhase3 } = await supabase
      .from("deals")
      .select("*")
      .eq("status", "active")
      .eq("current_phase", "negotiating_phase3")
      .order("created_at", { ascending: true })
      .limit(1);

    if (readyForPhase3 && readyForPhase3.length > 0) {
      const p3Deal = readyForPhase3[0];
      console.log(`[Auto-Process] Running negotiation phase 3 for deal #${p3Deal.deal_number}`);
      
      try {
        const p3Res = await fetch(`${supabaseUrl}/functions/v1/negotiate-deals-phase3`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${anonKey}`,
          },
          body: JSON.stringify({ deal_id: p3Deal.id }),
        });
        const p3Data = await p3Res.json();
        console.log(`[Auto-Process] Phase 3 result:`, JSON.stringify(p3Data));
      } catch (p3Error) {
        console.error(`[Auto-Process] Phase 3 error:`, p3Error);
      }

      await supabase.from("system_settings").upsert({
        key: "last_auto_process_time",
        value: { timestamp: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" });

      return new Response(JSON.stringify({ 
        success: true,
        deal_id: p3Deal.id,
        message: `تم تشغيل وكيل التفاوض المرحلة 3 للصفقة #${p3Deal.deal_number}`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // التحقق: هل هناك صفقات بحاجة لوكيل التفاوض المرحلة 2؟
    const { data: readyForPhase2 } = await supabase
      .from("deals")
      .select("*")
      .eq("status", "active")
      .eq("current_phase", "negotiating_phase2")
      .order("created_at", { ascending: true })
      .limit(1);

    if (readyForPhase2 && readyForPhase2.length > 0) {
      const p2Deal = readyForPhase2[0];
      console.log(`[Auto-Process] Running negotiation phase 2 for deal #${p2Deal.deal_number}`);
      
      try {
        const p2Res = await fetch(`${supabaseUrl}/functions/v1/negotiate-deals-phase2`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${anonKey}`,
          },
          body: JSON.stringify({ deal_id: p2Deal.id }),
        });
        const p2Data = await p2Res.json();
        console.log(`[Auto-Process] Phase 2 result:`, JSON.stringify(p2Data));
      } catch (p2Error) {
        console.error(`[Auto-Process] Phase 2 error:`, p2Error);
      }

      await supabase.from("system_settings").upsert({
        key: "last_auto_process_time",
        value: { timestamp: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" });

      return new Response(JSON.stringify({ 
        success: true,
        deal_id: p2Deal.id,
        message: `تم تشغيل وكيل التفاوض المرحلة 2 للصفقة #${p2Deal.deal_number}`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // التحقق: هل هناك صفقات أكملت التفاوض المرحلة 1 وتحتاج قبول تلقائي؟
    const { data: readyForAutoAccept } = await supabase
      .from("deals")
      .select("*")
      .eq("status", "active")
      .eq("current_phase", "negotiation_complete")
      .order("created_at", { ascending: true })
      .limit(1);

    if (readyForAutoAccept && readyForAutoAccept.length > 0) {
      const aaDeal = readyForAutoAccept[0];
      console.log(`[Auto-Process] Auto-accepting phase 1 negotiations for deal #${aaDeal.deal_number}`);

      // قبول العروض المستجابة تلقائياً وتحديد كميات افتراضية
      const { data: respondedNegs } = await supabase
        .from("deal_negotiations")
        .select("*")
        .eq("deal_id", aaDeal.id)
        .eq("negotiation_phase", 1)
        .eq("status", "responded");

      if (respondedNegs && respondedNegs.length > 0) {
        // قبول أول عرضين فقط (كما يفعل العميل)
        const toAccept = respondedNegs.slice(0, 2);
        for (const neg of toAccept) {
          await supabase.from("deal_negotiations").update({
            status: "accepted",
            requested_quantity: 100,
            quantity_unit: "وحدة",
          }).eq("id", neg.id);
        }
      }

      // تقدم المرحلة مباشرة
      await supabase.from("deals").update({ current_phase: "negotiating_phase2" }).eq("id", aaDeal.id);

      await supabase.from("system_settings").upsert({
        key: "last_auto_process_time",
        value: { timestamp: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" });

      return new Response(JSON.stringify({
        success: true,
        deal_id: aaDeal.id,
        message: `تم قبول العروض تلقائياً وتقدم الصفقة #${aaDeal.deal_number} للمرحلة 2`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // التحقق: هل هناك صفقات أكملت المرحلة 2 وتحتاج تقدم تلقائي للمرحلة 3؟
    const { data: readyForAutoP3 } = await supabase
      .from("deals")
      .select("*")
      .eq("status", "active")
      .eq("current_phase", "negotiation_phase2_complete")
      .order("created_at", { ascending: true })
      .limit(1);

    if (readyForAutoP3 && readyForAutoP3.length > 0) {
      const apDeal = readyForAutoP3[0];
      console.log(`[Auto-Process] Auto-advancing deal #${apDeal.deal_number} to phase 3`);

      await supabase.from("deals").update({ current_phase: "negotiating_phase3" }).eq("id", apDeal.id);

      await supabase.from("system_settings").upsert({
        key: "last_auto_process_time",
        value: { timestamp: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" });

      return new Response(JSON.stringify({
        success: true,
        deal_id: apDeal.id,
        message: `تم تقدم الصفقة #${apDeal.deal_number} تلقائياً للمرحلة 3`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // التحقق: هل هناك صفقات اختار العميل منتجاً فيها وجاهزة للتفاوض (product_selected)؟
    const { data: readyForNeg } = await supabase
      .from("deals")
      .select("*")
      .eq("status", "active")
      .eq("current_phase", "product_selected")
      .order("created_at", { ascending: true })
      .limit(1);

    if (readyForNeg && readyForNeg.length > 0) {
      const negDeal = readyForNeg[0];
      console.log(`[Auto-Process] Running negotiation agent for deal #${negDeal.deal_number}`);
      
      try {
        const negRes = await fetch(`${supabaseUrl}/functions/v1/negotiate-deals`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${anonKey}`,
          },
          body: JSON.stringify({ deal_id: negDeal.id }),
        });
        const negData = await negRes.json();
        console.log(`[Auto-Process] Negotiation result:`, JSON.stringify(negData));
      } catch (negError) {
        console.error(`[Auto-Process] Negotiation error:`, negError);
      }

      await supabase.from("system_settings").upsert({
        key: "last_auto_process_time",
        value: { timestamp: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" });

      return new Response(JSON.stringify({ 
        success: true,
        deal_id: negDeal.id,
        message: `تم تشغيل وكيل التفاوض للصفقة #${negDeal.deal_number}`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    console.log(`[Auto-Process] Running search agent for deal #${deal.deal_number}`);

    // استدعاء وكيل البحث عن المنتجات داخلياً
    try {
      const agentRes = await fetch(`${supabaseUrl}/functions/v1/search-products-agent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ deal_id: deal.id }),
      });

      const agentData = await agentRes.json();
      console.log(`[Auto-Process] Agent result for deal #${deal.deal_number}:`, JSON.stringify(agentData));

      if (!agentRes.ok) {
        console.error(`[Auto-Process] Agent failed:`, agentData);
      }
    } catch (agentError) {
      console.error(`[Auto-Process] Agent call error:`, agentError);
      // إرجاع المرحلة في حال فشل الاستدعاء
      await supabase.from("deals").update({ current_phase: "product_search" }).eq("id", deal.id);
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
