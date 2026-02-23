import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Camera,
  CloudUpload,
  LogOut,
  ShieldCheck,
  Settings,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/quality", icon: LayoutDashboard, label: "لوحة التحكم" },
  { to: "/quality/mission", icon: Camera, label: "مهام الفحص" },
  { to: "/quality/reports", icon: CloudUpload, label: "التقارير" },
  { to: "/quality/settings", icon: Settings, label: "الإعدادات" },
];

const QualitySidebar = () => {
  const { signOut } = useAuth();
  const location = useLocation();

  return (
    <aside className="w-64 min-h-screen bg-card border-l border-border flex flex-col">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-emerald-600" />
          <div>
            <h1 className="font-heading text-lg font-bold text-emerald-600">وكيل الجودة</h1>
            <p className="text-xs text-muted-foreground">درع الحماية ضد التلاعب</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.to === "/quality"
              ? location.pathname === "/quality"
              : location.pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-emerald-500/10 text-emerald-600"
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

export default QualitySidebar;
