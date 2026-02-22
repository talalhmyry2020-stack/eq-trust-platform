import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Workflow, Play, CheckCircle, Factory, Truck, Ship, Anchor, Timer,
  Camera, DollarSign, ArrowRight, TestTube, AlertTriangle, Package
} from "lucide-react";

const PHASE_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  inspection_completed: { label: "الفحص مكتمل", icon: Camera, color: "text-blue-500" },
  token_a_pending: { label: "توكن A بانتظار الاعتماد", icon: DollarSign, color: "text-yellow-500" },
  token_a_released: { label: "توكن A تم صرفه (30%)", icon: CheckCircle, color: "text-green-500" },
  factory_production: { label: "المصنع يعمل", icon: Factory, color: "text-orange-500" },
  factory_completed: { label: "المصنع أكمل الإنتاج", icon: Factory, color: "text-green-600" },
  quality_inspection_assigned: { label: "فحص الجودة — معيّن", icon: Camera, color: "text-blue-500" },
  quality_inspection_in_progress: { label: "فحص الجودة — جاري", icon: Camera, color: "text-blue-600" },
  quality_approved: { label: "الجودة معتمدة", icon: CheckCircle, color: "text-green-500" },
  token_b_pending: { label: "توكن B بانتظار الاعتماد", icon: DollarSign, color: "text-yellow-500" },
  token_b_released: { label: "توكن B تم صرفه (50%)", icon: CheckCircle, color: "text-green-500" },
  logistics_handoff: { label: "تسليم اللوجستيك", icon: Truck, color: "text-purple-500" },
  shipping_documented: { label: "الشحنة موثقة", icon: Package, color: "text-indigo-500" },
  in_transit: { label: "في البحر", icon: Ship, color: "text-blue-600" },
  port_inspection_assigned: { label: "فحص الميناء — معيّن", icon: Anchor, color: "text-cyan-500" },
  sovereignty_timer: { label: "العداد السيادي 168 ساعة", icon: Timer, color: "text-red-500" },
  completed: { label: "مكتملة", icon: CheckCircle, color: "text-green-700" },
};

const WorkflowManagerPage = () => {
  const queryClient = useQueryClient();
  const [selectedDeal, setSelectedDeal] = useState<string>("");
  const [inspectorDialog, setInspectorDialog] = useState<{ type: string; dealId: string } | null>(null);
  const [selectedInspector, setSelectedInspector] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");

  // جلب الصفقات في مراحل ما بعد الفحص
  const postInspectionPhases = Object.keys(PHASE_LABELS);
  
  const { data: deals = [] } = useQuery({
    queryKey: ["workflow-deals"],
    queryFn: async () => {
      const { data } = await supabase
        .from("deals")
        .select("id, deal_number, title, current_phase, status, client_full_name, estimated_amount, sovereignty_timer_start, sovereignty_timer_end, shipping_tracking_url")
        .eq("status", "active")
        .in("current_phase", [...postInspectionPhases, "deposit_approved", "inspection_assigned", "inspection_in_progress"])
        .order("updated_at", { ascending: false });
      return data || [];
    },
    refetchInterval: 10000,
  });

  // جلب التوكنات
  const { data: tokens = [] } = useQuery({
    queryKey: ["workflow-tokens", selectedDeal],
    queryFn: async () => {
      if (!selectedDeal) return [];
      const { data } = await supabase
        .from("deal_tokens")
        .select("*")
        .eq("deal_id", selectedDeal)
        .order("created_at");
      return data || [];
    },
    enabled: !!selectedDeal,
  });

  // جلب المفتشين
  const { data: inspectors = [] } = useQuery({
    queryKey: ["inspectors-for-workflow"],
    queryFn: async () => {
      const { data: perms } = await supabase.from("employee_permissions").select("user_id").eq("permission", "capture_evidence");
      if (!perms?.length) return [];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", perms.map(p => p.user_id));
      return profiles || [];
    },
  });

  const callWorkflow = useMutation({
    mutationFn: async ({ dealId, action, data }: { dealId: string; action: string; data?: any }) => {
      const { data: res, error } = await supabase.functions.invoke("process-post-inspection", {
        body: { deal_id: dealId, action, data },
      });
      if (error) throw error;
      return res;
    },
    onSuccess: (res) => {
      toast({ title: "✅ " + (res?.message || "تم بنجاح") });
      queryClient.invalidateQueries({ queryKey: ["workflow-deals"] });
      queryClient.invalidateQueries({ queryKey: ["workflow-tokens"] });
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  // محاكاة المسار الكامل تجريبياً
  const simulateFullWorkflow = useMutation({
    mutationFn: async (dealId: string) => {
      const steps = [
        { action: "create_token_a", delay: 500 },
        { action: "approve_token_a", delay: 1000 },
        { action: "factory_completed", delay: 1500 },
        { action: "quality_approved", delay: 2000 },
        { action: "approve_token_b", delay: 2500 },
        { action: "logistics_documented", delay: 3000, data: { tracking_url: "https://track.example.com/SIM123", seal_confirmed: true } },
        { action: "in_transit", delay: 3500 },
        { action: "port_inspection_complete", delay: 4000 },
      ];

      for (const step of steps) {
        await new Promise(r => setTimeout(r, step.delay));
        const { error } = await supabase.functions.invoke("process-post-inspection", {
          body: { deal_id: dealId, action: step.action, data: step.data },
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "🧪 المحاكاة اكتملت! — العداد السيادي بدأ" });
      queryClient.invalidateQueries({ queryKey: ["workflow-deals"] });
    },
    onError: (err: any) => {
      toast({ title: "خطأ في المحاكاة", description: err.message, variant: "destructive" });
    },
  });

  const activeDeal = deals.find((d: any) => d.id === selectedDeal);
  const phaseInfo = activeDeal ? PHASE_LABELS[activeDeal.current_phase] : null;

  // حساب العداد السيادي
  const getSovereigntyRemaining = (deal: any) => {
    if (!deal?.sovereignty_timer_end) return null;
    const remaining = new Date(deal.sovereignty_timer_end).getTime() - Date.now();
    if (remaining <= 0) return "انتهى";
    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    return `${hours} ساعة ${minutes} دقيقة`;
  };

  const getNextAction = (phase: string): { label: string; action: string; isTest?: boolean; data?: any }[] => {
    switch (phase) {
      case "inspection_completed": return [
        { label: "🧪 تجريبي: خصم 30% وإيداع للمصنع", action: "test_auto_token_a", isTest: true },
        { label: "رسمي: إنشاء توكن A (30%)", action: "create_token_a" },
      ];
      case "token_a_pending": return [{ label: "اعتماد توكن A", action: "approve_token_a" }];
      case "factory_production": return [{ label: "المصنع أكمل الإنتاج", action: "factory_completed" }];
      case "factory_completed": return [{ label: "تعيين مفتش جودة", action: "assign_quality_inspector" }];
      case "quality_approved": return [{ label: "إنشاء توكن B (50%)", action: "quality_approved" }];
      case "token_b_pending": return [{ label: "اعتماد توكن B", action: "approve_token_b" }];
      case "logistics_handoff": return [{ label: "توثيق الشحنة", action: "logistics_documented" }];
      case "shipping_documented": return [{ label: "البضاعة في البحر", action: "in_transit" }];
      case "in_transit": return [{ label: "تعيين مفتش ميناء", action: "assign_port_inspector" }];
      case "sovereignty_timer": return [{ label: "إغلاق الصفقة (انتهى العداد)", action: "complete_deal" }];
      default: return [];
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Workflow className="w-7 h-7 text-primary" />
          <h1 className="font-heading text-2xl font-bold">مدير سير العمل</h1>
        </div>
      </div>

      {/* مخطط المراحل */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-sm">مراحل ما بعد الفحص</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-1 text-xs">
            {Object.entries(PHASE_LABELS).map(([key, val], i) => {
              const Icon = val.icon;
              const isActive = activeDeal?.current_phase === key;
              return (
                <div key={key} className="flex items-center gap-1">
                  <div className={`flex items-center gap-1 px-2 py-1 rounded ${isActive ? "bg-primary text-primary-foreground font-bold" : "bg-muted"}`}>
                    <Icon className="w-3 h-3" />
                    <span>{val.label}</span>
                  </div>
                  {i < Object.keys(PHASE_LABELS).length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground" />}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* اختيار الصفقة */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">اختر صفقة</label>
              <Select value={selectedDeal} onValueChange={setSelectedDeal}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر صفقة لإدارتها..." />
                </SelectTrigger>
                <SelectContent>
                  {deals.map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>
                      #{d.deal_number} — {d.title} ({PHASE_LABELS[d.current_phase]?.label || d.current_phase})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* تفاصيل الصفقة المختارة */}
      {activeDeal && (
        <div className="space-y-4">
          {/* معلومات الصفقة */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>صفقة #{activeDeal.deal_number} — {activeDeal.title}</span>
                {phaseInfo && (
                  <Badge className="text-sm">
                    <phaseInfo.icon className="w-4 h-4 ml-1" />
                    {phaseInfo.label}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span className="text-muted-foreground">العميل:</span> <span className="font-medium">{activeDeal.client_full_name}</span></div>
                <div><span className="text-muted-foreground">المبلغ:</span> <span className="font-medium">{activeDeal.estimated_amount || "—"}</span></div>
                <div><span className="text-muted-foreground">المرحلة:</span> <span className="font-medium">{activeDeal.current_phase}</span></div>
                {activeDeal.shipping_tracking_url && (
                  <div><span className="text-muted-foreground">التتبع:</span> <a href={activeDeal.shipping_tracking_url} target="_blank" className="text-primary underline">رابط التتبع</a></div>
                )}
              </div>

              {/* العداد السيادي */}
              {activeDeal.current_phase === "sovereignty_timer" && (
                <div className="p-4 rounded-lg border-2 border-red-500/30 bg-red-500/5">
                  <div className="flex items-center gap-2 mb-2">
                    <Timer className="w-5 h-5 text-red-500 animate-pulse" />
                    <span className="font-bold text-red-600">العداد السيادي — 168 ساعة</span>
                  </div>
                  <p className="text-2xl font-mono font-bold text-red-600">
                    {getSovereigntyRemaining(activeDeal)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    بداية: {new Date(activeDeal.sovereignty_timer_start).toLocaleString("ar-SA")} |
                    نهاية: {new Date(activeDeal.sovereignty_timer_end).toLocaleString("ar-SA")}
                  </p>
                </div>
              )}

              {/* التوكنات */}
              {tokens.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">التوكنات المالية</h4>
                  {tokens.map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-primary" />
                        <span className="font-medium">{t.token_type === "token_a" ? "Token A (30%)" : t.token_type === "token_b" ? "Token B (50%)" : t.token_type}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold">{Number(t.amount).toFixed(2)} {t.currency}</span>
                        <Badge variant={t.status === "approved" ? "default" : "secondary"}>
                          {t.status === "approved" ? "معتمد ✓" : t.status === "pending" ? "بانتظار" : t.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* أزرار الإجراءات */}
              <div className="flex gap-3 flex-wrap">
                {/* الإجراء التالي */}
                {(() => {
                  const actions = getNextAction(activeDeal.current_phase);
                  if (!actions.length) return null;

                  return actions.map((next, idx) => {
                    // إذا كان الإجراء يحتاج اختيار مفتش
                    if (next.action === "assign_quality_inspector" || next.action === "assign_port_inspector") {
                      return (
                        <Button
                          key={idx}
                          onClick={() => setInspectorDialog({ type: next.action, dealId: activeDeal.id })}
                          disabled={callWorkflow.isPending}
                        >
                          <Play className="w-4 h-4 ml-2" />
                          {next.label}
                        </Button>
                      );
                    }

                    // إذا كان توثيق الشحنة
                    if (next.action === "logistics_documented") {
                      return (
                        <div key={idx} className="flex gap-2 items-end flex-1">
                          <div className="flex-1">
                            <Input
                              placeholder="رابط تتبع الشحنة..."
                              value={trackingUrl}
                              onChange={(e) => setTrackingUrl(e.target.value)}
                            />
                          </div>
                          <Button
                            onClick={() => callWorkflow.mutate({
                              dealId: activeDeal.id,
                              action: "logistics_documented",
                              data: { tracking_url: trackingUrl, seal_confirmed: true },
                            })}
                            disabled={callWorkflow.isPending}
                          >
                            <Truck className="w-4 h-4 ml-2" />
                            توثيق الشحنة
                          </Button>
                        </div>
                      );
                    }

                    return (
                      <Button
                        key={idx}
                        variant={next.isTest ? "outline" : "default"}
                        className={next.isTest ? "border-yellow-500/50 text-yellow-600 hover:bg-yellow-500/10" : ""}
                        onClick={() => callWorkflow.mutate({ dealId: activeDeal.id, action: next.action })}
                        disabled={callWorkflow.isPending}
                      >
                        {next.isTest ? <TestTube className="w-4 h-4 ml-2" /> : <Play className="w-4 h-4 ml-2" />}
                        {next.label}
                      </Button>
                    );
                  });
                })()}

                {/* زر المحاكاة الكاملة */}
                {activeDeal.current_phase === "inspection_completed" && (
                  <Button
                    variant="outline"
                    className="border-yellow-500/50 text-yellow-600 hover:bg-yellow-500/10"
                    onClick={() => simulateFullWorkflow.mutate(activeDeal.id)}
                    disabled={simulateFullWorkflow.isPending}
                  >
                    <TestTube className="w-4 h-4 ml-2" />
                    {simulateFullWorkflow.isPending ? "جاري المحاكاة..." : "🧪 محاكاة المسار الكامل"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* قائمة كل الصفقات */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">جميع الصفقات في مسار ما بعد الفحص ({deals.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {deals.map((d: any) => {
                  const p = PHASE_LABELS[d.current_phase];
                  return (
                    <div
                      key={d.id}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition ${d.id === selectedDeal ? "border-primary bg-primary/5" : "hover:border-primary/30"}`}
                      onClick={() => setSelectedDeal(d.id)}
                    >
                      <div>
                        <span className="font-medium">#{d.deal_number}</span>
                        <span className="text-muted-foreground text-sm mr-2">— {d.title}</span>
                      </div>
                      {p ? (
                        <Badge variant="outline" className="text-xs">
                          <p.icon className={`w-3 h-3 ml-1 ${p.color}`} />
                          {p.label}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">{d.current_phase}</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {!activeDeal && deals.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Workflow className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>لا توجد صفقات في مسار ما بعد الفحص حالياً</p>
          </CardContent>
        </Card>
      )}

      {/* ديالوج تعيين مفتش */}
      <Dialog open={!!inspectorDialog} onOpenChange={() => setInspectorDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {inspectorDialog?.type === "assign_quality_inspector" ? "تعيين مفتش جودة" : "تعيين مفتش ميناء"}
            </DialogTitle>
          </DialogHeader>
          <Select value={selectedInspector} onValueChange={setSelectedInspector}>
            <SelectTrigger>
              <SelectValue placeholder="اختر مفتشاً..." />
            </SelectTrigger>
            <SelectContent>
              {inspectors.map((ins: any) => (
                <SelectItem key={ins.user_id} value={ins.user_id}>{ins.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button
              onClick={async () => {
                if (!inspectorDialog || !selectedInspector) return;
                const user = (await supabase.auth.getUser()).data.user;
                callWorkflow.mutate({
                  dealId: inspectorDialog.dealId,
                  action: inspectorDialog.type,
                  data: {
                    inspector_id: selectedInspector,
                    assigned_by: user?.id,
                    factory_address: "موقع تجريبي",
                    factory_country: "مصر",
                    port_address: "الميناء",
                    port_country: "مصر",
                    port_lat: 31.2,
                    port_lng: 31.8,
                  },
                });
                setInspectorDialog(null);
                setSelectedInspector("");
              }}
              disabled={!selectedInspector || callWorkflow.isPending}
            >
              <CheckCircle className="w-4 h-4 ml-2" />
              تعيين
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkflowManagerPage;
