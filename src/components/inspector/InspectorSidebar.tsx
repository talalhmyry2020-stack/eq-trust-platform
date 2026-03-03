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
    <aside className="w-64 min-h-screen bg-card/50 backdrop-blur-xl border-l border-border/50 flex flex-col">
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand-gradient flex items-center justify-center shadow-brand">
            <span className="font-heading font-black text-white text-sm tracking-tight">EI</span>
          </div>
          <div>
            <span className="font-heading text-lg font-bold text-gradient-brand">EI N</span>
            <span className="block text-[10px] text-muted-foreground font-medium -mt-0.5">المفتش الميداني</span>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5">
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
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-brand-gradient text-white shadow-brand"
                  : "text-muted-foreground hover:bg-primary/5 hover:text-foreground"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border/50">
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-all w-full"
        >
          <LogOut className="w-5 h-5" />
          تسجيل الخروج
        </button>
      </div>
    </aside>
  );
};

export default InspectorSidebar;
