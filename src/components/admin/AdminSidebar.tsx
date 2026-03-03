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
  FileText,
  DollarSign,
  UserCheck,
  ChevronLeft,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import ResponsiveSidebar from "@/components/shared/ResponsiveSidebar";

const navItems = [
  { to: "/admin", icon: LayoutDashboard, label: "لوحة التحكم" },
  { to: "/admin/users", icon: Users, label: "المستخدمون" },
  { to: "/admin/deals", icon: Handshake, label: "الصفقات" },
  { to: "/admin/notifications", icon: Bell, label: "الإشعارات" },
  { to: "/admin/chat", icon: MessageSquare, label: "الدردشة" },
  { to: "/admin/contracts", icon: FileText, label: "لوحة العقود" },
  { to: "/admin/finance", icon: DollarSign, label: "المالية" },
  { to: "/admin/inspector-assign", icon: UserCheck, label: "المفتشون" },
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
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);

  // On mobile, never collapse — the drawer handles visibility
  const isCollapsed = !isMobile && collapsed;

  return (
    <ResponsiveSidebar>
      <motion.aside
        animate={{ width: isMobile ? "100%" : isCollapsed ? 80 : 260 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className={cn(
          "min-h-screen bg-card/50 backdrop-blur-xl border-l border-border/50 flex flex-col relative",
          isMobile && "min-h-0 border-l-0"
        )}
      >
        {/* Collapse toggle - desktop only */}
        {!isMobile && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="absolute -left-3 top-8 z-10 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-brand hover:shadow-brand-lg transition-all"
          >
            <ChevronLeft className={cn("w-3.5 h-3.5 transition-transform", isCollapsed && "rotate-180")} />
          </button>
        )}

        {/* Logo */}
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-gradient flex items-center justify-center shadow-brand flex-shrink-0">
              <span className="font-heading font-black text-white text-sm tracking-tight">EI</span>
            </div>
            <AnimatePresence>
              {!isCollapsed && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  className="overflow-hidden"
                >
                  <span className="font-heading text-lg font-bold text-gradient-brand whitespace-nowrap">EI</span>
                  <span className="block text-[10px] text-muted-foreground font-medium -mt-0.5">إدارة</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto scrollbar-thin">
          {navItems.map((item) => {
            const isActive =
              item.to === "/admin"
                ? location.pathname === "/admin"
                : location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to + item.label}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative",
                  isCollapsed && "justify-center px-0",
                  isActive
                    ? "bg-brand-gradient text-white shadow-brand"
                    : "text-muted-foreground hover:bg-primary/5 hover:text-foreground"
                )}
              >
                <item.icon className={cn("w-5 h-5 flex-shrink-0", isActive && "text-white")} />
                <AnimatePresence>
                  {!isCollapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {isCollapsed && (
                  <span className="absolute right-full mr-2 px-2 py-1 bg-foreground text-background text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                    {item.label}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border/50">
          <button
            onClick={signOut}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-all w-full",
              isCollapsed && "justify-center px-0"
            )}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <AnimatePresence>
              {!isCollapsed && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  تسجيل الخروج
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </motion.aside>
    </ResponsiveSidebar>
  );
};

export default AdminSidebar;
