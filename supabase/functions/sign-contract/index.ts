import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { action, contract_id, code } = await req.json();

    if (action === "send_code") {
      // Generate and send verification code for signing
      if (!contract_id) throw new Error("contract_id is required");

      const { data: contract, error } = await supabase
        .from("deal_contracts")
        .select("*, deals!deal_contracts_deal_id_fkey(client_id, deal_number, client_full_name)")
        .eq("id", contract_id)
        .single();

      if (error || !contract) throw new Error("Contract not found");
      if (contract.status !== "client_signing") throw new Error("Contract is not ready for signing");

      // Generate 6-digit code
      const signCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

      await supabase
        .from("deal_contracts")
        .update({
          signature_code: signCode,
          signature_code_expires_at: expiresAt,
        })
        .eq("id", contract_id);

      // Send code as notification to client
      const deal = contract.deals as any;
      await supabase.from("notifications").insert({
        user_id: deal.client_id,
        title: `رمز توقيع العقد - الصفقة #${deal.deal_number}`,
        message: `رمز التوقيع الإلكتروني الخاص بك هو: ${signCode}\n\nصالح لمدة 10 دقائق فقط. لا تشاركه مع أي شخص.`,
        type: "contract_sign_code",
        entity_type: "deal",
        entity_id: contract.deal_id,
      });

      return new Response(JSON.stringify({
        success: true,
        message: "تم إرسال رمز التوقيع إلى إشعاراتك",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify_and_sign") {
      if (!contract_id || !code) throw new Error("contract_id and code are required");

      const { data: contract, error } = await supabase
        .from("deal_contracts")
        .select("*, deals!deal_contracts_deal_id_fkey(client_id, deal_number)")
        .eq("id", contract_id)
        .single();

      if (error || !contract) throw new Error("Contract not found");
      if (contract.status !== "client_signing") throw new Error("Contract not ready for signing");
      if (!contract.signature_code) throw new Error("No code was sent");

      // Check expiration
      if (new Date() > new Date(contract.signature_code_expires_at)) {
        throw new Error("رمز التوقيع منتهي الصلاحية. اطلب رمزاً جديداً.");
      }

      // Verify code
      if (contract.signature_code !== code) {
        throw new Error("رمز التوقيع غير صحيح");
      }

      // Sign the contract
      const signedAt = new Date().toISOString();
      await supabase
        .from("deal_contracts")
        .update({
          client_signed: true,
          signed_at: signedAt,
          status: "signed",
          signature_code: null,
          signature_code_expires_at: null,
        })
        .eq("id", contract_id);

      // Update deal phase
      const deal = contract.deals as any;
      await supabase
        .from("deals")
        .update({ current_phase: "contract_signed" })
        .eq("id", contract.deal_id);

      // Notify admin
      const { data: admins } = await supabase.rpc("get_admin_contacts");
      for (const admin of admins || []) {
        await supabase.from("notifications").insert({
          user_id: admin.user_id,
          title: `تم توقيع العقد - الصفقة #${deal.deal_number}`,
          message: `قام العميل بتوقيع عقد الصفقة #${deal.deal_number} إلكترونياً.`,
          type: "contract_signed",
          entity_type: "deal",
          entity_id: contract.deal_id,
        });
      }

      // Notify client
      await supabase.from("notifications").insert({
        user_id: deal.client_id,
        title: `تم توقيع العقد بنجاح - الصفقة #${deal.deal_number}`,
        message: `تم توقيع عقد الصفقة #${deal.deal_number} بنجاح. سيتم إرسال نسخة العقد النهائية إليك.`,
        type: "contract_signed",
        entity_type: "deal",
        entity_id: contract.deal_id,
      });

      return new Response(JSON.stringify({
        success: true,
        message: "تم توقيع العقد بنجاح",
        signed_at: signedAt,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");

  } catch (error) {
    console.error("[Sign Contract] Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
