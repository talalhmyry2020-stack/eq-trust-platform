import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Camera, CheckCircle, Clock } from "lucide-react";

const QualityDashboard = () => {
  const { user } = useAuth();

  const { data: missions = [] } = useQuery({
    queryKey: ["quality-missions", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("deal_inspection_missions")
        .select("*, deals(title, deal_number, client_full_name)")
        .eq("inspector_id", user!.id)
        .in("status", ["assigned", "in_progress"])
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const { data: completedMissions = [] } = useQuery({
    queryKey: ["quality-completed-missions", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("deal_inspection_missions")
        .select("id")
        .eq("inspector_id", user!.id)
        .eq("status", "completed");
      return data || [];
    },
    enabled: !!user,
  });

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <ShieldCheck className="w-8 h-8 text-emerald-600" />
        <div>
          <h1 className="font-heading text-2xl font-bold">وكيل الجودة</h1>
          <p className="text-sm text-muted-foreground italic">"درع الحماية الأساسي ضد التلاعب بالمواصفات"</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4" /> مهام نشطة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-emerald-600">{missions.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <CheckCircle className="w-4 h-4" /> مهام مكتملة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{completedMissions.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Camera className="w-4 h-4" /> الحالة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-lg font-semibold ${missions.length > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
              {missions.find((m: any) => m.status === "in_progress")
                ? "🟢 في مهمة فحص"
                : missions.length > 0
                ? "🟡 مهمة بانتظارك"
                : "⚪ لا مهام"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* قائمة المهام */}
      <Card>
        <CardHeader>
          <CardTitle>المهام المسندة إليك</CardTitle>
        </CardHeader>
        <CardContent>
          {missions.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              لا توجد مهام فحص جودة حالياً
            </div>
          ) : (
            <div className="space-y-3">
              {missions.map((mission: any) => (
                <div key={mission.id} className="p-4 rounded-lg border flex items-center justify-between">
                  <div>
                    <p className="font-medium">صفقة #{mission.deals?.deal_number}</p>
                    <p className="text-sm text-muted-foreground">{mission.deals?.client_full_name || "—"}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      📍 {mission.factory_address || "موقع غير محدد"} — {mission.factory_country || ""}
                    </p>
                  </div>
                  <Badge variant={mission.status === "in_progress" ? "default" : "secondary"}>
                    {mission.status === "in_progress" ? "قيد التنفيذ" : "بانتظار البدء"}
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

export default QualityDashboard;
