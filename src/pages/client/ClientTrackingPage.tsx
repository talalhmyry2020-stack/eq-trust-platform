import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import {
  Ship, Timer, AlertTriangle, CheckCircle, Package,
  Truck, Anchor, ExternalLink, Shield, Clock
} from "lucide-react";

const PHASE_LABELS: Record<string, { label: string; icon: any }> = {
  token_a_released: { label: "بدء الإنتاج", icon: Package },
  factory_production: { label: "المصنع يعمل", icon: Package },
  factory_completed: { label: "الإنتاج مكتمل", icon: CheckCircle },
  quality_approved: { label: "الجودة معتمدة", icon: CheckCircle },
  token_b_released: { label: "تم صرف 50%", icon: CheckCircle },
  logistics_handoff: { label: "تسليم اللوجستيك", icon: Truck },
  shipping_documented: { label: "الشحنة موثقة", icon: Package },
  in_transit: { label: "في البحر", icon: Ship },
  port_inspection_assigned: { label: "فحص الميناء", icon: Anchor },
  sovereignty_timer: { label: "العداد السيادي", icon: Timer },
  objection_raised: { label: "اعتراض مقدم", icon: AlertTriangle },
  completed: { label: "مكتملة", icon: CheckCircle },
};

const ClientTrackingPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [objectionReason, setObjectionReason] = useState("");
  const [showObjectionForm, setShowObjectionForm] = useState(false);
  const [, setTick] = useState(0);

  // تحديث العداد كل ثانية
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const { data: deals = [] } = useQuery({
    queryKey: ["client-tracking-deals", user?.id],
    queryFn: async () => {
      const postPhases = Object.keys(PHASE_LABELS);
      const { data } = await supabase
        .from("deals")
        .select("id, deal_number, title, current_phase, status, shipping_tracking_url, sovereignty_timer_start, sovereignty_timer_end, estimated_amount")
        .eq("client_id", user!.id)
        .in("current_phase", [...postPhases, "token_a_pending", "token_b_pending", "inspection_completed"])
        .order("updated_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 10000,
  });

  // جلب الاعتراضات السابقة
  const { data: objections = [] } = useQuery({
    queryKey: ["my-objections", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("deal_objections")
        .select("*")
        .eq("client_id", user!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const submitObjection = useMutation({
    mutationFn: async (dealId: string) => {
      if (!objectionReason.trim()) throw new Error("يرجى كتابة سبب الاعتراض");
      const { error } = await supabase.functions.invoke("process-post-inspection", {
        body: {
          deal_id: dealId,
          action: "client_objection",
          data: { reason: objectionReason, client_id: user!.id },
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "✅ تم تسجيل اعتراضك وإيقاف العداد السيادي" });
      setObjectionReason("");
      setShowObjectionForm(false);
      queryClient.invalidateQueries({ queryKey: ["client-tracking-deals"] });
      queryClient.invalidateQueries({ queryKey: ["my-objections"] });
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const getSovereigntyRemaining = (deal: any) => {
    if (!deal?.sovereignty_timer_end) return null;
    const remaining = new Date(deal.sovereignty_timer_end).getTime() - Date.now();
    if (remaining <= 0) return "انتهى";
    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  const getSovereigntyProgress = (deal: any) => {
    if (!deal?.sovereignty_timer_start || !deal?.sovereignty_timer_end) return 0;
    const total = new Date(deal.sovereignty_timer_end).getTime() - new Date(deal.sovereignty_timer_start).getTime();
    const elapsed = Date.now() - new Date(deal.sovereignty_timer_start).getTime();
    return Math.min(100, (elapsed / total) * 100);
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Ship className="w-7 h-7 text-primary" />
        <h1 className="font-heading text-2xl font-bold">تتبع الشحنات</h1>
      </div>

      {deals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Ship className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>لا توجد شحنات نشطة حالياً</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {deals.map((deal: any) => {
            const phaseInfo = PHASE_LABELS[deal.current_phase];
            const isSovereignty = deal.current_phase === "sovereignty_timer";
            const isObjection = deal.current_phase === "objection_raised";
            const dealObjections = objections.filter((o: any) => o.deal_id === deal.id);

            return (
              <Card key={deal.id} className={isSovereignty ? "border-red-500/30" : isObjection ? "border-yellow-500/30" : ""}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>صفقة #{deal.deal_number} — {deal.title}</span>
                    {phaseInfo && (
                      <Badge variant={isSovereignty ? "destructive" : isObjection ? "secondary" : "default"}>
                        <phaseInfo.icon className="w-3 h-3 ml-1" />
                        {phaseInfo.label}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* رابط التتبع */}
                  {deal.shipping_tracking_url && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <Ship className="w-5 h-5 text-blue-500" />
                      <span className="text-sm font-medium">رابط تتبع الشحنة:</span>
                      <a
                        href={deal.shipping_tracking_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline flex items-center gap-1"
                      >
                        تتبع الشحنة <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}

                  {/* العداد السيادي */}
                  {isSovereignty && (
                    <div className="p-4 rounded-lg border-2 border-red-500/30 bg-red-500/5 space-y-3">
                      <div className="flex items-center gap-2">
                        <Timer className="w-5 h-5 text-red-500 animate-pulse" />
                        <span className="font-bold text-red-600">العداد السيادي — 168 ساعة</span>
                      </div>
                      <p className="text-3xl font-mono font-bold text-red-600 text-center">
                        {getSovereigntyRemaining(deal)}
                      </p>
                      <Progress value={getSovereigntyProgress(deal)} className="h-2" />
                      <p className="text-xs text-muted-foreground text-center">
                        إذا انتهى العداد دون اعتراض، تُغلق الصفقة نهائياً ويُصرف المبلغ المتبقي.
                      </p>

                      {/* زر الاعتراض */}
                      {!showObjectionForm ? (
                        <Button
                          variant="destructive"
                          className="w-full"
                          onClick={() => setShowObjectionForm(true)}
                        >
                          <AlertTriangle className="w-4 h-4 ml-2" />
                          اعتراض — إيقاف العداد
                        </Button>
                      ) : (
                        <div className="space-y-3 p-3 rounded-lg border border-red-500/20 bg-red-500/5">
                          <p className="text-sm font-medium text-red-600">⚠️ الاعتراض سيوقف العداد السيادي فوراً</p>
                          <Textarea
                            value={objectionReason}
                            onChange={(e) => setObjectionReason(e.target.value)}
                            placeholder="اكتب سبب الاعتراض بالتفصيل..."
                            rows={3}
                          />
                          <div className="flex gap-2">
                            <Button
                              variant="destructive"
                              onClick={() => submitObjection.mutate(deal.id)}
                              disabled={!objectionReason.trim() || submitObjection.isPending}
                            >
                              {submitObjection.isPending ? "جاري الإرسال..." : "تأكيد الاعتراض"}
                            </Button>
                            <Button variant="outline" onClick={() => setShowObjectionForm(false)}>إلغاء</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* حالة الاعتراض */}
                  {isObjection && (
                    <div className="p-4 rounded-lg border-2 border-yellow-500/30 bg-yellow-500/5">
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="w-5 h-5 text-yellow-600" />
                        <span className="font-bold text-yellow-600">تم إيقاف العداد — اعتراض قيد المراجعة</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        تم تسجيل اعتراضك وإيقاف العداد السيادي. ستتم مراجعة الاعتراض من قبل الإدارة.
                      </p>
                    </div>
                  )}

                  {/* سجل الاعتراضات */}
                  {dealObjections.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">سجل الاعتراضات</h4>
                      {dealObjections.map((obj: any) => (
                        <div key={obj.id} className="p-3 border rounded-lg text-sm">
                          <div className="flex justify-between mb-1">
                            <Badge variant={obj.status === "pending" ? "secondary" : obj.status === "resolved" ? "default" : "destructive"}>
                              {obj.status === "pending" ? "قيد المراجعة" : obj.status === "resolved" ? "تم الحل" : obj.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(obj.created_at).toLocaleString("ar-SA")}
                            </span>
                          </div>
                          <p className="text-muted-foreground">{obj.reason}</p>
                          {obj.admin_response && (
                            <p className="mt-1 text-primary font-medium">رد الإدارة: {obj.admin_response}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ClientTrackingPage;
