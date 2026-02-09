import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, code } = await req.json();

    if (!email || !code) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing email or code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Find matching code
    const { data, error } = await supabaseAdmin
      .from('verification_codes')
      .select('*')
      .eq('email', email)
      .eq('code', code)
      .eq('verified', false)
      .gte('expires_at', new Date().toISOString())
      .maybeSingle();

    if (error || !data) {
      return new Response(
        JSON.stringify({ success: false, error: 'رمز التحقق غير صحيح أو منتهي الصلاحية' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark as verified
    await supabaseAdmin
      .from('verification_codes')
      .update({ verified: true })
      .eq('id', data.id);

    // Find user and confirm email + activate profile
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    const user = users?.users?.find((u) => u.email === email);
    if (user) {
      // Confirm email so user can login without Supabase email confirmation
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        email_confirm: true,
      });

      // Activate profile
      await supabaseAdmin
        .from('profiles')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);

      // Send webhook to n8n for post-verification event
      const N8N_VERIFIED_WEBHOOK_URL = Deno.env.get('N8N_VERIFIED_WEBHOOK_URL');
      if (N8N_VERIFIED_WEBHOOK_URL) {
        try {
          await fetch(N8N_VERIFIED_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email,
              user_id: user.id,
              full_name: user.user_metadata?.full_name || '',
              action: 'email_verified',
              timestamp: new Date().toISOString(),
            }),
          });
        } catch (webhookErr) {
          console.error('Post-verification webhook error:', webhookErr);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error verifying code:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
