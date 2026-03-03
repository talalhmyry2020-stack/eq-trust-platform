import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Handshake, ScrollText, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import SuppliersSection from "@/components/admin/SuppliersSection";

const Dashboard = () => {
  const [stats, setStats] = useState({ clients: 0, employees: 0, deals: 0, logs: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      const [clientsRes, employeesRes, dealsRes, logsRes] = await Promise.all([
        supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "client"),
        supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "employee"),
        supabase.from("deals").select("id", { count: "exact", head: true }),
        supabase.from("activity_logs").select("id", { count: "exact", head: true }),
      ]);
      setStats({
        clients: clientsRes.count || 0,
        employees: employeesRes.count || 0,
        deals: dealsRes.count || 0,
        logs: logsRes.count || 0,
      });
    };
    fetchStats();
  }, []);

  const cards = [
    { title: "العملاء", value: stats.clients, icon: Users, gradient: "from-primary to-accent", shadow: "shadow-brand" },
    { title: "الموظفون", value: stats.employees, icon: Users, gradient: "from-accent to-ein-coral", shadow: "shadow-[0_8px_32px_hsl(262_60%_55%/0.2)]" },
    { title: "الصفقات", value: stats.deals, icon: Handshake, gradient: "from-ein-coral to-ein-warm", shadow: "shadow-[0_8px_32px_hsl(12_76%_61%/0.2)]" },
    { title: "سجل النشاط", value: stats.logs, icon: ScrollText, gradient: "from-ein-navy to-primary", shadow: "shadow-[0_8px_32px_hsl(220_55%_18%/0.2)]" },
  ];

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="font-heading text-3xl font-bold text-foreground">لوحة التحكم</h1>
        <p className="text-muted-foreground mt-1">مرحباً بك في مركز الإدارة</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className={`relative overflow-hidden border-0 ${card.shadow} hover:-translate-y-1 transition-all duration-300`}>
              <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-[0.07]`} />
              <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
                <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center`}>
                  <card.icon className="w-5 h-5 text-white" />
                </div>
              </CardHeader>
              <CardContent className="relative">
                <div className="text-4xl font-bold font-heading text-foreground">{card.value}</div>
                <div className="flex items-center gap-1 mt-2 text-xs text-primary">
                  <TrendingUp className="w-3 h-3" />
                  <span>نشط</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <SuppliersSection />
    </div>
  );
};

export default Dashboard;
