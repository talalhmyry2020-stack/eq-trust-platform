import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Handshake, Archive, ScrollText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
    { title: "العملاء", value: stats.clients, icon: Users, color: "text-eq-blue" },
    { title: "الموظفون", value: stats.employees, icon: Users, color: "text-eq-green" },
    { title: "الصفقات", value: stats.deals, icon: Handshake, color: "text-primary" },
    { title: "سجل النشاط", value: stats.logs, icon: ScrollText, color: "text-muted-foreground" },
  ];

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">لوحة التحكم</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-heading">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
