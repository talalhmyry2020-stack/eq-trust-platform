import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import {
  Shield, Camera, MapPin, CheckCircle, Lock, Navigation,
  AlertTriangle, FileText, Eye, CloudUpload, Play, StopCircle
} from "lucide-react";

const InspectorDashboard = () => {
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
  const [testMode, setTestMode] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  // جلب المهام النشطة
  const { data: missions = [] } = useQuery({
    queryKey: ["my-missions", user?.id],
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

  // جلب المهام المكتملة
  const { data: completedMissions = [] } = useQuery({
    queryKey: ["completed-missions", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("deal_inspection_missions")
        .select("id")
        .eq("inspector_id", user!.id)
        .eq("status", "completed");
      return data || [];
    },
    enabled: !!user,
  });

  const activeMission = missions.find((m: any) => m.status === "in_progress") || missions[0];

  // جلب عدد الصور
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

  // حساب المسافة
  const getDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, []);

  // تتبع الموقع
  const startLocationTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("المتصفح لا يدعم تحديد الموقع");
      return;
    }
    if (watchIdRef.current !== null) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCurrentLocation(loc);
        setLocationError("");

        if (activeMission?.factory_latitude && activeMission?.factory_longitude) {
          const dist = getDistance(loc.lat, loc.lng, activeMission.factory_latitude, activeMission.factory_longitude);
          setIsInRange(testMode || dist <= (activeMission.geofence_radius_meters || 200));
        }
      },
      (err) => setLocationError("فشل تحديد الموقع: " + err.message),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
  }, [activeMission, getDistance]);

  // بدء التتبع تلقائياً عند وجود مهمة نشطة
  useEffect(() => {
    if (activeMission) {
      startLocationTracking();
    }
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [activeMission, startLocationTracking]);

  // بدء المهمة
  const startMission = useMutation({
    mutationFn: async (missionId: string) => {
      await supabase.from("deal_inspection_missions").update({ status: "in_progress" }).eq("id", missionId);
      const mission = missions.find((m: any) => m.id === missionId);
      if (mission) {
        await supabase.from("deals").update({ current_phase: "inspection_in_progress" }).eq("id", mission.deal_id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-missions"] });
      toast({ title: "✅ تم بدء المهمة — جاري تحديد موقعك" });
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
    } catch {
      toast({ title: "خطأ", description: "فشل تشغيل الكاميرا", variant: "destructive" });
    }
  };

  const stopCamera = () => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    setCameraActive(false);
  };

  // التقاط صورة
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

      // ختم الموقع والوقت
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
      toast({ title: `📸 صورة ${photosTaken + 1}/${activeMission?.max_photos || 10} — تم الرفع` });
      queryClient.invalidateQueries({ queryKey: ["mission-photos-count"] });

      if (photosTaken + 1 >= (activeMission?.max_photos || 10)) {
        completeMission.mutate();
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
      stopCamera();

      const missionType = (activeMission as any).mission_type || "initial";

      await supabase.from("deal_inspection_missions").update({
        status: "completed",
        completed_at: new Date().toISOString(),
        quality_status: "approved",
      }).eq("id", activeMission.id);

      // تحديد المرحلة التالية حسب نوع المهمة
      let nextPhase = "inspection_completed";
      let notifTitle = "اكتمال مهمة الفحص";
      let notifMsg = `أكمل المفتش مهمة الفحص للصفقة #${activeMission.deals?.deal_number}. ${photosTaken} صور تم رفعها.`;

      if (missionType === "quality") {
        nextPhase = "quality_approved";
        notifTitle = "فحص الجودة مكتمل ✅";
        notifMsg = `أكمل المفتش فحص جودة الإنتاج للصفقة #${activeMission.deals?.deal_number}. الجودة: معتمدة.`;
        
        // تشغيل إنشاء Token B آلياً
        await supabase.functions.invoke("process-post-inspection", {
          body: { deal_id: activeMission.deal_id, action: "quality_approved" },
        });
      } else if (missionType === "port") {
        nextPhase = "port_inspection_complete";
        notifTitle = "فحص الميناء مكتمل ✅";
        notifMsg = `أكمل المفتش فحص البضاعة في الميناء للصفقة #${activeMission.deals?.deal_number}. البضاعة سليمة.`;
        
        // تشغيل العداد السيادي آلياً
        await supabase.functions.invoke("process-post-inspection", {
          body: { deal_id: activeMission.deal_id, action: "port_inspection_complete" },
        });
      } else {
        await supabase.from("deals").update({ current_phase: nextPhase }).eq("id", activeMission.deal_id);
      }

      if (activeMission.assigned_by) {
        await supabase.from("notifications").insert({
          user_id: activeMission.assigned_by,
          title: notifTitle,
          message: notifMsg,
          type: "inspection",
          entity_type: "deal",
          entity_id: activeMission.deal_id,
        });
      }
    },
    onSuccess: () => {
      toast({ title: "✅ تم إنهاء المهمة بنجاح!" });
      queryClient.invalidateQueries({ queryKey: ["my-missions"] });
      queryClient.invalidateQueries({ queryKey: ["completed-missions"] });
    },
  });

  const maxPhotos = activeMission?.max_photos || 10;
  const missionStarted = activeMission?.status === "in_progress";

  return (
    <div>
      {/* العنوان */}
      <div className="flex items-start gap-3 mb-6 flex-wrap">
        <Shield className="w-7 h-7 md:w-8 md:h-8 text-primary shrink-0" />
        <div>
          <h1 className="font-heading text-lg md:text-2xl font-bold">المفتش الميداني — الوكيل 06</h1>
          <p className="text-xs md:text-sm text-muted-foreground italic">"العين التي لا ترمش.. واليد المقيدة بالحقيقة"</p>
        </div>
      </div>

      {/* إحصائيات */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">مهام نشطة</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{missions.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">مهام مكتملة</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{completedMissions.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">الحالة</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-lg font-semibold ${activeMission ? "text-primary" : "text-muted-foreground"}`}>
              {cameraActive ? "📸 الكاميرا نشطة" : missionStarted ? "🟢 في مهمة" : activeMission ? "🟡 مهمة بانتظارك" : "⚪ لا مهام"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* المهمة النشطة */}
      {activeMission ? (
        <Card className="mb-6 border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-primary" />
                {(activeMission as any).mission_type === "quality" ? "🔍 فحص جودة" : (activeMission as any).mission_type === "port" ? "⚓ فحص ميناء" : "📸 فحص أولي"} — صفقة #{activeMission.deals?.deal_number}
              </span>
              <Badge variant={missionStarted ? "default" : "secondary"}>
                {missionStarted ? "قيد التنفيذ" : "معيّنة — اضغط بدء"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* تفاصيل المهمة */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">📍 الموقع</p>
                <p className="font-medium">{activeMission.factory_address || "غير محدد"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">🌍 الدولة</p>
                <p className="font-medium">{activeMission.factory_country || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">👤 العميل</p>
                <p className="font-medium">{activeMission.deals?.client_full_name || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">📸 الصور المطلوبة</p>
                <p className="font-medium">{maxPhotos} صور</p>
              </div>
            </div>

            {/* حالة الموقع الجغرافي */}
            <div className={`p-3 rounded-lg border ${
              !currentLocation ? "bg-muted/50 border-border" :
              isInRange ? "bg-green-500/10 border-green-500/30" : "bg-destructive/10 border-destructive/30"
            }`}>
              {currentLocation ? (
                <div className="flex items-center gap-2">
                  {isInRange ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <span className="text-green-600 font-medium">أنت داخل النطاق الجغرافي للمصنع ✓ ({activeMission.geofence_radius_meters}م)</span>
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
                  <Navigation className="w-5 h-5 animate-pulse text-primary" />
                  <span>جاري تحديد موقعك الجغرافي...</span>
                </div>
              )}
              {locationError && <p className="text-destructive text-sm mt-1">{locationError}</p>}
              {currentLocation && (
                <p className="text-xs text-muted-foreground mt-1">
                  إحداثياتك: {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)} |
                  المصنع: {activeMission.factory_latitude?.toFixed(6)}, {activeMission.factory_longitude?.toFixed(6)}
                </p>
              )}
            </div>

            {/* تقدم الصور */}
            {missionStarted && (
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>الصور الملتقطة</span>
                  <span className="font-bold">{photosTaken}/{maxPhotos}</span>
                </div>
                <Progress value={(photosTaken / maxPhotos) * 100} />
              </div>
            )}

            {/* زر الوضع التجريبي */}
            {missionStarted && !isInRange && !cameraActive && (
              <div className="p-3 rounded-lg border border-dashed border-yellow-500/50 bg-yellow-500/5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-yellow-600">🧪 الوضع التجريبي</p>
                    <p className="text-xs text-muted-foreground">تخطي القفل الجغرافي لأغراض الاختبار</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-yellow-500/50 text-yellow-600 hover:bg-yellow-500/10"
                    onClick={() => {
                      setTestMode(true);
                      setIsInRange(true);
                      if (!currentLocation) {
                        setCurrentLocation({ lat: activeMission.factory_latitude || 31.4175, lng: activeMission.factory_longitude || 31.8144 });
                      }
                      toast({ title: "🧪 تم تفعيل الوضع التجريبي — الكاميرا مفتوحة الآن" });
                    }}
                  >
                    <MapPin className="w-4 h-4 ml-1" />
                    محاكاة الوصول
                  </Button>
                </div>
              </div>
            )}

            {testMode && (
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="outline" className="border-yellow-500/50 text-yellow-600 text-xs">🧪 وضع تجريبي — القفل الجغرافي معطل</Badge>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-yellow-500/50 text-yellow-600 hover:bg-yellow-500/10"
                  disabled={uploading || photosTaken >= maxPhotos}
                  onClick={async () => {
                    setUploading(true);
                    const loc = currentLocation || { lat: activeMission.factory_latitude || 31.4175, lng: activeMission.factory_longitude || 31.8144 };
                    if (!currentLocation) setCurrentLocation(loc);
                    const total = Math.min(maxPhotos - photosTaken, 10);
                    
                    for (let i = 0; i < total; i++) {
                      try {
                        const canvas = document.createElement("canvas");
                        canvas.width = 800;
                        canvas.height = 600;
                        const ctx = canvas.getContext("2d")!;
                        
                        // خلفية متدرجة
                        const grad = ctx.createLinearGradient(0, 0, 800, 600);
                        grad.addColorStop(0, `hsl(${(i * 36) % 360}, 60%, 40%)`);
                        grad.addColorStop(1, `hsl(${(i * 36 + 120) % 360}, 50%, 30%)`);
                        ctx.fillStyle = grad;
                        ctx.fillRect(0, 0, 800, 600);
                        
                        // نص الصورة
                        ctx.fillStyle = "#fff";
                        ctx.font = "bold 32px monospace";
                        ctx.textAlign = "center";
                        ctx.fillText(`🧪 صورة تجريبية #${photosTaken + i + 1}`, 400, 250);
                        ctx.font = "20px monospace";
                        ctx.fillText(`المهمة: ${activeMission.deals?.deal_number || "—"}`, 400, 300);
                        ctx.fillText(`المصنع: ${activeMission.factory_address || "دمياط، مصر"}`, 400, 340);
                        
                        // ختم سيادي
                        ctx.fillStyle = "rgba(0,0,0,0.6)";
                        ctx.fillRect(0, 540, 800, 60);
                        ctx.fillStyle = "#fff";
                        ctx.font = "16px monospace";
                        ctx.textAlign = "left";
                        const jitter = (Math.random() - 0.5) * 0.001;
                        ctx.fillText(`📍 ${(loc.lat + jitter).toFixed(6)}, ${(loc.lng + jitter).toFixed(6)}`, 10, 565);
                        ctx.fillText(`🕐 ${new Date().toLocaleString("ar-SA")}`, 10, 585);
                        
                        const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), "image/jpeg", 0.85));
                        const filePath = `${user!.id}/${activeMission.id}/test_${Date.now()}_${i}.jpg`;
                        
                        const { error } = await supabase.storage.from("inspection-photos").upload(filePath, blob);
                        if (error) throw error;
                        
                        const { data: urlData } = supabase.storage.from("inspection-photos").getPublicUrl(filePath);
                        
                        await supabase.from("deal_inspection_photos").insert({
                          mission_id: activeMission.id,
                          deal_id: activeMission.deal_id,
                          photo_url: urlData.publicUrl,
                          latitude: loc.lat + jitter,
                          longitude: loc.lng + jitter,
                        });
                        
                        setPhotosTaken((p) => p + 1);
                        toast({ title: `📸 صورة تجريبية ${photosTaken + i + 1}/${maxPhotos}` });
                      } catch (err: any) {
                        toast({ title: "خطأ", description: err.message, variant: "destructive" });
                        break;
                      }
                    }
                    
                    setUploading(false);
                    queryClient.invalidateQueries({ queryKey: ["mission-photos-count"] });
                    
                    if (photosTaken + total >= maxPhotos) {
                      completeMission.mutate();
                    }
                  }}
                >
                  <Camera className="w-4 h-4 ml-1" />
                  {uploading ? "جاري التوليد..." : `توليد ${Math.min(maxPhotos - photosTaken, 10)} صور تجريبية`}
                </Button>
              </div>
            )}

            {/* أزرار التحكم */}
            <div className="flex gap-3 flex-wrap">
              {!missionStarted ? (
                <Button className="flex-1" size="lg" onClick={() => startMission.mutate(activeMission.id)} disabled={startMission.isPending}>
                  <Play className="w-5 h-5 ml-2" />
                  {startMission.isPending ? "جاري البدء..." : "بدء المهمة"}
                </Button>
              ) : !cameraActive && isInRange ? (
                <Button className="flex-1" size="lg" onClick={startCamera}>
                  <Camera className="w-5 h-5 ml-2" />
                  فتح الكاميرا
                </Button>
              ) : !cameraActive && !isInRange ? (
                <Button className="flex-1" size="lg" disabled>
                  <Lock className="w-5 h-5 ml-2" />
                  الكاميرا مقفلة — توجه للموقع
                </Button>
              ) : null}

              {missionStarted && photosTaken > 0 && !cameraActive && (
                <Button variant="outline" onClick={() => completeMission.mutate()} disabled={completeMission.isPending}>
                  <CheckCircle className="w-4 h-4 ml-2" />
                  إنهاء المهمة
                </Button>
              )}
            </div>

            {/* الكاميرا */}
            {cameraActive && (
              <div className="space-y-3">
                <div className="relative rounded-lg overflow-hidden bg-black">
                  <video ref={videoRef} autoPlay playsInline className="w-full" />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="absolute top-2 right-2">
                    <Badge variant="destructive" className="animate-pulse">🔴 تسجيل مباشر</Badge>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button
                    className="flex-1"
                    size="lg"
                    onClick={() => capturePhoto.mutate()}
                    disabled={uploading || photosTaken >= maxPhotos}
                  >
                    <Camera className="w-5 h-5 ml-2" />
                    {uploading ? "جاري الرفع..." : `التقاط صورة (${photosTaken}/${maxPhotos})`}
                  </Button>
                  <Button variant="outline" onClick={stopCamera}>
                    <StopCircle className="w-4 h-4 ml-2" />
                    إيقاف
                  </Button>
                  {photosTaken > 0 && (
                    <Button variant="secondary" onClick={() => completeMission.mutate()} disabled={completeMission.isPending}>
                      <CheckCircle className="w-4 h-4 ml-2" />
                      إنهاء
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-6">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Camera className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">لا توجد مهام فحص مسندة إليك حالياً</p>
            <p className="text-sm mt-1">سيتم إشعارك فور تعيين مهمة جديدة</p>
          </CardContent>
        </Card>
      )}

      {/* بروتوكولات العمل */}
      <h2 className="font-heading text-xl font-bold mb-4">بروتوكولات العمل</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {[
          { icon: FileText, title: "الاستلام المشفر", desc: "المسطرة الرقمية للمواصفات", active: !!activeMission },
          { icon: MapPin, title: "القفل الجغرافي", desc: "التحقق من التواجد المكاني", active: isInRange },
          { icon: Camera, title: "التوثيق المقيد", desc: "تصوير مباشر فقط مع ختم سيادي", active: cameraActive },
          { icon: Eye, title: "المطابقة البصرية", desc: "مقارنة المنتج مع العينة المرجعية", active: photosTaken > 0 },
          { icon: CloudUpload, title: "الرفع المشفر", desc: "إرسال فوري للسحابة الآمنة", active: photosTaken > 0 },
        ].map((p, i) => (
          <Card key={i} className={`transition-colors ${p.active ? "border-primary/40 bg-primary/5" : ""}`}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${p.active ? "bg-primary/20" : "bg-muted"}`}>
                <p.icon className={`w-5 h-5 ${p.active ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">{p.title}</p>
                <p className="text-xs text-muted-foreground">{p.desc}</p>
              </div>
              <Badge variant={p.active ? "default" : "outline"} className="text-xs">
                {p.active ? "نشط" : "معطل"}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default InspectorDashboard;
