import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Truck,
  Package,
  Ship,
  Anchor,
  FileText,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/logistics", icon: LayoutDashboard, label: "لوحة التحكم" },
  { to: "/logistics/shipments", icon: Package, label: "الشحنات النشطة" },
];

const LogisticsSidebar = () => {
  const { signOut } = useAuth();
  const location = useLocation();

  return (
    <aside className="w-64 min-h-screen bg-card border-l border-border flex flex-col">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
            <Truck className="w-5 h-5 text-purple-500" />
          </div>
          <div>
            <h1 className="font-heading text-lg font-bold text-purple-600">موظف اللوجستيك</h1>
            <p className="text-xs text-muted-foreground">إدارة الشحنات والتوثيق</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.to === "/logistics"
              ? location.pathname === "/logistics"
              : location.pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-purple-500/10 text-purple-600"
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

export default LogisticsSidebar;
