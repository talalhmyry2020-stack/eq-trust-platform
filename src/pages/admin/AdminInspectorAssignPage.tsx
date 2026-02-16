import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { UserCheck, MapPin, Camera, CheckCircle, Image, Search, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const AdminInspectorAssignPage = () => {
  const queryClient = useQueryClient();
  const [assignDialog, setAssignDialog] = useState<any>(null);
  const [selectedInspector, setSelectedInspector] = useState("");
  const [factoryLat, setFactoryLat] = useState("");
  const [factoryLng, setFactoryLng] = useState("");
  const [factoryAddress, setFactoryAddress] = useState("");
  const [factoryCountry, setFactoryCountry] = useState("");
  const [galleryMission, setGalleryMission] = useState<any>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [assignMode, setAssignMode] = useState<"test" | "official">("official");

  // بحث تلقائي عن الإحداثيات من العنوان
  const lookupCoordinates = async () => {
    const query = [factoryAddress, factoryCountry].filter(Boolean).join(", ");
    if (!query) {
      toast({ title: "أدخل العنوان أو الدولة أولاً", variant: "destructive" });
      return;
    }
    setGeoLoading(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
      const data = await res.json();
      if (data?.length > 0) {
        setFactoryLat(data[0].lat);
        setFactoryLng(data[0].lon);
        toast({ title: "تم تحديد الموقع بنجاح", description: data[0].display_name });
      } else {
        toast({ title: "لم يتم العثور على الموقع", description: "حاول تعديل العنوان", variant: "destructive" });
      }
    } catch {
      toast({ title: "خطأ في البحث", variant: "destructive" });
    } finally {
      setGeoLoading(false);
    }
  };

  // صفقات تحتاج تعيين مفتش (بعد الموافقة على الإيداع)
  const { data: dealsNeedingInspector = [] } = useQuery({
    queryKey: ["deals-needing-inspector"],
    queryFn: async () => {
      const { data: deals } = await supabase
        .from("deals")
        .select("id, title, deal_number, client_full_name, current_phase, import_country, country, city")
        .eq("current_phase", "deposit_approved")
        .order("created_at", { ascending: false });

      if (!deals?.length) return [];

      const dealIds = deals.map(d => d.id);
      // جلب بيانات التفاوض المقبولة لكل صفقة
      const { data: negotiations } = await supabase
        .from("deal_negotiations")
        .select("deal_id, factory_name, factory_country, factory_email, factory_phone")
        .in("deal_id", dealIds)
        .eq("status", "accepted");

      return deals.map(d => {
        const neg = negotiations?.find(n => n.deal_id === d.id);
        return { ...d, negotiation: neg || null };
      });
    },
  });

  // جلب المفتشين (موظفين بصلاحية capture_evidence)
  const { data: inspectors = [] } = useQuery({
    queryKey: ["inspectors-list"],
    queryFn: async () => {
      const { data: perms } = await supabase
        .from("employee_permissions")
        .select("user_id")
        .eq("permission", "capture_evidence");

      if (!perms?.length) return [];
      const ids = perms.map((p) => p.user_id);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", ids);

      const { data: details } = await supabase
        .from("employee_details")
        .select("user_id, country, job_title")
        .in("user_id", ids);

      return (profiles || []).map((p) => {
        const det = details?.find((d) => d.user_id === p.user_id);
        return { ...p, country: det?.country || "", job_title: det?.job_title || "" };
      });
    },
  });

  // جلب المهام مع اسم المفتش
  const { data: missions = [] } = useQuery({
    queryKey: ["all-missions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("deal_inspection_missions")
        .select("*, deals(title, deal_number, client_full_name)")
        .order("created_at", { ascending: false });

      if (!data?.length) return [];
      const inspectorIds = [...new Set(data.map(m => m.inspector_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", inspectorIds);

      return data.map(m => ({
        ...m,
        inspector_name: profiles?.find(p => p.user_id === m.inspector_id)?.full_name || "غير معروف",
      }));
    },
  });

  // جلب صور المهمة
  const { data: missionPhotos = [] } = useQuery({
    queryKey: ["mission-photos", galleryMission?.id],
    queryFn: async () => {
      if (!galleryMission) return [];
      const { data } = await supabase
        .from("deal_inspection_photos")
        .select("*")
        .eq("mission_id", galleryMission.id)
        .order("captured_at");
      return data || [];
    },
    enabled: !!galleryMission,
  });

  const assignMission = useMutation({
    mutationFn: async () => {
      if (!assignDialog || !selectedInspector || !factoryLat || !factoryLng) throw new Error("Missing fields");

      const { error } = await supabase.from("deal_inspection_missions").insert({
        deal_id: assignDialog.id,
        inspector_id: selectedInspector,
        factory_latitude: parseFloat(factoryLat),
        factory_longitude: parseFloat(factoryLng),
        factory_address: factoryAddress,
        factory_country: factoryCountry,
        assigned_by: (await supabase.auth.getUser()).data.user?.id,
      });
      if (error) throw error;

      // تحديث مرحلة الصفقة
      await supabase.from("deals").update({ current_phase: "inspection_assigned" }).eq("id", assignDialog.id);

      // إشعار المفتش
      await supabase.from("notifications").insert({
        user_id: selectedInspector,
        title: "مهمة فحص جديدة",
        message: `تم تكليفك بمهمة فحص للصفقة #${assignDialog.deal_number}. يرجى التوجه للموقع المحدد.`,
        type: "inspection",
        entity_type: "deal",
        entity_id: assignDialog.id,
      });
    },
    onSuccess: () => {
      toast({ title: "تم تعيين المفتش بنجاح" });
      setAssignDialog(null);
      setSelectedInspector("");
      setFactoryLat("");
      setFactoryLng("");
      setFactoryAddress("");
      setFactoryCountry("");
      queryClient.invalidateQueries({ queryKey: ["deals-needing-inspector"] });
      queryClient.invalidateQueries({ queryKey: ["all-missions"] });
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const activeMissions = missions.filter((m: any) => m.status === "assigned" || m.status === "in_progress");
  const completedMissions = missions.filter((m: any) => m.status === "completed");

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <UserCheck className="w-7 h-7 text-primary" />
        <h1 className="font-heading text-2xl font-bold">المفتشون الميدانيون</h1>
      </div>

      <Tabs defaultValue="assign" dir="rtl">
        <TabsList>
          <TabsTrigger value="assign">تعيين مفتش ({dealsNeedingInspector.length})</TabsTrigger>
          <TabsTrigger value="active">مهام نشطة ({activeMissions.length})</TabsTrigger>
          <TabsTrigger value="completed">مكتملة ({completedMissions.length})</TabsTrigger>
          <TabsTrigger value="gallery">معرض الصور</TabsTrigger>
        </TabsList>

        <TabsContent value="assign" className="space-y-3 mt-4">
          {dealsNeedingInspector.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">لا توجد صفقات تحتاج تعيين مفتش</p>
          ) : dealsNeedingInspector.map((deal: any) => (
            <div key={deal.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">صفقة #{deal.deal_number} — {deal.title}</p>
                <p className="text-sm text-muted-foreground">{deal.client_full_name}</p>
                {deal.negotiation && (
                  <p className="text-sm text-primary">🏭 {deal.negotiation.factory_name} — {deal.negotiation.factory_country}</p>
                )}
              </div>
              <Button size="sm" onClick={() => {
                  setAssignDialog(deal);
                  setFactoryCountry(deal.negotiation?.factory_country || deal.import_country || deal.country || "");
                  setFactoryAddress(deal.city || "");
                  setFactoryLat("");
                  setFactoryLng("");
                  setSelectedInspector("");
                }}>
                <MapPin className="w-4 h-4 ml-2" />
                تعيين مفتش
              </Button>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="active" className="space-y-3 mt-4">
          {activeMissions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">لا توجد مهام نشطة</p>
           ) : activeMissions.map((m: any) => (
            <div key={m.id} className="p-4 border rounded-lg">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <p className="font-medium">صفقة #{m.deals?.deal_number} — {m.deals?.title}</p>
                  <p className="text-sm text-primary">👤 المفتش: <span className="font-bold">{m.inspector_name}</span></p>
                  <p className="text-sm text-muted-foreground">📍 {m.factory_address || "—"} ({m.factory_country})</p>
                  <p className="text-sm text-muted-foreground">📸 الحد الأقصى: {m.max_photos} صور</p>
                  <p className="text-xs text-muted-foreground">🌐 {m.factory_latitude?.toFixed(4)}, {m.factory_longitude?.toFixed(4)}</p>
                </div>
                <Badge variant={m.status === "in_progress" ? "default" : "secondary"}>
                  {m.status === "in_progress" ? "قيد التنفيذ" : "معيّن"}
                </Badge>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="completed" className="space-y-3 mt-4">
          {completedMissions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">لا توجد مهام مكتملة</p>
          ) : completedMissions.map((m: any) => (
            <div key={m.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">صفقة #{m.deals?.deal_number}</p>
                <p className="text-sm text-muted-foreground">{m.factory_address}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setGalleryMission(m)}>
                <Image className="w-4 h-4 ml-2" />
                عرض الصور
              </Button>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="gallery" className="mt-4">
          {completedMissions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">لا توجد صور حالياً</p>
          ) : (
            <div className="space-y-4">
              {completedMissions.map((m: any) => (
                <Card key={m.id} className="cursor-pointer hover:border-primary/50 transition" onClick={() => setGalleryMission(m)}>
                  <CardContent className="pt-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium">📸 صفقة #{m.deals?.deal_number} — {m.deals?.title}</p>
                      <p className="text-sm text-muted-foreground">{m.factory_country} — {m.factory_address}</p>
                    </div>
                    <Camera className="w-5 h-5 text-muted-foreground" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* تعيين مفتش */}
      <Dialog open={!!assignDialog} onOpenChange={() => setAssignDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>تعيين مفتش ميداني — صفقة #{assignDialog?.deal_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* وضع التعيين */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant={assignMode === "official" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setAssignMode("official")}
              >
                🏢 رسمي
              </Button>
              <Button
                type="button"
                variant={assignMode === "test" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => {
                  setAssignMode("test");
                  // تعبئة تلقائية بموقع تجريبي (دمياط)
                  setFactoryCountry("مصر");
                  setFactoryAddress("دمياط، مصر");
                  setFactoryLat("31.4175");
                  setFactoryLng("31.8144");
                }}
              >
                🧪 تجريبي
              </Button>
            </div>

            {assignMode === "test" && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm text-amber-700 dark:text-amber-400">
                ⚠️ وضع تجريبي — الموقع: دمياط، مصر (31.4175, 31.8144). اختر مفتشاً فقط.
              </div>
            )}

            <div>
              <Label>اختيار المفتش</Label>
              <Select value={selectedInspector} onValueChange={setSelectedInspector}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="اختر مفتشاً..." />
                </SelectTrigger>
                <SelectContent>
                  {inspectors.map((ins: any) => (
                    <SelectItem key={ins.user_id} value={ins.user_id}>
                      {ins.full_name} {ins.country ? `(${ins.country})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {assignMode === "official" && (
              <>
                <div>
                  <Label>دولة المصنع</Label>
                  <Input value={factoryCountry} onChange={(e) => setFactoryCountry(e.target.value)} placeholder="مثال: الصين" className="mt-1" />
                </div>
                <div>
                  <Label>عنوان المصنع</Label>
                  <Input value={factoryAddress} onChange={(e) => setFactoryAddress(e.target.value)} placeholder="العنوان الكامل..." className="mt-1" />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={lookupCoordinates} disabled={geoLoading} className="w-full">
                  {geoLoading ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Search className="w-4 h-4 ml-2" />}
                  بحث تلقائي عن الإحداثيات
                </Button>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>خط العرض (Latitude)</Label>
                    <Input value={factoryLat} onChange={(e) => setFactoryLat(e.target.value)} placeholder="31.2304" className="mt-1" />
                  </div>
                  <div>
                    <Label>خط الطول (Longitude)</Label>
                    <Input value={factoryLng} onChange={(e) => setFactoryLng(e.target.value)} placeholder="121.4737" className="mt-1" />
                  </div>
                </div>
              </>
            )}

            {assignMode === "test" && (
              <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
                <p>🌍 الدولة: <span className="font-bold">{factoryCountry}</span></p>
                <p>📍 العنوان: <span className="font-bold">{factoryAddress}</span></p>
                <p>🗺️ الإحداثيات: <span className="font-mono">{factoryLat}, {factoryLng}</span></p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => assignMission.mutate()} disabled={!selectedInspector || !factoryLat || !factoryLng || assignMission.isPending}>
              <CheckCircle className="w-4 h-4 ml-2" />
              تعيين المفتش
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* معرض صور المهمة */}
      <Dialog open={!!galleryMission} onOpenChange={() => setGalleryMission(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>معرض صور الفحص — صفقة #{galleryMission?.deals?.deal_number}</DialogTitle>
          </DialogHeader>
          {missionPhotos.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">لا توجد صور بعد</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {missionPhotos.map((p: any) => (
                <div key={p.id} className="relative">
                  <img src={p.photo_url} alt="صورة فحص" className="w-full h-40 object-cover rounded-lg border" />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 rounded-b-lg">
                    📍 {p.latitude?.toFixed(4)}, {p.longitude?.toFixed(4)}
                  </div>
                  {p.ai_status && (
                    <Badge className="absolute top-1 right-1" variant={p.ai_status === "approved" ? "default" : "destructive"}>
                      {p.ai_status === "approved" ? "✓" : "⚠"}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminInspectorAssignPage;
