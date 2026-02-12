import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Settings, Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SettingsPage = () => {
  const [phase1Webhook, setPhase1Webhook] = useState("");
  const [intervalMinutes, setIntervalMinutes] = useState("5");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from("system_settings")
        .select("key, value")
        .in("key", ["phase1_webhook_url", "auto_process_interval"]);

      if (data) {
        for (const setting of data) {
          if (setting.key === "phase1_webhook_url") {
            setPhase1Webhook((setting.value as any)?.url || "");
          }
          if (setting.key === "auto_process_interval") {
            setIntervalMinutes(String((setting.value as any)?.minutes || 5));
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
            key: "phase1_webhook_url",
            value: { url: phase1Webhook } as any,
            updated_at: now,
          },
          {
            key: "auto_process_interval",
            value: { minutes: parseInt(intervalMinutes) || 5 } as any,
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">🔗 روابط التكامل (Webhooks)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phase1-webhook">
              رابط Webhook المرحلة الأولى - البحث عن بيانات المنتج
            </Label>
            <Input
              id="phase1-webhook"
              dir="ltr"
              placeholder="https://your-n8n-instance.com/webhook/..."
              value={phase1Webhook}
              onChange={(e) => setPhase1Webhook(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              يُرسل النظام بيانات المنتج (النوع، الوصف، دولة الاستيراد، الصورة) إلى هذا الرابط لكل صفقة مقبولة.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="interval-minutes">
              الفترة الزمنية بين كل إرسال (بالدقائق)
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
              النظام يرسل صفقة واحدة فقط كل فترة. مثلاً: 5 يعني كل 5 دقائق يُرسل صفقة واحدة.
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
  );
};

export default SettingsPage;
