import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, Handshake, AlertTriangle, MessageSquare, FileText, Loader2 } from "lucide-react";

const typeConfig: Record<string, { icon: any; label: string; color: string }> = {
  deal_update: { icon: Handshake, label: "تحديث صفقة", color: "text-primary" },
  delay: { icon: AlertTriangle, label: "تأخير", color: "text-destructive" },
  admin_message: { icon: MessageSquare, label: "رسالة إدارية", color: "text-blue-500" },
  contract_ready: { icon: FileText, label: "عقد جاهز", color: "text-primary" },
  contract_sign_code: { icon: FileText, label: "رمز توقيع", color: "text-primary" },
  contract_signed: { icon: FileText, label: "عقد موقّع", color: "text-green-500" },
  negotiation_complete: { icon: Handshake, label: "تفاوض مكتمل", color: "text-primary" },
  info: { icon: Bell, label: "إشعار", color: "text-muted-foreground" },
};

const ClientNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    const fetchNotifications = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      
      if (error) {
        console.error("Error fetching notifications:", error);
      }
      setNotifications(data || []);
      setLoading(false);
    };

    fetchNotifications();
  }, [user]);

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">الإشعارات</h1>
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

export default ClientNotifications;
