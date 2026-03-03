import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const useRedirectIfAuthenticated = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setChecking(false);
      return;
    }

    const redirect = async () => {
      try {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        const userRoles = (roles || []).map((r) => r.role);

        if (userRoles.includes("admin")) {
          navigate("/admin", { replace: true });
        } else if (userRoles.includes("employee")) {
          const { data: empDetails } = await supabase
            .from("employee_details")
            .select("job_code")
            .eq("user_id", user.id)
            .single();

          const jobCode = empDetails?.job_code || "";
          if (jobCode === "logistics" || jobCode === "agent_07") navigate("/logistics", { replace: true });
          else if (jobCode === "customs_agent") navigate("/admin/port-clearance", { replace: true });
          else if (jobCode === "quality_agent") navigate("/quality", { replace: true });
          else if (jobCode === "agent_06") navigate("/inspector", { replace: true });
          else navigate("/inspector", { replace: true });
        } else {
          navigate("/client", { replace: true });
        }
      } catch {
        setChecking(false);
      }
    };

    redirect();
  }, [user, authLoading, navigate]);

  return { checking: authLoading || (!!user && checking) };
};
