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

    const accounts = [
      {
        email: "demo-admin@eq-platform.test",
        password: "DemoAdmin2024!",
        full_name: "أحمد المدير (تجريبي)",
        role: "admin" as const,
        label: "مدير",
      },
      {
        email: "demo-client@eq-platform.test",
        password: "DemoClient2024!",
        full_name: "خالد العميل (تجريبي)",
        role: "client" as const,
        label: "عميل",
      },
      {
        email: "demo-inspector@eq-platform.test",
        password: "DemoInspector2024!",
        full_name: "سعيد المفتش (تجريبي)",
        role: "employee" as const,
        label: "مفتش ميداني",
        job_code: "agent_06",
        job_title: "مفتش ميداني",
      },
      {
        email: "demo-logistics@eq-platform.test",
        password: "DemoLogistics2024!",
        full_name: "عمر اللوجستي (تجريبي)",
        role: "employee" as const,
        label: "موظف لوجستيك",
        job_code: "agent_07",
        job_title: "موظف لوجستيك",
      },
      {
        email: "demo-quality@eq-platform.test",
        password: "DemoQuality2024!",
        full_name: "ياسر الجودة (تجريبي)",
        role: "employee" as const,
        label: "وكيل جودة",
        job_code: "quality_agent",
        job_title: "وكيل جودة",
      },
    ];

    const results = [];

    for (const acc of accounts) {
      // Check if already exists
      const { data: existing } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", acc.email)
        .maybeSingle();

      if (existing) {
        results.push({ ...acc, status: "exists", user_id: existing.user_id });
        continue;
      }

      // Create user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: acc.email,
        password: acc.password,
        email_confirm: true,
        user_metadata: { full_name: acc.full_name },
      });

      if (createError) {
        // If user exists in auth but not in profiles
        if (createError.message.includes("already been registered")) {
          results.push({ ...acc, status: "exists_auth" });
          continue;
        }
        results.push({ ...acc, status: "error", error: createError.message });
        continue;
      }

      const userId = newUser.user.id;

      // Set role
      await supabase.from("user_roles").delete().eq("user_id", userId);
      await supabase.from("user_roles").insert({ user_id: userId, role: acc.role });

      // Activate profile
      await supabase
        .from("profiles")
        .update({ is_active: true, status: "active" })
        .eq("user_id", userId);

      // Employee details
      if (acc.role === "employee" && "job_code" in acc) {
        await supabase.from("employee_details").insert({
          user_id: userId,
          job_code: acc.job_code,
          job_title: acc.job_title,
          country: acc.job_code === "agent_07" ? "الصين" : "",
        });

        // Permissions for inspector
        if (acc.job_code === "agent_06") {
          const perms = ["receive_briefing", "geo_checkin", "capture_evidence", "visual_validation", "submit_report"];
          await supabase.from("employee_permissions").insert(
            perms.map(p => ({ user_id: userId, permission: p }))
          );
        }
        if (acc.job_code === "agent_07" || acc.job_code === "quality_agent") {
          const perms = ["view_deals", "manage_deals"];
          await supabase.from("employee_permissions").insert(
            perms.map(p => ({ user_id: userId, permission: p }))
          );
        }
      }

      results.push({ ...acc, status: "created", user_id: userId });
    }

    return new Response(JSON.stringify({ success: true, accounts: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
