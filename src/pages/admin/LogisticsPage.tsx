import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Truck, Package, Ship, Camera, CheckCircle, ExternalLink } from "lucide-react";

const LogisticsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [trackingUrl, setTrackingUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [sealPhoto, setSealPhoto] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // جلب الصفقات في مرحلة اللوجستيك
  const { data: deals = [] } = useQuery({
    queryKey: ["logistics-deals"],
    queryFn: async () => {
      const { data } = await supabase
        .from("deals")
        .select("id, deal_number, title, current_phase, client_full_name, estimated_amount, shipping_tracking_url")
        .eq("status", "active")
        .in("current_phase", ["logistics_handoff", "shipping_documented", "in_transit"])
        .order("updated_at", { ascending: false });
      return data || [];
    },
    refetchInterval: 10000,
  });

  const documentShipment = useMutation({
    mutationFn: async (dealId: string) => {
      if (!trackingUrl.trim()) throw new Error("رابط التتبع مطلوب");
      setUploading(true);

      // رفع صورة الختم إن وجدت
      let sealPhotoUrl = "";
      if (sealPhoto) {
        const filePath = `logistics/${dealId}/${Date.now()}_seal.jpg`;
        const { error } = await supabase.storage.from("inspection-photos").upload(filePath, sealPhoto);
        if (!error) {
          const { data: urlData } = supabase.storage.from("inspection-photos").getPublicUrl(filePath);
          sealPhotoUrl = urlData.publicUrl;
        }
      }

      // استدعاء Edge Function
      const { error } = await supabase.functions.invoke("process-post-inspection", {
        body: {
          deal_id: dealId,
          action: "logistics_documented",
          data: { tracking_url: trackingUrl, seal_confirmed: true, seal_photo_url: sealPhotoUrl, notes },
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "✅ تم توثيق الشحنة بنجاح" });
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

  const markInTransit = useMutation({
    mutationFn: async (dealId: string) => {
      const { error } = await supabase.functions.invoke("process-post-inspection", {
        body: { deal_id: dealId, action: "in_transit" },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "✅ تم تأكيد شحن البضاعة — في البحر" });
      queryClient.invalidateQueries({ queryKey: ["logistics-deals"] });
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const handoffDeals = deals.filter((d: any) => d.current_phase === "logistics_handoff");
  const documentedDeals = deals.filter((d: any) => d.current_phase === "shipping_documented");
  const transitDeals = deals.filter((d: any) => d.current_phase === "in_transit");

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Truck className="w-7 h-7 text-primary" />
        <h1 className="font-heading text-2xl font-bold">إدارة اللوجستيك والشحن</h1>
      </div>

      {/* إحصائيات */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <Package className="w-6 h-6 mx-auto mb-1 text-yellow-500" />
            <p className="text-2xl font-bold">{handoffDeals.length}</p>
            <p className="text-xs text-muted-foreground">بانتظار التوثيق</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Camera className="w-6 h-6 mx-auto mb-1 text-blue-500" />
            <p className="text-2xl font-bold">{documentedDeals.length}</p>
            <p className="text-xs text-muted-foreground">موثقة</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Ship className="w-6 h-6 mx-auto mb-1 text-green-500" />
            <p className="text-2xl font-bold">{transitDeals.length}</p>
            <p className="text-xs text-muted-foreground">في البحر</p>
          </CardContent>
        </Card>
      </div>

      {/* بانتظار التوثيق */}
      {handoffDeals.length > 0 && (
        <Card className="mb-6 border-yellow-500/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="w-5 h-5 text-yellow-500" />
              شحنات بانتظار التوثيق
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {handoffDeals.map((deal: any) => (
              <div key={deal.id} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">صفقة #{deal.deal_number} — {deal.title}</p>
                    <p className="text-sm text-muted-foreground">العميل: {deal.client_full_name}</p>
                  </div>
                  <Badge variant="secondary">بانتظار التوثيق</Badge>
                </div>
                <div className="grid gap-3">
                  <div>
                    <label className="text-sm font-medium block mb-1">رابط تتبع الشحنة *</label>
                    <Input
                      value={trackingUrl}
                      onChange={(e) => setTrackingUrl(e.target.value)}
                      placeholder="https://track.example.com/..."
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">صورة ختم الشحنة</label>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setSealPhoto(e.target.files?.[0] || null)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">ملاحظات التقرير</label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="حالة البضاعة، ملاحظات..."
                      rows={2}
                    />
                  </div>
                  <Button
                    onClick={() => documentShipment.mutate(deal.id)}
                    disabled={!trackingUrl.trim() || uploading}
                  >
                    <CheckCircle className="w-4 h-4 ml-2" />
                    {uploading ? "جاري التوثيق..." : "توثيق الشحنة وتأكيد السلامة"}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* موثقة — بانتظار إرسال */}
      {documentedDeals.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Camera className="w-5 h-5 text-blue-500" />
              شحنات موثقة — بانتظار الإرسال
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {documentedDeals.map((deal: any) => (
              <div key={deal.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">#{deal.deal_number} — {deal.title}</p>
                  {deal.shipping_tracking_url && (
                    <a href={deal.shipping_tracking_url} target="_blank" className="text-primary text-sm flex items-center gap-1">
                      رابط التتبع <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={() => markInTransit.mutate(deal.id)}
                  disabled={markInTransit.isPending}
                >
                  <Ship className="w-4 h-4 ml-2" />
                  تأكيد الشحن — البضاعة في البحر
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* في البحر */}
      {transitDeals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Ship className="w-5 h-5 text-green-500" />
              شحنات في البحر
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {transitDeals.map((deal: any) => (
              <div key={deal.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">#{deal.deal_number} — {deal.title}</p>
                  <p className="text-sm text-muted-foreground">العميل: {deal.client_full_name}</p>
                </div>
                <div className="flex items-center gap-2">
                  {deal.shipping_tracking_url && (
                    <a href={deal.shipping_tracking_url} target="_blank" className="text-primary text-sm flex items-center gap-1">
                      تتبع <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  <Badge>🚢 في البحر</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {deals.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Truck className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>لا توجد شحنات حالياً</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LogisticsPage;
