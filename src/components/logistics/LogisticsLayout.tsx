import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import LogisticsSidebar from "./LogisticsSidebar";

const LogisticsLayout = () => {
  const { user, loading: authLoading } = useAuth();
  const { isEmployee, loading: roleLoading } = useRole();
  const [jobCode, setJobCode] = useState<string | null>(null);
  const [jobLoading, setJobLoading] = useState(true);

  useEffect(() => {
    if (!user) { setJobLoading(false); return; }
    if (!isEmployee) { return; }
    setJobLoading(true);
    const fetchJob = async () => {
      const { data } = await supabase.from("employee_details").select("job_code").eq("user_id", user.id).single();
      setJobCode(data?.job_code || "");
      setJobLoading(false);
    };
    fetchJob();
  }, [user, isEmployee]);

  if (authLoading || roleLoading || jobLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mesh">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    );
  }

  if (!user || !isEmployee) return <Navigate to="/auth" replace />;
  if (jobCode !== "agent_07" && jobCode !== "logistics") return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen flex w-full bg-mesh" dir="rtl">
      <LogisticsSidebar />
      <main className="flex-1 p-4 md:p-6 bg-background/50 overflow-auto pt-16 md:pt-6">
        <Outlet />
      </main>
    </div>
  );
};

export default LogisticsLayout;
