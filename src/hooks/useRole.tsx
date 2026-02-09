import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type AppRole = "admin" | "employee" | "client";

export const useRole = () => {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRoles([]);
      setLoading(false);
      return;
    }

    const fetchRoles = async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      
      setRoles((data || []).map((r) => r.role as AppRole));
      setLoading(false);
    };

    fetchRoles();
  }, [user]);

  const isAdmin = roles.includes("admin");
  const isEmployee = roles.includes("employee");
  const isClient = roles.includes("client");

  return { roles, isAdmin, isEmployee, isClient, loading };
};
