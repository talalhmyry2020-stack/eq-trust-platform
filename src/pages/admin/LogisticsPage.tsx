import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Truck, FlaskConical, Shield } from "lucide-react";
import LogisticsPhaseMap, { SHIPPING_PHASES } from "@/components/admin/logistics/LogisticsPhaseMap";
import LogisticsStats from "@/components/admin/logistics/LogisticsStats";
import LogisticsDealCard from "@/components/admin/logistics/LogisticsDealCard";

const LogisticsPage = () => {
  const { user } = useAuth();
  const [testMode, setTestMode] = useState(true);

  const { data: deals = [] } = useQuery({
    queryKey: ["logistics-deals", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("deals")
        .select("id, deal_number, title, current_phase, client_full_name, estimated_amount, shipping_tracking_url")
        .eq("logistics_employee_id", user.id)
        .in("current_phase", [
          "loading_goods", "leaving_factory", "at_source_port", "in_transit", "at_destination_port",
          "logistics_handoff", "shipping_documented", "token_b_released",
        ])
        .order("updated_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 10000,
  });

  const { data: stats } = useQuery({
    queryKey: ["logistics-stats", user?.id],
    queryFn: async () => {
      if (!user) return { reports: 0, photos: 0, completed: 0 };
      const [reportsRes, photosRes, completedRes] = await Promise.all([
        supabase.from("logistics_reports").select("id", { count: "exact", head: true }).eq("employee_id", user.id).eq("status", "submitted"),
        supabase.from("logistics_photos").select("id", { count: "exact", head: true }),
        supabase.from("deals").select("id", { count: "exact", head: true }).eq("logistics_employee_id", user.id).eq("current_phase", "at_destination_port"),
      ]);
      return {
        reports: reportsRes.count || 0,
        photos: photosRes.count || 0,
        completed: completedRes.count || 0,
      };
    },
    enabled: !!user,
  });

  const phaseCounts: Record<string, number> = {};
  SHIPPING_PHASES.forEach(p => {
    phaseCounts[p.key] = deals.filter((d: any) => d.current_phase === p.key).length;
  });

  const groupedDeals = SHIPPING_PHASES.map(phase => ({
    ...phase,
    deals: deals.filter((d: any) => d.current_phase === phase.key),
  }));

  return (
    <div>
      {/* هوية الموظف */}
      <div className="mb-6 p-4 rounded-xl border border-purple-500/30 bg-purple-500/5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
            <Truck className="w-6 h-6 text-purple-500" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold">موظف اللوجستيك</h1>
            <p className="text-sm text-muted-foreground italic">"نوثّق كل شحنة.. ونتابع كل رحلة حتى الميناء"</p>
          </div>
          <div className="mr-auto flex items-center gap-3">
            <div className="flex items-center gap-2 p-2 rounded-lg border bg-card">
              {testMode ? <FlaskConical className="w-4 h-4 text-amber-500" /> : <Shield className="w-4 h-4 text-green-600" />}
              <Label htmlFor="logistics-test-mode" className="text-xs cursor-pointer">
                {testMode ? "تجريبي 🧪" : "رسمي 🛡️"}
              </Label>
              <Switch id="logistics-test-mode" checked={testMode} onCheckedChange={setTestMode} />
            </div>
            <Badge className="bg-purple-500/20 text-purple-600 border-purple-500/30">لوجستيك</Badge>
          </div>
        </div>
      </div>

      {/* الإحصائيات */}
      <LogisticsStats
        totalActive={deals.length}
        totalCompleted={stats?.completed || 0}
        totalReports={stats?.reports || 0}
        totalPhotos={stats?.photos || 0}
      />

      {/* خريطة المراحل */}
      <LogisticsPhaseMap phaseCounts={phaseCounts} />

      {/* المراحل */}
      {groupedDeals.map((group) => {
        if (group.deals.length === 0) return null;
        const Icon = group.icon;
        return (
          <Card key={group.key} className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Icon className={`w-5 h-5 ${group.color}`} />
                {group.label}
                <Badge variant="secondary" className="text-xs">{group.deals.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {group.deals.map((deal: any) => (
                <LogisticsDealCard key={deal.id} deal={deal} phaseKey={group.key} testMode={testMode} />
              ))}
            </CardContent>
          </Card>
        );
      })}

      {deals.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Truck className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>لا توجد شحنات حالياً</p>
            <p className="text-xs mt-1">ستظهر الشحنات بعد صرف التوكن B واعتماد الجودة</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LogisticsPage;
