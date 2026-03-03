import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin");

    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all auth users
    const { data: { users: allUsers } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const usersToDelete = (allUsers || []).filter(u => u.id !== caller.id);

    let deleted = 0;
    const errors: string[] = [];

    for (const u of usersToDelete) {
      try {
        await supabaseAdmin.from("deal_deposits").delete().eq("client_id", u.id);
        await supabaseAdmin.from("deal_objections").delete().eq("client_id", u.id);
        await supabaseAdmin.from("employee_permissions").delete().eq("user_id", u.id);
        await supabaseAdmin.from("employee_details").delete().eq("user_id", u.id);
        await supabaseAdmin.from("employee_client_assignments").delete().eq("employee_id", u.id);
        await supabaseAdmin.from("employee_client_assignments").delete().eq("client_id", u.id);
        await supabaseAdmin.from("notifications").delete().eq("user_id", u.id);
        await supabaseAdmin.from("direct_messages").delete().eq("sender_id", u.id);
        await supabaseAdmin.from("direct_messages").delete().eq("receiver_id", u.id);
        await supabaseAdmin.from("user_roles").delete().eq("user_id", u.id);
        await supabaseAdmin.from("profiles").delete().eq("user_id", u.id);
        await supabaseAdmin.auth.admin.deleteUser(u.id);
        deleted++;
      } catch (e) {
        errors.push(`${u.email}: ${(e as Error).message}`);
      }
    }

    return new Response(JSON.stringify({ success: true, deleted, total: usersToDelete.length, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
