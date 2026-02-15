import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Handshake,
  Archive,
  ScrollText,
  Settings,
  Shield,
  LogOut,
  Search,
  Bell,
  MessageSquare,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/admin", icon: LayoutDashboard, label: "لوحة التحكم" },
  { to: "/admin/users", icon: Users, label: "المستخدمون" },
  { to: "/admin/deals", icon: Handshake, label: "الصفقات" },
  { to: "/admin/notifications", icon: Bell, label: "الإشعارات" },
  { to: "/admin/chat", icon: MessageSquare, label: "الدردشة" },
  { to: "/admin/archive", icon: Archive, label: "الأرشيف" },
  { to: "/admin/product-search", icon: Search, label: "نتائج البحث" },
  { to: "/admin/factory-search", icon: Search, label: "بحث المصانع" },
  { to: "/admin/logs", icon: ScrollText, label: "السجلات" },
  { to: "/admin/sensitive", icon: Shield, label: "بيانات حساسة" },
  { to: "/admin/settings", icon: Settings, label: "الإعدادات" },
];

const AdminSidebar = () => {
  const { signOut } = useAuth();
  const location = useLocation();

  return (
    <aside className="w-64 min-h-screen bg-card border-l border-border flex flex-col">
      <div className="p-6 border-b border-border">
        <h1 className="font-heading text-xl font-bold text-gradient-gold">
          لوحة الإدارة
        </h1>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.to === "/admin"
              ? location.pathname === "/admin"
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

export default AdminSidebar;
