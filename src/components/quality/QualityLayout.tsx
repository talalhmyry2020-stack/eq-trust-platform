import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import QualitySidebar from "./QualitySidebar";

const QualityLayout = () => {
  const { user, loading: authLoading } = useAuth();
  const { isEmployee, loading: roleLoading } = useRole();
  const [jobCode, setJobCode] = useState<string | null>(null);
  const [jobLoading, setJobLoading] = useState(true);

  useEffect(() => {
    if (!user || !isEmployee) {
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
  }, [user, isEmployee]);

  if (authLoading || roleLoading || jobLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  if (!user || !isEmployee || jobCode !== "quality_agent") {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen flex w-full" dir="rtl">
      <QualitySidebar />
      <main className="flex-1 p-6 bg-background overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default QualityLayout;
