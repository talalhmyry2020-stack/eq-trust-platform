import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminSidebar from "./AdminSidebar";

const AdminLayout = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isEmployee, loading: roleLoading } = useRole();
  const location = useLocation();
  const [jobCode, setJobCode] = useState<string | null>(null);
  const [jobLoading, setJobLoading] = useState(true);

  useEffect(() => {
    if (!user || !isEmployee || isAdmin) {
      setJobLoading(false);
      return;
    }
    const fetchJob = async () => {
      const { data } = await supabase
        .from("employee_details")
        .select("job_code")
        .eq("user_id", user.id)
        .single();
      setJobCode(data?.job_code || "");
      setJobLoading(false);
    };
    fetchJob();
  }, [user, isEmployee, isAdmin]);

  if (authLoading || roleLoading || jobLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center bg-mesh">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand-gradient flex items-center justify-center shadow-brand animate-pulse">
            <span className="font-heading font-bold text-white text-lg">E</span>
          </div>
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!user || (!isAdmin && !isEmployee)) {
    return <Navigate to="/auth" replace />;
  }

  if (isEmployee && !isAdmin) {
    const path = location.pathname;
    const isLogistics = jobCode === "logistics" || jobCode === "agent_07";
    const isCustoms = jobCode === "customs_agent";
    const isQuality = jobCode === "quality_agent";
    if (isLogistics) return <Navigate to="/logistics" replace />;
    if (isQuality) return <Navigate to="/quality" replace />;
    if (isCustoms && !path.startsWith("/admin/port-clearance")) return <Navigate to="/admin/port-clearance" replace />;
    if (!isLogistics && !isCustoms && !isQuality) return <Navigate to="/inspector" replace />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-row-reverse bg-mesh">
      <AdminSidebar />
      <main className="flex-1 p-4 md:p-8 overflow-auto pt-16 md:pt-8">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
