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
    const { deal_id, columns, rows } = body;

    if (!deal_id) throw new Error("deal_id is required");
    if (!columns || !Array.isArray(columns) || columns.length === 0) {
      throw new Error("columns array is required (e.g. ['اسم الشركة', 'البريد الإلكتروني', 'رقم التواصل'])");
    }
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      throw new Error("rows array is required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // التحقق من وجود الصفقة
    const { data: deal, error: dealError } = await supabase
      .from("deals")
      .select("id, deal_number, client_id")
      .eq("id", deal_id)
      .single();

    if (dealError || !deal) throw new Error("Deal not found");

    console.log(`[Receive Results] Processing ${rows.length} rows with ${columns.length} columns for deal ${deal.deal_number}`);

    // حذف الأعمدة والصفوف القديمة لهذه الصفقة (تحديث كامل)
    await supabase.from("deal_search_rows").delete().eq("deal_id", deal_id);
    await supabase.from("deal_search_columns").delete().eq("deal_id", deal_id);

    // إنشاء الأعمدة الجديدة
    const columnInserts = columns.map((colName: string, index: number) => ({
      deal_id,
      column_name: colName,
      column_order: index,
    }));

    const { error: colError } = await supabase
      .from("deal_search_columns")
      .insert(columnInserts);

    if (colError) {
      console.error("[Receive Results] Column insert error:", colError);
      throw new Error("Failed to save columns");
    }

    // إنشاء الصفوف - كل صف هو كائن JSONB يحتوي على البيانات
    const rowInserts = rows.map((rowData: any, index: number) => {
      // إذا كان الصف مصفوفة، نحولها لكائن باستخدام أسماء الأعمدة
      let data: Record<string, any> = {};
      if (Array.isArray(rowData)) {
        columns.forEach((col: string, i: number) => {
          data[col] = rowData[i] ?? "";
        });
      } else {
        data = rowData;
      }

      return {
        deal_id,
        row_order: index,
        row_data: data,
      };
    });

    const { error: rowError } = await supabase
      .from("deal_search_rows")
      .insert(rowInserts);

    if (rowError) {
      console.error("[Receive Results] Row insert error:", rowError);
      throw new Error("Failed to save rows");
    }

    // تحديث مرحلة الصفقة
    await supabase.from("deals").update({ 
      current_phase: "results_ready" 
    }).eq("id", deal_id);

    // إرسال إشعار للعميل
    if (deal.client_id) {
      await supabase.from("notifications").insert({
        user_id: deal.client_id,
        title: "نتائج البحث جاهزة",
        message: `تم العثور على ${rows.length} نتيجة بحث لصفقتك رقم ${deal.deal_number}`,
        type: "product_results",
        entity_type: "deal",
        entity_id: deal_id,
      });
    }

    console.log(`[Receive Results] Successfully saved ${rows.length} rows for deal ${deal.deal_number}`);

    return new Response(JSON.stringify({ 
      success: true,
      columns_count: columns.length,
      rows_count: rows.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[Receive Results] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
