import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, user_id, new_email, new_password, email, password, full_name } = await req.json();

    if (action === "create_admin") {
      // Create new admin user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });
      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const uid = newUser.user.id;
      // Remove default client role and add admin
      await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
      await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: "admin" });
      await supabaseAdmin.from("profiles").update({ is_active: true, status: "active" }).eq("user_id", uid);
      return new Response(JSON.stringify({ success: true, user_id: uid }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update existing user
    const updatePayload: Record<string, unknown> = {};
    if (new_email) updatePayload.email = new_email;
    if (new_password) updatePayload.password = new_password;
    updatePayload.email_confirm = true;

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(user_id, updatePayload);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update profile
    await supabaseAdmin.from("profiles").update({ email: new_email }).eq("user_id", user_id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
