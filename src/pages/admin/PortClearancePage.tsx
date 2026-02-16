import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Anchor, Ship, CheckCircle, FileText, AlertTriangle, Timer } from "lucide-react";

const PortClearancePage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [report, setReport] = useState("");
  const [arrivalPhotos, setArrivalPhotos] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);

  // جلب الصفقات الواصلة للميناء
  const { data: deals = [] } = useQuery({
    queryKey: ["port-clearance-deals"],
    queryFn: async () => {
      const { data } = await supabase
        .from("deals")
        .select("id, deal_number, title, current_phase, client_full_name, estimated_amount, shipping_tracking_url, sovereignty_timer_start, sovereignty_timer_end")
        .eq("status", "active")
        .in("current_phase", [
          "in_transit", "port_inspection_assigned", "port_inspection_complete",
          "sovereignty_timer", "shipping_documented"
        ])
        .order("updated_at", { ascending: false });
      return data || [];
    },
    refetchInterval: 10000,
  });

  // تأكيد وصول البضاعة وتقديم التقرير
  const confirmArrival = useMutation({
    mutationFn: async (dealId: string) => {
      if (!report.trim()) throw new Error("يجب كتابة تقرير الوصول");
      setUploading(true);

      // رفع صور الوصول
      const photoUrls: string[] = [];
      if (arrivalPhotos) {
        for (let i = 0; i < arrivalPhotos.length; i++) {
          const file = arrivalPhotos[i];
          const filePath = `port-clearance/${dealId}/${Date.now()}_${i}.jpg`;
          const { error } = await supabase.storage.from("inspection-photos").upload(filePath, file);
          if (!error) {
            const { data: urlData } = supabase.storage.from("inspection-photos").getPublicUrl(filePath);
            photoUrls.push(urlData.publicUrl);
          }
        }
      }

      // تشغيل العداد السيادي عبر Edge Function
      const { error } = await supabase.functions.invoke("process-post-inspection", {
        body: {
          deal_id: dealId,
          action: "port_inspection_complete",
          data: { report, photos: photoUrls },
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "✅ تم تأكيد الوصول — بدأ العداد السيادي 168 ساعة" });
      setReport("");
      setArrivalPhotos(null);
      setUploading(false);
      queryClient.invalidateQueries({ queryKey: ["port-clearance-deals"] });
    },
    onError: (err: any) => {
      setUploading(false);
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const awaitingDeals = deals.filter((d: any) =>
    ["in_transit", "port_inspection_assigned", "shipping_documented"].includes(d.current_phase)
  );
  const timerDeals = deals.filter((d: any) =>
    ["port_inspection_complete", "sovereignty_timer"].includes(d.current_phase)
  );

  return (
    <div>
      {/* هوية المخلّص */}
      <div className="mb-6 p-4 rounded-xl border border-cyan-500/30 bg-cyan-500/5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center">
            <Anchor className="w-6 h-6 text-cyan-500" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold">مخلّص الميناء</h1>
            <p className="text-sm text-muted-foreground italic">"نؤكد وصول البضاعة سليمة.. وتقريرنا يُشغّل العداد السيادي"</p>
          </div>
          <Badge className="mr-auto bg-cyan-500/20 text-cyan-600 border-cyan-500/30">تخليص</Badge>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
          <span>⚓ تأكيد الوصول</span>
          <span>📋 تقرير حالة البضاعة</span>
          <span>⏱️ تشغيل العداد السيادي</span>
        </div>
      </div>

      {/* إحصائيات */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <Ship className="w-6 h-6 mx-auto mb-1 text-blue-500" />
            <p className="text-2xl font-bold">{awaitingDeals.length}</p>
            <p className="text-xs text-muted-foreground">بانتظار الوصول</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Timer className="w-6 h-6 mx-auto mb-1 text-green-500" />
            <p className="text-2xl font-bold">{timerDeals.length}</p>
            <p className="text-xs text-muted-foreground">عداد سيادي نشط</p>
          </CardContent>
        </Card>
      </div>

      {/* شحنات بانتظار التأكيد */}
      {awaitingDeals.length > 0 && (
        <Card className="mb-6 border-blue-500/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Ship className="w-5 h-5 text-blue-500" />
              شحنات بانتظار تأكيد الوصول
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {awaitingDeals.map((deal: any) => (
              <div key={deal.id} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">صفقة #{deal.deal_number} — {deal.title}</p>
                    <p className="text-sm text-muted-foreground">العميل: {deal.client_full_name}</p>
                  </div>
                  <Badge variant="secondary">{deal.current_phase === "in_transit" ? "في البحر" : "بانتظار الفحص"}</Badge>
                </div>
                <div className="grid gap-3">
                  <div>
                    <label className="text-sm font-medium block mb-1">تقرير حالة البضاعة عند الوصول *</label>
                    <Textarea
                      value={report}
                      onChange={(e) => setReport(e.target.value)}
                      placeholder="حالة الحاوية، الأختام، عدد الطرود، أي تلف ظاهري..."
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">صور الوصول والتفريغ</label>
                    <Input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => setArrivalPhotos(e.target.files)}
                    />
                  </div>
                  <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                    <div className="flex items-center gap-2 text-sm">
                      <AlertTriangle className="w-4 h-4 text-yellow-600" />
                      <span className="font-medium text-yellow-700">تنبيه: بمجرد تقديم التقرير سيبدأ العداد السيادي (168 ساعة)</span>
                    </div>
                  </div>
                  <Button
                    onClick={() => confirmArrival.mutate(deal.id)}
                    disabled={!report.trim() || uploading}
                    className="bg-cyan-600 hover:bg-cyan-700"
                  >
                    <CheckCircle className="w-4 h-4 ml-2" />
                    {uploading ? "جاري الإرسال..." : "تأكيد الوصول وتقديم التقرير"}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* عداد سيادي نشط */}
      {timerDeals.length > 0 && (
        <Card className="border-green-500/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Timer className="w-5 h-5 text-green-500" />
              صفقات بعداد سيادي نشط
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {timerDeals.map((deal: any) => {
              const end = deal.sovereignty_timer_end ? new Date(deal.sovereignty_timer_end) : null;
              const now = new Date();
              const remaining = end ? Math.max(0, end.getTime() - now.getTime()) : 0;
              const hours = Math.floor(remaining / (1000 * 60 * 60));
              const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

              return (
                <div key={deal.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">#{deal.deal_number} — {deal.title}</p>
                    <p className="text-sm text-muted-foreground">العميل: {deal.client_full_name}</p>
                  </div>
                  <div className="text-left">
                    <Badge className="bg-green-500/20 text-green-600 border-green-500/30">
                      ⏱️ {hours}س {minutes}د متبقية
                    </Badge>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {deals.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Anchor className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>لا توجد شحنات واصلة حالياً</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PortClearancePage;
