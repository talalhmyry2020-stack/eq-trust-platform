import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Camera, ExternalLink, FlaskConical, Upload } from "lucide-react";
import { SHIPPING_PHASES, PHASE_CHECKLIST } from "./LogisticsPhaseMap";

interface Props {
  deal: any;
  phaseKey: string;
  testMode: boolean;
}

const PHOTO_TYPES = [
  { key: "container", label: "رقم الحاوية" },
  { key: "seal", label: "الختم الملاحي" },
  { key: "bol", label: "بوليصة الشحن" },
  { key: "goods", label: "البضاعة محملة" },
  { key: "truck", label: "الشاحنة" },
  { key: "ship", label: "السفينة" },
  { key: "port", label: "الميناء" },
  { key: "other", label: "أخرى" },
];

const LogisticsDealCard = ({ deal, phaseKey, testMode }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const checklist = PHASE_CHECKLIST[phaseKey] || [];
  const nextPhase = SHIPPING_PHASES.find(p => p.key === phaseKey)?.next;

  const [completedItems, setCompletedItems] = useState<string[]>([]);
  const [containerNumber, setContainerNumber] = useState("");
  const [sealNumber, setSealNumber] = useState("");
  const [bolNumber, setBolNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState(deal.shipping_tracking_url || "");
  const [reportText, setReportText] = useState("");
  const [photos, setPhotos] = useState<{ file: File; type: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const toggleItem = (id: string) => {
    setCompletedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const requiredItems = checklist.filter(c => c.required).map(c => c.id);
  const allRequiredDone = requiredItems.every(id => completedItems.includes(id));

  const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotos(prev => [...prev, { file, type }]);
    }
  };

  const submitReport = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("غير مسجل");
      setUploading(true);

      // 1. Create or update report
      const { data: report, error: reportErr } = await supabase
        .from("logistics_reports")
        .upsert({
          deal_id: deal.id,
          phase: phaseKey,
          employee_id: user.id,
          container_number: containerNumber || null,
          seal_number: sealNumber || null,
          bol_number: bolNumber || null,
          tracking_url: trackingUrl || null,
          notes: "",
          report_text: reportText,
          checklist_completed: completedItems,
          status: "submitted",
        }, { onConflict: "deal_id,phase" })
        .select("id")
        .single();
      
      if (reportErr) throw reportErr;

      // 2. Upload photos
      for (const photo of photos) {
        const filePath = `logistics/${deal.id}/${phaseKey}/${Date.now()}_${photo.type}.jpg`;
        const { error: uploadErr } = await supabase.storage
          .from("inspection-photos")
          .upload(filePath, photo.file);
        
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from("inspection-photos").getPublicUrl(filePath);
          await supabase.from("logistics_photos").insert({
            report_id: report.id,
            deal_id: deal.id,
            phase: phaseKey,
            photo_type: photo.type,
            photo_url: urlData.publicUrl,
            caption: PHOTO_TYPES.find(p => p.key === photo.type)?.label || "",
          });
        }
      }

      // 3. Update tracking URL on deal if provided
      if (trackingUrl) {
        await supabase.from("deals").update({ shipping_tracking_url: trackingUrl }).eq("id", deal.id);
      }

      // 4. Advance phase
      if (nextPhase) {
        await supabase.functions.invoke("process-post-inspection", {
          body: { deal_id: deal.id, action: nextPhase, data: { tracking_url: trackingUrl } },
        });
      }
    },
    onSuccess: () => {
      toast({ title: `✅ تم تقديم تقرير ${SHIPPING_PHASES.find(p => p.key === phaseKey)?.label} والانتقال للمرحلة التالية` });
      setUploading(false);
      setPhotos([]);
      setReportText("");
      setCompletedItems([]);
      queryClient.invalidateQueries({ queryKey: ["logistics-deals"] });
      queryClient.invalidateQueries({ queryKey: ["logistics-stats"] });
    },
    onError: (err: any) => {
      setUploading(false);
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const simulateAll = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("process-post-inspection", {
        body: { deal_id: deal.id, action: "test_full_logistics_simulation" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast({ 
        title: "🧪 تمت المحاكاة الشاملة!",
        description: `حاوية: ${data?.container_number || "—"} | تتبع: تم الإرسال للعميل | العداد السيادي بدأ ⏱️`,
      });
      queryClient.invalidateQueries({ queryKey: ["logistics-deals"] });
      queryClient.invalidateQueries({ queryKey: ["logistics-stats"] });
    },
  });

  return (
    <div className="p-4 border rounded-lg space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div>
          <p className="font-medium">#{deal.deal_number} — {deal.title}</p>
          <p className="text-sm text-muted-foreground">العميل: {deal.client_full_name}</p>
        </div>
        <div className="flex items-center gap-2">
          {deal.shipping_tracking_url && (
            <a href={deal.shipping_tracking_url} target="_blank" className="text-primary text-sm flex items-center gap-1" onClick={e => e.stopPropagation()}>
              تتبع <ExternalLink className="w-3 h-3" />
            </a>
          )}
          <Badge variant="outline" className="text-xs">
            {completedItems.length}/{checklist.length} ✓
          </Badge>
        </div>
      </div>

      {expanded && (
        <div className="space-y-4 pt-2 border-t">
          {/* Checklist */}
          <div>
            <h4 className="text-sm font-semibold mb-2">📋 قائمة التحقق الإجبارية</h4>
            <div className="space-y-2">
              {checklist.map((item) => (
                <div key={item.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`${deal.id}-${item.id}`}
                    checked={completedItems.includes(item.id)}
                    onCheckedChange={() => toggleItem(item.id)}
                  />
                  <label htmlFor={`${deal.id}-${item.id}`} className="text-sm cursor-pointer flex-1">
                    {item.label}
                    {item.required && <span className="text-destructive mr-1">*</span>}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* بيانات التوثيق */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(phaseKey === "loading_goods") && (
              <>
                <Input placeholder="رقم الحاوية *" value={containerNumber} onChange={e => setContainerNumber(e.target.value)} />
                <Input placeholder="رقم الختم الملاحي (Seal) *" value={sealNumber} onChange={e => setSealNumber(e.target.value)} />
              </>
            )}
            {(phaseKey === "leaving_factory" || phaseKey === "loading_goods") && (
              <Input placeholder="رقم بوليصة الشحن (BOL)" value={bolNumber} onChange={e => setBolNumber(e.target.value)} />
            )}
            {(phaseKey === "at_source_port" || phaseKey === "in_transit") && (
              <Input placeholder="رابط التتبع *" value={trackingUrl} onChange={e => setTrackingUrl(e.target.value)} />
            )}
          </div>

          {/* رفع الصور */}
          <div>
            <h4 className="text-sm font-semibold mb-2">📸 رفع الصور التوثيقية</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {PHOTO_TYPES.filter(pt => {
                if (phaseKey === "loading_goods") return ["container", "seal", "goods", "other"].includes(pt.key);
                if (phaseKey === "leaving_factory") return ["truck", "bol", "other"].includes(pt.key);
                if (phaseKey === "at_source_port") return ["port", "ship", "other"].includes(pt.key);
                if (phaseKey === "at_destination_port") return ["port", "other"].includes(pt.key);
                return pt.key === "other";
              }).map((pt) => {
                const uploaded = photos.filter(p => p.type === pt.key).length;
                return (
                  <div key={pt.key} className="relative">
                    <label className="flex flex-col items-center gap-1 p-3 border border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors text-center">
                      <Camera className="w-5 h-5 text-muted-foreground" />
                      <span className="text-xs">{pt.label}</span>
                      {uploaded > 0 && <Badge className="text-xs">{uploaded} صورة</Badge>}
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handlePhotoAdd(e, pt.key)} />
                    </label>
                  </div>
                );
              })}
            </div>
            {photos.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">إجمالي الصور: {photos.length}</p>
            )}
          </div>

          {/* التقرير */}
          <div>
            <h4 className="text-sm font-semibold mb-2">📋 التقرير</h4>
            <Textarea
              placeholder="اكتب تقرير هذه المرحلة بالتفصيل... (رقم الحاوية، الختم، الملاحظات، أي مشاكل)"
              value={reportText}
              onChange={e => setReportText(e.target.value)}
              rows={4}
            />
          </div>

          {/* أزرار */}
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={() => submitReport.mutate()}
              disabled={!allRequiredDone || !reportText.trim() || uploading || submitReport.isPending}
            >
              <Upload className="w-4 h-4 ml-2" />
              {uploading ? "جاري الرفع..." : `تقديم التقرير والانتقال → ${SHIPPING_PHASES.find(p => p.key === nextPhase)?.label || "إنهاء"}`}
            </Button>

            {testMode && phaseKey === "loading_goods" && (
              <Button variant="outline" onClick={() => simulateAll.mutate(deal.id)} disabled={simulateAll.isPending}>
                <FlaskConical className="w-4 h-4 ml-2" />
                🧪 محاكاة كل المراحل
              </Button>
            )}
          </div>

          {!allRequiredDone && (
            <p className="text-xs text-destructive">⚠️ أكمل جميع عناصر القائمة المطلوبة (*) قبل تقديم التقرير</p>
          )}
        </div>
      )}
    </div>
  );
};

export default LogisticsDealCard;
