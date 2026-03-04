import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Timer, CheckCircle, AlertTriangle, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

interface Props {
  deal: any;
  onUpdate: () => void;
}

const SovereigntyTimerWidget = ({ deal, onUpdate }: Props) => {
  const { user } = useAuth();
  const [, setTick] = useState(0);
  const [showObjectionForm, setShowObjectionForm] = useState(false);
  const [objectionReason, setObjectionReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const isSovereignty = deal.current_phase === "sovereignty_timer";
  const isObjection = deal.current_phase === "objection_raised";

  if (!isSovereignty && !isObjection) return null;

  const getRemaining = () => {
    if (!deal.sovereignty_timer_end) return null;
    const remaining = new Date(deal.sovereignty_timer_end).getTime() - Date.now();
    if (remaining <= 0) return "انتهى";
    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  const getProgress = () => {
    if (!deal.sovereignty_timer_start || !deal.sovereignty_timer_end) return 0;
    const total = new Date(deal.sovereignty_timer_end).getTime() - new Date(deal.sovereignty_timer_start).getTime();
    const elapsed = Date.now() - new Date(deal.sovereignty_timer_start).getTime();
    return Math.min(100, (elapsed / total) * 100);
  };

  const handleAccept = async () => {
    if (!confirm("هل أنت متأكد من إنهاء الصفقة؟ سيتم صرف المبلغ المتبقي للمصنع نهائياً.")) return;
    setAccepting(true);
    try {
      const { error } = await supabase.functions.invoke("process-post-inspection", {
        body: { deal_id: deal.id, action: "client_accept_deal", data: { client_id: user!.id } },
      });
      if (error) throw error;
      toast({ title: "🎉 تم إنهاء الصفقة بنجاح — شكراً لثقتك!" });
      onUpdate();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setAccepting(false);
    }
  };

  const handleObjection = async () => {
    if (!objectionReason.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("process-post-inspection", {
        body: { deal_id: deal.id, action: "client_objection", data: { reason: objectionReason, client_id: user!.id } },
      });
      if (error) throw error;
      toast({ title: "✅ تم تسجيل اعتراضك وإيقاف العداد السيادي" });
      setObjectionReason("");
      setShowObjectionForm(false);
      onUpdate();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-3 space-y-3 animate-fade-in" onClick={(e) => e.stopPropagation()}>
      {/* العداد السيادي */}
      {isSovereignty && (
        <div className="p-4 rounded-xl border-2 border-destructive/30 bg-destructive/5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Timer className="w-5 h-5 text-destructive animate-pulse" />
              <span className="font-bold text-destructive text-sm">العداد السيادي — 168 ساعة</span>
            </div>
            <Badge variant="destructive" className="font-mono text-lg px-3 py-1">
              {getRemaining()}
            </Badge>
          </div>
          <Progress value={getProgress()} className="h-2" />
          <p className="text-xs text-muted-foreground text-center">
            إذا انتهى العداد دون اعتراض، تُغلق الصفقة نهائياً ويُصرف المبلغ المتبقي.
          </p>

          <div className="flex gap-2 flex-col sm:flex-row">
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-2"
              onClick={handleAccept}
              disabled={accepting}
            >
              <CheckCircle className="w-4 h-4" />
              {accepting ? "جاري الإنهاء..." : "✅ كل شيء تمام — إنهاء الصفقة"}
            </Button>
            {!showObjectionForm && (
              <Button
                variant="destructive"
                className="flex-1 gap-2"
                onClick={() => setShowObjectionForm(true)}
              >
                <AlertTriangle className="w-4 h-4" />
                اعتراض — إيقاف العداد
              </Button>
            )}
          </div>

          {showObjectionForm && (
            <div className="space-y-3 p-3 rounded-lg border border-destructive/20 bg-destructive/5">
              <p className="text-sm font-medium text-destructive">⚠️ الاعتراض سيوقف العداد السيادي فوراً</p>
              <Textarea
                value={objectionReason}
                onChange={(e) => setObjectionReason(e.target.value)}
                placeholder="اكتب سبب الاعتراض بالتفصيل..."
                rows={3}
              />
              <div className="flex gap-2">
                <Button variant="destructive" onClick={handleObjection} disabled={!objectionReason.trim() || submitting}>
                  {submitting ? "جاري الإرسال..." : "تأكيد الاعتراض"}
                </Button>
                <Button variant="outline" onClick={() => setShowObjectionForm(false)}>إلغاء</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* حالة الاعتراض */}
      {isObjection && (
        <div className="p-4 rounded-xl border-2 border-yellow-500/30 bg-yellow-500/5">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-yellow-600" />
            <span className="font-bold text-yellow-600 text-sm">تم إيقاف العداد — اعتراض قيد المراجعة</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            تم تسجيل اعتراضك وإيقاف العداد السيادي. ستتم مراجعة الاعتراض من قبل الإدارة.
          </p>
        </div>
      )}
    </div>
  );
};

export default SovereigntyTimerWidget;
