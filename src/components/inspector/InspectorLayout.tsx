import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import InspectorSidebar from "./InspectorSidebar";

const InspectorLayout = () => {
  const { user, loading: authLoading } = useAuth();
  const { isEmployee, loading: roleLoading } = useRole();

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mesh">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user || !isEmployee) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen flex w-full bg-mesh" dir="rtl">
      <InspectorSidebar />
      <main className="flex-1 p-6 bg-background/50 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default InspectorLayout;
