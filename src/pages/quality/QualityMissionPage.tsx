import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { MapPin, Camera, CheckCircle, Navigation, AlertTriangle, FlaskConical, ShieldCheck } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const QualityMissionPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState("");
  const [isInRange, setIsInRange] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [photosTaken, setPhotosTaken] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [inspectionReport, setInspectionReport] = useState("");
  const [showReportForm, setShowReportForm] = useState(false);
  const [testMode, setTestMode] = useState(true);
  const [generatingTestPhotos, setGeneratingTestPhotos] = useState(false);

  const { data: missions = [], refetch } = useQuery({
    queryKey: ["quality-active-missions", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("deal_inspection_missions")
        .select("*, deals(title, deal_number, client_full_name)")
        .eq("inspector_id", user!.id)
        .in("status", ["assigned", "in_progress"])
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const activeMission = missions.find((m: any) => m.status === "in_progress") || missions[0];

  const { data: existingPhotos = [] } = useQuery({
    queryKey: ["quality-mission-photos", activeMission?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("deal_inspection_photos")
        .select("id")
        .eq("mission_id", activeMission!.id);
      return data || [];
    },
    enabled: !!activeMission,
  });

  useEffect(() => {
    setPhotosTaken(existingPhotos.length);
  }, [existingPhotos]);

  const getDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, []);

  const startLocationTracking = useCallback(() => {
    if (testMode) {
      if (activeMission?.factory_latitude && activeMission?.factory_longitude) {
        setCurrentLocation({ lat: activeMission.factory_latitude + 0.0001, lng: activeMission.factory_longitude + 0.0001 });
        setIsInRange(true);
      }
      return;
    }
    if (!navigator.geolocation) {
      setLocationError("المتصفح لا يدعم تحديد الموقع");
      return;
    }
    navigator.geolocation.watchPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCurrentLocation(loc);
        setLocationError("");
        if (activeMission?.factory_latitude && activeMission?.factory_longitude) {
          const dist = getDistance(loc.lat, loc.lng, activeMission.factory_latitude, activeMission.factory_longitude);
          setIsInRange(dist <= (activeMission.geofence_radius_meters || 200));
        }
      },
      (err) => setLocationError("فشل تحديد الموقع: " + err.message),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
  }, [activeMission, getDistance, testMode]);

  const startMission = useMutation({
    mutationFn: async (missionId: string) => {
      await supabase.from("deal_inspection_missions").update({ status: "in_progress" }).eq("id", missionId);
      await supabase.from("deals").update({ current_phase: "quality_inspection_in_progress" }).eq("id", activeMission?.deal_id);
    },
    onSuccess: () => {
      startLocationTracking();
      refetch();
      toast({ title: `تم بدء مهمة فحص الجودة — ${testMode ? "الوضع التجريبي 🧪" : "الوضع الرسمي 🛡️"}` });
    },
  });

  const startCamera = async () => {
    if (testMode) {
      await generateTestPhotos();
      return;
    }
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      setStream(mediaStream);
      setCameraActive(true);
      if (videoRef.current) videoRef.current.srcObject = mediaStream;
    } catch {
      toast({ title: "خطأ", description: "فشل تشغيل الكاميرا", variant: "destructive" });
    }
  };

  const generateTestPhotos = async () => {
    if (!activeMission || !user) return;
    setGeneratingTestPhotos(true);
    const maxPhotos = activeMission.max_photos || 10;
    const baseLat = activeMission.factory_latitude || 30.01;
    const baseLng = activeMission.factory_longitude || 31.19;

    try {
      for (let i = 0; i < maxPhotos; i++) {
        const lat = baseLat + (Math.random() - 0.5) * 0.002;
        const lng = baseLng + (Math.random() - 0.5) * 0.002;
        const filePath = `${user.id}/${activeMission.id}/quality_test_${Date.now()}_${i}.jpg`;

        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = `hsl(${140 + Math.random() * 40}, 50%, 70%)`;
        ctx.fillRect(0, 0, 640, 480);
        ctx.fillStyle = "#000";
        ctx.font = "bold 24px monospace";
        ctx.fillText(`🔍 فحص جودة — صورة #${i + 1}`, 100, 200);
        ctx.fillText(`📍 ${lat.toFixed(4)}, ${lng.toFixed(4)}`, 150, 240);
        ctx.fillText(`🕐 ${new Date().toLocaleString("ar-SA")}`, 150, 280);

        const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.9));
        await supabase.storage.from("inspection-photos").upload(filePath, blob);
        const { data: urlData } = supabase.storage.from("inspection-photos").getPublicUrl(filePath);

        await supabase.from("deal_inspection_photos").insert({
          mission_id: activeMission.id,
          deal_id: activeMission.deal_id,
          photo_url: urlData.publicUrl,
          latitude: lat,
          longitude: lng,
        });

        setPhotosTaken(i + 1);
        await new Promise((r) => setTimeout(r, 300));
      }

      toast({ title: `✅ تم توليد ${maxPhotos} صور — اكتب تقرير الجودة الآن` });
      setShowReportForm(true);
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingTestPhotos(false);
    }
  };

  const capturePhoto = useMutation({
    mutationFn: async () => {
      if (!videoRef.current || !canvasRef.current || !activeMission || !currentLocation) throw new Error("غير جاهز");
      if (photosTaken >= (activeMission.max_photos || 10)) throw new Error("تم بلوغ الحد الأقصى");

      setUploading(true);
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(video, 0, 0);

      // ختم الجودة
      ctx.fillStyle = "rgba(0,100,0,0.7)";
      ctx.fillRect(0, canvas.height - 60, canvas.width, 60);
      ctx.fillStyle = "#fff";
      ctx.font = "16px monospace";
      ctx.fillText(`🔍 فحص جودة | 📍 ${currentLocation.lat.toFixed(6)}, ${currentLocation.lng.toFixed(6)}`, 10, canvas.height - 35);
      ctx.fillText(`🕐 ${new Date().toLocaleString("ar-SA")}`, 10, canvas.height - 12);

      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.9));
      const filePath = `${user!.id}/${activeMission.id}/quality_${Date.now()}.jpg`;
      const { error: uploadErr } = await supabase.storage.from("inspection-photos").upload(filePath, blob);
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from("inspection-photos").getPublicUrl(filePath);

      await supabase.from("deal_inspection_photos").insert({
        mission_id: activeMission.id,
        deal_id: activeMission.deal_id,
        photo_url: urlData.publicUrl,
        latitude: currentLocation.lat,
        longitude: currentLocation.lng,
      });
    },
    onSuccess: () => {
      setPhotosTaken((p) => p + 1);
      setUploading(false);
      toast({ title: `تم التقاط الصورة (${photosTaken + 1}/${activeMission?.max_photos || 10})` });
      queryClient.invalidateQueries({ queryKey: ["quality-mission-photos"] });

      if (photosTaken + 1 >= (activeMission?.max_photos || 10)) {
        setShowReportForm(true);
        stream?.getTracks().forEach((t) => t.stop());
        setStream(null);
        setCameraActive(false);
        toast({ title: "✅ اكتمل التصوير — اكتب تقرير الجودة لإنهاء المهمة" });
      }
    },
    onError: (err: any) => {
      setUploading(false);
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const completeMission = useMutation({
    mutationFn: async () => {
      if (!activeMission) return;
      if (!inspectionReport.trim()) throw new Error("يرجى كتابة تقرير فحص الجودة قبل الإنهاء");

      stream?.getTracks().forEach((t) => t.stop());
      setStream(null);
      setCameraActive(false);

      await supabase.from("deal_inspection_missions").update({
        status: "completed",
        completed_at: new Date().toISOString(),
        quality_report: inspectionReport,
        quality_status: "approved",
      }).eq("id", activeMission.id);

      // تحديث مرحلة الصفقة + إطلاق Token B
      try {
        await supabase.functions.invoke("process-post-inspection", {
          body: { deal_id: activeMission.deal_id, action: "quality_approved" },
        });
      } catch (e) {
        console.error("Quality post-processing failed:", e);
      }

      if (activeMission.assigned_by) {
        await supabase.from("notifications").insert({
          user_id: activeMission.assigned_by,
          title: "شهادة سلامة فنية ✅",
          message: `أصدر وكيل الجودة شهادة السلامة الفنية للصفقة #${(activeMission as any).deals?.deal_number}. ${photosTaken} صور + تقرير مرفق.`,
          type: "inspection",
          entity_type: "deal",
          entity_id: activeMission.deal_id,
        });
      }
    },
    onSuccess: () => {
      toast({ title: "✅ تم إصدار شهادة السلامة الفنية بنجاح!" });
      setShowReportForm(false);
      setInspectionReport("");
      refetch();
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  if (missions.length === 0) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <ShieldCheck className="w-7 h-7 text-emerald-600" />
          <h1 className="font-heading text-2xl font-bold">مهام فحص الجودة</h1>
        </div>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            لا توجد مهام فحص جودة مسندة إليك حالياً
          </CardContent>
        </Card>
      </div>
    );
  }

  const mission = activeMission;
  const maxPhotos = mission?.max_photos || 10;
  const missionStarted = mission?.status === "in_progress";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-7 h-7 text-emerald-600" />
          <h1 className="font-heading text-2xl font-bold">مهمة فحص الجودة</h1>
        </div>
        {!missionStarted && (
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
            <div className="flex items-center gap-2">
              {testMode ? (
                <FlaskConical className="w-5 h-5 text-amber-500" />
              ) : (
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
              )}
              <Label htmlFor="test-mode" className="text-sm font-medium cursor-pointer">
                {testMode ? "وضع تجريبي 🧪" : "وضع رسمي 🛡️"}
              </Label>
            </div>
            <Switch id="test-mode" checked={testMode} onCheckedChange={setTestMode} />
          </div>
        )}
      </div>

      {!missionStarted && (
        <div className={`mb-4 p-3 rounded-lg border text-sm ${testMode ? "bg-amber-500/10 border-amber-500/30 text-amber-700" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-700"}`}>
          {testMode ? (
            <div className="flex items-center gap-2">
              <FlaskConical className="w-4 h-4" />
              <span><strong>الوضع التجريبي:</strong> سيتم محاكاة الموقع وتوليد صور اختبارية.</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              <span><strong>الوضع الرسمي:</strong> يتطلب التواجد الفعلي في المصنع + كاميرا حقيقية + ختم GPS.</span>
            </div>
          )}
        </div>
      )}

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>صفقة #{mission?.deals?.deal_number} — {(mission as any)?.deals?.client_full_name || ""}</span>
            <Badge variant={missionStarted ? "default" : "secondary"}>
              {missionStarted ? "قيد التنفيذ" : "معيّنة"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">📍 موقع المصنع</p>
              <p className="font-medium">{mission?.factory_address || "غير محدد"}</p>
              <p className="text-xs text-muted-foreground">
                {mission?.factory_latitude?.toFixed(4)}, {mission?.factory_longitude?.toFixed(4)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">🌍 الدولة</p>
              <p className="font-medium">{mission?.factory_country || "—"}</p>
            </div>
          </div>

          {/* حالة الموقع */}
          {missionStarted && (
            <div className={`p-3 rounded-lg border ${isInRange ? "bg-emerald-500/10 border-emerald-500/30" : "bg-destructive/10 border-destructive/30"}`}>
              {currentLocation ? (
                <div className="flex items-center gap-2">
                  {isInRange ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                      <span className="text-emerald-600 font-medium">
                        {testMode ? "✓ موقع محاكى — داخل النطاق" : "أنت داخل النطاق الجغرافي للمصنع ✓"}
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-5 h-5 text-destructive" />
                      <span className="text-destructive font-medium">أنت خارج النطاق — الكاميرا مقفلة</span>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Navigation className="w-5 h-5 animate-pulse text-emerald-600" />
                  <span>جاري تحديد موقعك...</span>
                </div>
              )}
              {locationError && <p className="text-destructive text-sm mt-1">{locationError}</p>}
            </div>
          )}

          {/* تقدم الصور */}
          {missionStarted && (
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>صور المطابقة</span>
                <span className="font-bold">{photosTaken}/{maxPhotos}</span>
              </div>
              <Progress value={(photosTaken / maxPhotos) * 100} />
            </div>
          )}

          {/* أزرار التحكم */}
          <div className="flex gap-3 flex-wrap">
            {!missionStarted && (
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => startMission.mutate(mission!.id)}>
                بدء فحص الجودة
              </Button>
            )}
            {missionStarted && isInRange && !showReportForm && !generatingTestPhotos && (
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={startCamera} disabled={photosTaken >= maxPhotos}>
                <Camera className="w-4 h-4 ml-2" />
                {testMode ? "توليد صور المطابقة" : "فتح الكاميرا"}
              </Button>
            )}
            {generatingTestPhotos && (
              <Button disabled>
                <span className="animate-spin ml-2">⏳</span>
                جاري توليد الصور...
              </Button>
            )}
          </div>

          {/* الكاميرا الحقيقية */}
          {cameraActive && !testMode && (
            <div className="space-y-3">
              <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg border" />
              <canvas ref={canvasRef} className="hidden" />
              <div className="flex gap-3">
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => capturePhoto.mutate()}
                  disabled={uploading || photosTaken >= maxPhotos}
                >
                  📸 التقاط صورة
                </Button>
                <Button variant="outline" onClick={() => { stream?.getTracks().forEach((t) => t.stop()); setStream(null); setCameraActive(false); }}>
                  إيقاف الكاميرا
                </Button>
              </div>
            </div>
          )}

          {/* نموذج التقرير */}
          {showReportForm && (
            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  تقرير شهادة السلامة الفنية
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  اكتب تقريراً مفصلاً عن مطابقة المنتج للعينة المرجعية. يشمل: اللون، الأبعاد، الجودة، أي ملاحظات فنية.
                </p>
                <Textarea
                  value={inspectionReport}
                  onChange={(e) => setInspectionReport(e.target.value)}
                  placeholder="مثال: المنتج مطابق للعينة المرجعية من حيث اللون (أبيض لؤلؤي) والأبعاد (120×80 سم). لا توجد عيوب ظاهرة. الخامة متينة ومطابقة للمواصفات المعتمدة..."
                  rows={6}
                />
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => completeMission.mutate()}
                  disabled={!inspectionReport.trim() || completeMission.isPending}
                >
                  {completeMission.isPending ? "جاري الإصدار..." : "✅ إصدار شهادة السلامة الفنية وإنهاء المهمة"}
                </Button>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default QualityMissionPage;
