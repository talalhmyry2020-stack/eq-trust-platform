import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CloudUpload, ShieldCheck } from "lucide-react";

const QualityReportsPage = () => {
  const { user } = useAuth();

  const { data: completedMissions = [] } = useQuery({
    queryKey: ["quality-reports", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("deal_inspection_missions")
        .select("*, deals(title, deal_number, client_full_name)")
        .eq("inspector_id", user!.id)
        .eq("status", "completed")
        .order("completed_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <CloudUpload className="w-7 h-7 text-emerald-600" />
        <h1 className="font-heading text-2xl font-bold">تقارير فحص الجودة</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>الشهادات الصادرة</CardTitle>
        </CardHeader>
        <CardContent>
          {completedMissions.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              لا توجد تقارير مكتملة بعد
            </div>
          ) : (
            <div className="space-y-3">
              {completedMissions.map((m: any) => (
                <div key={m.id} className="p-4 rounded-lg border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span className="font-medium">صفقة #{m.deals?.deal_number}</span>
                    </div>
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                      شهادة صادرة ✅
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">{m.deals?.client_full_name || "—"}</p>
                  {m.quality_report && (
                    <div className="mt-2 p-3 rounded bg-muted/50 text-sm">
                      <p className="font-medium text-xs text-muted-foreground mb-1">التقرير:</p>
                      <p>{m.quality_report}</p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    {m.completed_at ? new Date(m.completed_at).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default QualityReportsPage;
