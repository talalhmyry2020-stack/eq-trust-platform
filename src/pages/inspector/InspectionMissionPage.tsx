import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { MapPin, Camera, CheckCircle, Lock, Navigation, AlertTriangle, FileText } from "lucide-react";
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
  // جلب المهام المسندة للمفتش
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

  // جلب عدد الصور الحالية للمهمة النشطة
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

  // حساب المسافة بين نقطتين
  const getDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, []);

  // تتبع الموقع
  const startLocationTracking = useCallback(() => {
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
      (err) => {
        setLocationError("فشل تحديد الموقع: " + err.message);
      },
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
  }, [activeMission, getDistance]);

  // بدء المهمة
  const startMission = useMutation({
    mutationFn: async (missionId: string) => {
      await supabase.from("deal_inspection_missions").update({ status: "in_progress" }).eq("id", missionId);
      await supabase.from("deals").update({ current_phase: "inspection_in_progress" }).eq("id", activeMission?.deal_id);
    },
    onSuccess: () => {
      startLocationTracking();
      refetch();
      toast({ title: "تم بدء المهمة" });
    },
  });

  // تشغيل الكاميرا
  const startCamera = async () => {
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

  // التقاط صورة
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

      // إضافة ختم الموقع والوقت
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

      // عند بلوغ الحد الأقصى، أظهر نموذج التقرير
      if (photosTaken + 1 >= (activeMission?.max_photos || 10)) {
        setShowReportForm(true);
        stream?.getTracks().forEach((t) => t.stop());
        setStream(null);
        setCameraActive(false);
        toast({ title: "تم بلوغ الحد الأقصى للصور — اكتب التقرير لإنهاء المهمة" });
      }
    },
    onError: (err: any) => {
      setUploading(false);
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  // إنهاء المهمة
  const completeMission = useMutation({
    mutationFn: async () => {
      if (!activeMission) return;
      if (!inspectionReport.trim()) throw new Error("يرجى كتابة تقرير الفحص قبل الإنهاء");

      // إيقاف الكاميرا
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

      // إشعار المدير
      if (activeMission.assigned_by) {
        await supabase.from("notifications").insert({
          user_id: activeMission.assigned_by,
          title: "اكتمال مهمة الفحص + تقرير",
          message: `أكمل المفتش مهمة الفحص للصفقة #${activeMission.deals?.deal_number}. ${photosTaken + 1} صور + تقرير مرفق.`,
          type: "inspection",
          entity_type: "deal",
          entity_id: activeMission.deal_id,
        });
      }

      // 🧪 تجريبي: صرف Token A تلقائياً (30%) عند اكتمال الفحص الأولي
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
      toast({ title: "تم إنهاء المهمة بنجاح! تم رفع الصور والتقرير وصرف 30% للمورد تلقائياً 🧪" });
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
      <div className="flex items-center gap-3 mb-6">
        <Camera className="w-7 h-7 text-primary" />
        <h1 className="font-heading text-2xl font-bold">مهمة الفحص الميداني</h1>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>صفقة #{mission?.deals?.deal_number} — {mission?.deals?.title}</span>
            <Badge variant={missionStarted ? "default" : "secondary"}>
              {missionStarted ? "قيد التنفيذ" : "معيّنة"}
            </Badge>
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
                      <span className="text-green-600 font-medium">أنت داخل النطاق الجغرافي للمصنع ✓</span>
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
              <Navigation className="w-4 h-4 ml-2" />
              بدء المهمة
            </Button>
          ) : isInRange && !cameraActive ? (
            <Button className="w-full" onClick={startCamera}>
              <Camera className="w-4 h-4 ml-2" />
              فتح الكاميرا
            </Button>
          ) : !isInRange && missionStarted ? (
            <Button className="w-full" disabled>
              <Lock className="w-4 h-4 ml-2" />
              الكاميرا مقفلة — توجه للموقع
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {/* الكاميرا */}
      {cameraActive && (
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

      {/* نموذج التقرير */}
      {showReportForm && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              تقرير الفحص الميداني
            </CardTitle>
            <p className="text-xs text-muted-foreground">اكتب تقريراً مفصلاً عن حالة المنتج والملاحظات الميدانية</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={inspectionReport}
              onChange={(e) => setInspectionReport(e.target.value)}
              placeholder="اكتب تقرير الفحص هنا...&#10;مثال:&#10;- حالة المنتج: جيدة / متوسطة / سيئة&#10;- التغليف: سليم / متضرر&#10;- الكمية المطابقة: نعم / لا&#10;- ملاحظات إضافية..."
              className="min-h-[150px]"
              dir="rtl"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                📷 {photosTaken} صور مرفقة
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowReportForm(false)}>
                  رجوع للكاميرا
                </Button>
                <Button
                  onClick={() => completeMission.mutate()}
                  disabled={completeMission.isPending || !inspectionReport.trim()}
                >
                  <CheckCircle className="w-4 h-4 ml-2" />
                  {completeMission.isPending ? "جاري الإرسال..." : "إرسال التقرير وإنهاء المهمة"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default InspectionMissionPage;
