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
import { MapPin, Camera, CheckCircle, Lock, Navigation, AlertTriangle, FileText, FlaskConical, Shield } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const InspectionMissionPage = () => {
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
    queryKey: ["my-missions", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("deal_inspection_missions")
        .select("*, deals(title, deal_number)")
        .eq("inspector_id", user!.id)
        .in("status", ["assigned", "in_progress"])
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const activeMission = missions.find((m: any) => m.status === "in_progress") || missions[0];

  const { data: existingPhotos = [] } = useQuery({
    queryKey: ["mission-photos-count", activeMission?.id],
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
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, []);

  const startLocationTracking = useCallback(() => {
    if (testMode) {
      // في الوضع التجريبي: محاكاة الموقع قرب المصنع
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
      await supabase.from("deals").update({ current_phase: "inspection_in_progress" }).eq("id", activeMission?.deal_id);
    },
    onSuccess: () => {
      startLocationTracking();
      refetch();
      toast({ title: `تم بدء المهمة — ${testMode ? "الوضع التجريبي 🧪" : "الوضع الرسمي 🛡️"}` });
    },
  });

  const startCamera = async () => {
    if (testMode) {
      // في الوضع التجريبي: توليد صور تجريبية مباشرة
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
    } catch (err) {
      toast({ title: "خطأ", description: "فشل تشغيل الكاميرا", variant: "destructive" });
    }
  };

  // توليد صور تجريبية
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
        const filePath = `${user.id}/${activeMission.id}/test_${Date.now()}_${i}.jpg`;

        // إنشاء صورة تجريبية بسيطة
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = `hsl(${Math.random() * 360}, 50%, 70%)`;
        ctx.fillRect(0, 0, 640, 480);
        ctx.fillStyle = "#000";
        ctx.font = "bold 24px monospace";
        ctx.fillText(`🧪 صورة تجريبية #${i + 1}`, 150, 200);
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

      toast({ title: `✅ تم توليد ${maxPhotos} صور تجريبية — اكتب التقرير الآن` });
      setShowReportForm(true);
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingTestPhotos(false);
    }
  };

  const capturePhoto = useMutation({
    mutationFn: async () => {
      if (!videoRef.current || !canvasRef.current || !activeMission || !currentLocation) throw new Error("Not ready");
      if (photosTaken >= (activeMission.max_photos || 10)) throw new Error("تم بلوغ الحد الأقصى للصور");

      setUploading(true);
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(video, 0, 0);
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(0, canvas.height - 60, canvas.width, 60);
      ctx.fillStyle = "#fff";
      ctx.font = "16px monospace";
      ctx.fillText(`📍 ${currentLocation.lat.toFixed(6)}, ${currentLocation.lng.toFixed(6)}`, 10, canvas.height - 35);
      ctx.fillText(`🕐 ${new Date().toLocaleString("ar-SA")}`, 10, canvas.height - 12);

      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.9));
      const filePath = `${user!.id}/${activeMission.id}/${Date.now()}.jpg`;
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
      queryClient.invalidateQueries({ queryKey: ["mission-photos-count"] });

      if (photosTaken + 1 >= (activeMission?.max_photos || 10)) {
        setShowReportForm(true);
        stream?.getTracks().forEach((t) => t.stop());
        setStream(null);
        setCameraActive(false);
        toast({ title: "✅ اكتمل التصوير — اكتب التقرير لإنهاء المهمة" });
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
      if (!inspectionReport.trim()) throw new Error("يرجى كتابة تقرير الفحص قبل الإنهاء");

      stream?.getTracks().forEach((t) => t.stop());
      setStream(null);
      setCameraActive(false);

      await supabase.from("deal_inspection_missions").update({
        status: "completed",
        completed_at: new Date().toISOString(),
        quality_report: inspectionReport,
        quality_status: "reviewed",
      }).eq("id", activeMission.id);

      await supabase.from("deals").update({ current_phase: "inspection_completed" }).eq("id", activeMission.deal_id);

      if (activeMission.assigned_by) {
        await supabase.from("notifications").insert({
          user_id: activeMission.assigned_by,
          title: "اكتمال مهمة الفحص + تقرير",
          message: `أكمل المفتش مهمة الفحص للصفقة #${activeMission.deals?.deal_number}. ${photosTaken} صور + تقرير مرفق.`,
          type: "inspection",
          entity_type: "deal",
          entity_id: activeMission.deal_id,
        });
      }

      if (activeMission.mission_type === "initial") {
        try {
          await supabase.functions.invoke("process-post-inspection", {
            body: { deal_id: activeMission.deal_id, action: "test_auto_token_a" },
          });
        } catch (e) {
          console.error("Auto Token A failed:", e);
        }
      }
    },
    onSuccess: () => {
      toast({ title: "✅ تم إنهاء المهمة بنجاح! تم رفع الصور والتقرير" });
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
          <Camera className="w-7 h-7 text-primary" />
          <h1 className="font-heading text-2xl font-bold">مهام الفحص</h1>
        </div>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            لا توجد مهام فحص مسندة إليك حالياً
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
          <Camera className="w-7 h-7 text-primary" />
          <h1 className="font-heading text-2xl font-bold">مهمة الفحص الميداني</h1>
        </div>
        {/* زر التبديل بين الوضع التجريبي والرسمي */}
        {!missionStarted && (
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
            <div className="flex items-center gap-2">
              {testMode ? (
                <FlaskConical className="w-5 h-5 text-amber-500" />
              ) : (
                <Shield className="w-5 h-5 text-green-600" />
              )}
              <Label htmlFor="test-mode" className="text-sm font-medium cursor-pointer">
                {testMode ? "وضع تجريبي 🧪" : "وضع رسمي 🛡️"}
              </Label>
            </div>
            <Switch
              id="test-mode"
              checked={testMode}
              onCheckedChange={setTestMode}
            />
          </div>
        )}
      </div>

      {/* تنبيه الوضع */}
      {!missionStarted && (
        <div className={`mb-4 p-3 rounded-lg border text-sm ${testMode ? "bg-amber-500/10 border-amber-500/30 text-amber-700" : "bg-green-500/10 border-green-500/30 text-green-700"}`}>
          {testMode ? (
            <div className="flex items-center gap-2">
              <FlaskConical className="w-4 h-4" />
              <span><strong>الوضع التجريبي:</strong> سيتم محاكاة الموقع تلقائياً وتوليد صور اختبارية بدون كاميرا حقيقية.</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span><strong>الوضع الرسمي:</strong> يتطلب التواجد الفعلي في موقع المصنع واستخدام الكاميرا الحقيقية.</span>
            </div>
          )}
        </div>
      )}

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>صفقة #{mission?.deals?.deal_number} — {mission?.deals?.title}</span>
            <div className="flex items-center gap-2">
              {missionStarted && (
                <Badge variant="outline" className={testMode ? "border-amber-500 text-amber-600" : "border-green-500 text-green-600"}>
                  {testMode ? "🧪 تجريبي" : "🛡️ رسمي"}
                </Badge>
              )}
              <Badge variant={missionStarted ? "default" : "secondary"}>
                {missionStarted ? "قيد التنفيذ" : "معيّنة"}
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">📍 الموقع المستهدف</p>
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
            <div className={`p-3 rounded-lg border ${isInRange ? "bg-green-500/10 border-green-500/30" : "bg-destructive/10 border-destructive/30"}`}>
              {currentLocation ? (
                <div className="flex items-center gap-2">
                  {isInRange ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <span className="text-green-600 font-medium">
                        {testMode ? "✓ موقع محاكى — داخل النطاق" : "أنت داخل النطاق الجغرافي للمصنع ✓"}
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-5 h-5 text-destructive" />
                      <span className="text-destructive font-medium">أنت خارج النطاق الجغرافي — الكاميرا مقفلة</span>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Navigation className="w-5 h-5 animate-pulse" />
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
                <span>الصور الملتقطة</span>
                <span>{photosTaken}/{maxPhotos}</span>
              </div>
              <Progress value={(photosTaken / maxPhotos) * 100} />
            </div>
          )}

          {/* أزرار التحكم */}
          {!missionStarted ? (
            <Button className="w-full" onClick={() => startMission.mutate(mission!.id)}>
              {testMode ? <FlaskConical className="w-4 h-4 ml-2" /> : <Navigation className="w-4 h-4 ml-2" />}
              {testMode ? "بدء المهمة (تجريبي)" : "بدء المهمة (رسمي)"}
            </Button>
          ) : showReportForm ? null : generatingTestPhotos ? (
            <div className="text-center py-4 space-y-2">
              <Progress value={(photosTaken / maxPhotos) * 100} />
              <p className="text-sm text-muted-foreground">جاري توليد الصور التجريبية... {photosTaken}/{maxPhotos}</p>
            </div>
          ) : isInRange && !cameraActive ? (
            <Button className="w-full" onClick={startCamera}>
              {testMode ? <FlaskConical className="w-4 h-4 ml-2" /> : <Camera className="w-4 h-4 ml-2" />}
              {testMode ? "توليد صور تجريبية" : "فتح الكاميرا"}
            </Button>
          ) : !isInRange && missionStarted && !testMode ? (
            <Button className="w-full" disabled>
              <Lock className="w-4 h-4 ml-2" />
              الكاميرا مقفلة — توجه للموقع
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {/* الكاميرا - الوضع الرسمي فقط */}
      {cameraActive && !testMode && (
        <Card>
          <CardContent className="pt-4 space-y-4">
            <div className="relative rounded-lg overflow-hidden bg-black">
              <video ref={videoRef} autoPlay playsInline className="w-full" />
              <canvas ref={canvasRef} className="hidden" />
            </div>
            <div className="flex gap-3">
              <Button
                className="flex-1"
                onClick={() => capturePhoto.mutate()}
                disabled={uploading || photosTaken >= maxPhotos}
              >
                <Camera className="w-4 h-4 ml-2" />
                {uploading ? "جاري الرفع..." : `التقاط صورة (${photosTaken}/${maxPhotos})`}
              </Button>
              {photosTaken > 0 && !showReportForm && (
                <Button variant="outline" onClick={() => { setShowReportForm(true); stream?.getTracks().forEach((t) => t.stop()); setStream(null); setCameraActive(false); }}>
                  <FileText className="w-4 h-4 ml-2" />
                  كتابة التقرير
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* نموذج التقرير — إلزامي بعد التصوير */}
      {showReportForm && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              تقرير الفحص الميداني
              <Badge variant="destructive" className="text-xs">إلزامي</Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground">اكتب تقريراً مفصلاً عن حالة المنتج — لن يمكنك إنهاء المهمة بدون تقرير</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={inspectionReport}
              onChange={(e) => setInspectionReport(e.target.value)}
              placeholder={`اكتب تقرير الفحص هنا...\nمثال:\n- حالة المنتج: جيدة / متوسطة / سيئة\n- التغليف: سليم / متضرر\n- الكمية المطابقة للطلب: نعم / لا\n- جودة التصنيع: ممتازة / مقبولة / رديئة\n- ملاحظات إضافية...`}
              className="min-h-[180px]"
              dir="rtl"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                📷 {photosTaken} صور مرفقة • {inspectionReport.trim().length > 0 ? "✅ التقرير جاهز" : "⚠️ التقرير مطلوب"}
              </p>
              <Button
                onClick={() => completeMission.mutate()}
                disabled={completeMission.isPending || !inspectionReport.trim()}
                size="lg"
              >
                <CheckCircle className="w-4 h-4 ml-2" />
                {completeMission.isPending ? "جاري الإرسال..." : "إرسال التقرير وإنهاء المهمة"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default InspectionMissionPage;
