import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings, Save, Loader2, Bot } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SettingsPage = () => {
  const [intervalMinutes, setIntervalMinutes] = useState("5");
  const [qualificationEnabled, setQualificationEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingAgent, setTestingAgent] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from("system_settings")
        .select("key, value")
        .in("key", ["auto_process_interval", "qualification_agent_enabled"]);

      if (data) {
        for (const setting of data) {
          if (setting.key === "auto_process_interval") {
            setIntervalMinutes(String((setting.value as any)?.minutes || 5));
          }
          if (setting.key === "qualification_agent_enabled") {
            setQualificationEnabled((setting.value as any)?.enabled === true);
          }
        }
      }
      setLoading(false);
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase.from("system_settings").upsert(
        [
          {
            key: "auto_process_interval",
            value: { minutes: parseInt(intervalMinutes) || 5 } as any,
            updated_at: now,
          },
          {
            key: "qualification_agent_enabled",
            value: { enabled: qualificationEnabled } as any,
            updated_at: now,
          },
        ],
        { onConflict: "key" }
      );

      if (error) throw error;
      toast.success("تم حفظ الإعدادات بنجاح");
    } catch (err: any) {
      toast.error("فشل حفظ الإعدادات: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const testQualificationAgent = async () => {
    setTestingAgent(true);
    try {
      const { data, error } = await supabase.functions.invoke("qualify-deals");
      if (error) throw error;
      
      const result = data as any;
      if (result.processed === 0) {
        toast.info(result.message || "لا توجد صفقات للمعالجة");
      } else {
        const approved = result.results?.filter((r: any) => r.status === "approved").length || 0;
        const rejected = result.results?.filter((r: any) => r.status === "rejected").length || 0;
        toast.success(`تم معالجة ${result.processed} صفقات: ${approved} مقبولة، ${rejected} مرفوضة`);
      }
    } catch (err: any) {
      toast.error("خطأ في تشغيل الوكيل: " + err.message);
    } finally {
      setTestingAgent(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-primary" />
          <h1 className="font-heading text-2xl font-bold">الإعدادات</h1>
        </div>
      </div>

      <div className="space-y-6">
        {/* وكيل التأهيل */}
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary" />
              🤖 وكيل التأهيل الآلي
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div>
                <p className="font-medium text-sm">تفعيل وكيل التأهيل</p>
                <p className="text-xs text-muted-foreground mt-1">
                  يقوم الوكيل تلقائياً بفحص المستندات (الهوية + السجل التجاري) ومقارنتها بالبيانات المدخلة عبر الذكاء الاصطناعي
                </p>
              </div>
              <Switch
                checked={qualificationEnabled}
                onCheckedChange={setQualificationEnabled}
              />
            </div>

            <div className="text-xs text-muted-foreground space-y-1 border-r-2 border-primary/30 pr-3">
              <p>• يفحص الصفقات "قيد المراجعة" تلقائياً</p>
              <p>• يستخرج البيانات من صور الهوية والسجل التجاري</p>
              <p>• يقبل الصفقة إذا تطابقت البيانات أو يرفضها مع إرسال السبب للعميل</p>
              <p>• يمكنك إرجاع أي صفقة مرفوضة يدوياً من صفحة الصفقات</p>
            </div>

            <Button
              variant="outline"
              onClick={testQualificationAgent}
              disabled={testingAgent || !qualificationEnabled}
              className="w-full"
            >
              {testingAgent ? (
                <Loader2 className="w-4 h-4 animate-spin ml-2" />
              ) : (
                <Bot className="w-4 h-4 ml-2" />
              )}
              تشغيل الوكيل الآن (تجربة يدوية)
            </Button>
          </CardContent>
        </Card>

        {/* إعدادات المعالجة */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">⚙️ إعدادات المعالجة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="interval-minutes">
                الفترة الزمنية بين كل معالجة (بالدقائق)
              </Label>
              <Input
                id="interval-minutes"
                type="number"
                min="1"
                max="60"
                dir="ltr"
                placeholder="5"
                value={intervalMinutes}
                onChange={(e) => setIntervalMinutes(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                النظام يعالج الصفقات كل فترة. مثلاً: 5 يعني كل 5 دقائق.
              </p>
            </div>

            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin ml-2" />
              ) : (
                <Save className="w-4 h-4 ml-2" />
              )}
              حفظ الإعدادات
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SettingsPage;
