import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Handshake, Archive, Bell, HelpCircle } from "lucide-react";

const statusMap: Record<string, string> = {
  active: "نشطة",
  delayed: "متأخرة",
  paused: "متوقفة",
  completed: "مكتملة",
  cancelled: "ملغاة",
};

const ClientDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ active: 0, archived: 0, notifications: 0, tickets: 0 });
  const [recentDeals, setRecentDeals] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const [dealsRes, notifRes, ticketsRes] = await Promise.all([
        supabase.from("deals").select("*").eq("client_id", user.id).order("updated_at", { ascending: false }),
        supabase.from("notifications").select("id", { count: "exact" }).eq("user_id", user.id).eq("is_read", false),
        supabase.from("support_tickets").select("id", { count: "exact" }).eq("user_id", user.id).in("status", ["open", "in_progress"]),
      ]);
      const deals = dealsRes.data || [];
      const active = deals.filter((d) => !["completed", "cancelled"].includes(d.status)).length;
      const archived = deals.filter((d) => ["completed", "cancelled"].includes(d.status)).length;
      setStats({
        active,
        archived,
        notifications: notifRes.count || 0,
        tickets: ticketsRes.count || 0,
      });
      setRecentDeals(deals.slice(0, 5));
    };
    fetch();
  }, [user]);

  const cards = [
    { label: "صفقات نشطة", value: stats.active, icon: Handshake, color: "text-primary" },
    { label: "في الأرشيف", value: stats.archived, icon: Archive, color: "text-muted-foreground" },
    { label: "إشعارات جديدة", value: stats.notifications, icon: Bell, color: "text-yellow-500" },
    { label: "تذاكر مفتوحة", value: stats.tickets, icon: HelpCircle, color: "text-blue-500" },
  ];

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">مرحباً بك</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-5 flex items-center gap-4">
              <c.icon className={`w-8 h-8 ${c.color}`} />
              <div>
                <p className="text-2xl font-heading font-bold">{c.value}</p>
                <p className="text-sm text-muted-foreground">{c.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="font-heading text-lg">آخر الصفقات</CardTitle></CardHeader>
        <CardContent>
          {recentDeals.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">لا توجد صفقات حتى الآن</p>
          ) : (
            <div className="space-y-3">
              {recentDeals.map((deal) => (
                <div key={deal.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-muted/30">
                  <div>
                    <p className="font-medium">{deal.title}</p>
                    <p className="text-xs text-muted-foreground font-mono">#{deal.deal_number}</p>
                  </div>
                  <Badge variant={deal.status === "active" ? "default" : deal.status === "delayed" ? "destructive" : "secondary"}>
                    {statusMap[deal.status] || deal.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientDashboard;
