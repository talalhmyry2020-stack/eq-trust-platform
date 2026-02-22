import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Truck, Package, Ship, Camera, CheckCircle, ExternalLink, Anchor, Factory, MapPin, FlaskConical, Shield } from "lucide-react";

const SHIPPING_PHASES = [
  { key: "loading_goods", label: "📦 قيد التحميل", icon: Package, color: "text-yellow-500", next: "leaving_factory" },
  { key: "leaving_factory", label: "🚛 مغادرة المصنع", icon: Truck, color: "text-orange-500", next: "at_source_port" },
  { key: "at_source_port", label: "⚓ ميناء التصدير", icon: Anchor, color: "text-blue-500", next: "in_transit" },
  { key: "in_transit", label: "🚢 في البحر", icon: Ship, color: "text-cyan-500", next: "at_destination_port" },
  { key: "at_destination_port", label: "🏁 ميناء الوجهة", icon: MapPin, color: "text-green-500", next: null },
];

const LogisticsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [trackingUrl, setTrackingUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [sealPhoto, setSealPhoto] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [testMode, setTestMode] = useState(true);

  const { data: deals = [] } = useQuery({
    queryKey: ["logistics-deals"],
    queryFn: async () => {
      const { data } = await supabase
        .from("deals")
        .select("id, deal_number, title, current_phase, client_full_name, estimated_amount, shipping_tracking_url")
        .eq("status", "active")
        .in("current_phase", [
          "loading_goods", "leaving_factory", "at_source_port", "in_transit", "at_destination_port",
          "logistics_handoff", "shipping_documented", "token_b_released",
        ])
        .order("updated_at", { ascending: false });
      return data || [];
    },
    refetchInterval: 10000,
  });

  const advancePhase = useMutation({
    mutationFn: async ({ dealId, action, extraData }: { dealId: string; action: string; extraData?: any }) => {
      const { error } = await supabase.functions.invoke("process-post-inspection", {
        body: { deal_id: dealId, action, data: extraData },
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      const phase = SHIPPING_PHASES.find(p => p.key === vars.action);
      toast({ title: `✅ ${phase?.label || "تم التحديث بنجاح"}` });
      queryClient.invalidateQueries({ queryKey: ["logistics-deals"] });
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const documentShipment = useMutation({
    mutationFn: async ({ dealId, nextAction }: { dealId: string; nextAction: string }) => {
      setUploading(true);
      let sealPhotoUrl = "";
      if (sealPhoto) {
        const filePath = `logistics/${dealId}/${Date.now()}_seal.jpg`;
        const { error } = await supabase.storage.from("inspection-photos").upload(filePath, sealPhoto);
        if (!error) {
          const { data: urlData } = supabase.storage.from("inspection-photos").getPublicUrl(filePath);
          sealPhotoUrl = urlData.publicUrl;
        }
      }
      // حفظ التوثيق
      await supabase.functions.invoke("process-post-inspection", {
        body: {
          deal_id: dealId,
          action: "logistics_documented",
          data: { tracking_url: trackingUrl, seal_photo_url: sealPhotoUrl, notes },
        },
      });
      // الانتقال للمرحلة التالية
      const { error } = await supabase.functions.invoke("process-post-inspection", {
        body: { deal_id: dealId, action: nextAction, data: { tracking_url: trackingUrl } },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "✅ تم توثيق الشحنة والانتقال للمرحلة التالية" });
      setTrackingUrl("");
      setNotes("");
      setSealPhoto(null);
      setUploading(false);
      queryClient.invalidateQueries({ queryKey: ["logistics-deals"] });
    },
    onError: (err: any) => {
      setUploading(false);
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  // تشغيل تلقائي — ينقل جميع المراحل دفعة واحدة
  const simulateAllPhases = useMutation({
    mutationFn: async (dealId: string) => {
      for (const phase of SHIPPING_PHASES) {
        await supabase.functions.invoke("process-post-inspection", {
          body: { deal_id: dealId, action: phase.key },
        });
        await new Promise(r => setTimeout(r, 500));
      }
    },
    onSuccess: () => {
      toast({ title: "🧪 تم محاكاة جميع مراحل الشحن تلقائياً!" });
      queryClient.invalidateQueries({ queryKey: ["logistics-deals"] });
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const getPhaseIndex = (phase: string) => SHIPPING_PHASES.findIndex(p => p.key === phase);

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

      {/* خريطة المراحل */}
      <div className="flex items-center justify-between mb-6 p-3 rounded-lg border bg-card overflow-x-auto">
        {SHIPPING_PHASES.map((phase, i) => {
          const count = groupedDeals[i].deals.length;
          const Icon = phase.icon;
          return (
            <div key={phase.key} className="flex items-center gap-1">
              <div className="flex flex-col items-center text-center min-w-[80px]">
                <Icon className={`w-5 h-5 ${phase.color}`} />
                <span className="text-xs mt-1">{phase.label.replace(/^.+\s/, "")}</span>
                <Badge variant="secondary" className="text-xs mt-1">{count}</Badge>
              </div>
              {i < SHIPPING_PHASES.length - 1 && <span className="text-muted-foreground mx-1">→</span>}
            </div>
          );
        })}
      </div>

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
                <div key={deal.id} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">#{deal.deal_number} — {deal.title}</p>
                      <p className="text-sm text-muted-foreground">العميل: {deal.client_full_name}</p>
                    </div>
                    {deal.shipping_tracking_url && (
                      <a href={deal.shipping_tracking_url} target="_blank" className="text-primary text-sm flex items-center gap-1">
                        تتبع <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  {/* إدخال رابط التتبع عند مرحلة التحميل أو ميناء التصدير */}
                  {(group.key === "loading_goods" || group.key === "at_source_port") && !deal.shipping_tracking_url && (
                    <div className="grid gap-2">
                      <Input
                        value={trackingUrl}
                        onChange={(e) => setTrackingUrl(e.target.value)}
                        placeholder="رابط تتبع الشحنة (اختياري)"
                      />
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setSealPhoto(e.target.files?.[0] || null)}
                      />
                    </div>
                  )}

                  {/* أزرار الانتقال */}
                  <div className="flex gap-2">
                    {group.next && (
                      <Button
                        size="sm"
                        onClick={() => {
                          if (trackingUrl || sealPhoto) {
                            documentShipment.mutate({ dealId: deal.id, nextAction: group.next! });
                          } else {
                            advancePhase.mutate({ dealId: deal.id, action: group.next!, extraData: { tracking_url: deal.shipping_tracking_url } });
                          }
                        }}
                        disabled={advancePhase.isPending || documentShipment.isPending}
                      >
                        <CheckCircle className="w-4 h-4 ml-2" />
                        انتقال → {SHIPPING_PHASES.find(p => p.key === group.next)?.label}
                      </Button>
                    )}
                    {testMode && group.key === "loading_goods" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => simulateAllPhases.mutate(deal.id)}
                        disabled={simulateAllPhases.isPending}
                      >
                        <FlaskConical className="w-4 h-4 ml-2" />
                        🧪 محاكاة كل المراحل
                      </Button>
                    )}
                  </div>
                </div>
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
