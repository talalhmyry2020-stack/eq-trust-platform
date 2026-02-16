import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  MapPin,
  Camera,
  Eye,
  CloudUpload,
  LogOut,
  Shield,
  Settings,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/inspector", icon: LayoutDashboard, label: "لوحة التحكم" },
  { to: "/inspector/briefing", icon: FileText, label: "المسطرة الرقمية" },
  { to: "/inspector/geofence", icon: MapPin, label: "القفل الجغرافي" },
  { to: "/inspector/capture", icon: Camera, label: "التوثيق المقيد" },
  { to: "/inspector/mission", icon: Camera, label: "مهام الفحص" },
  { to: "/inspector/validate", icon: Eye, label: "المطابقة البصرية" },
  { to: "/inspector/reports", icon: CloudUpload, label: "التقارير" },
  { to: "/inspector/settings", icon: Settings, label: "الإعدادات" },
];

const InspectorSidebar = () => {
  const { signOut } = useAuth();
  const location = useLocation();

  return (
    <aside className="w-64 min-h-screen bg-card border-l border-border flex flex-col">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-primary" />
          <div>
            <h1 className="font-heading text-lg font-bold text-primary">الوكيل 06</h1>
            <p className="text-xs text-muted-foreground">المفتش الميداني</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.to === "/inspector"
              ? location.pathname === "/inspector"
              : location.pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors w-full"
        >
          <LogOut className="w-5 h-5" />
          تسجيل الخروج
        </button>
      </div>
    </aside>
  );
};

export default InspectorSidebar;
