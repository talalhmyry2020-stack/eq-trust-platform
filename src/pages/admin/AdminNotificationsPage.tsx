import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCircle, XCircle, AlertTriangle, MessageSquare } from "lucide-react";

const typeConfig: Record<string, { icon: any; label: string; color: string }> = {
  deal_update: { icon: CheckCircle, label: "تحديث صفقة", color: "text-green-500" },
  deal_rejected: { icon: XCircle, label: "صفقة مرفوضة", color: "text-destructive" },
  deal_approved: { icon: CheckCircle, label: "صفقة مقبولة", color: "text-green-500" },
  delay: { icon: AlertTriangle, label: "تأخير", color: "text-yellow-500" },
  admin_message: { icon: MessageSquare, label: "رسالة", color: "text-blue-500" },
  info: { icon: Bell, label: "إشعار", color: "text-muted-foreground" },
};

const AdminNotificationsPage = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setNotifications(data || []));
  }, [user]);

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl font-bold">الإشعارات</h1>
        {unreadCount > 0 && <Badge variant="destructive">{unreadCount} غير مقروء</Badge>}
      </div>
      {notifications.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">لا توجد إشعارات</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const cfg = typeConfig[n.type] || typeConfig.info;
            const Icon = cfg.icon;
            return (
              <Card
                key={n.id}
                className={`cursor-pointer transition-colors ${!n.is_read ? "border-primary/30 bg-primary/5" : ""}`}
                onClick={() => !n.is_read && markAsRead(n.id)}
              >
                <CardContent className="p-4 flex items-start gap-4">
                  <Icon className={`w-5 h-5 mt-1 ${cfg.color}`} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium">{n.title}</p>
                      <div className="flex items-center gap-2">
                        {!n.is_read && <Badge variant="default" className="text-xs">جديد</Badge>}
                        <span className="text-xs text-muted-foreground font-mono">
                          {new Date(n.created_at).toLocaleDateString("ar-SA")}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{n.message}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminNotificationsPage;
