import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Settings, Webhook, Shield } from "lucide-react";
import { toast } from "sonner";

const SettingsPage = () => {
  const [webhooks, setWebhooks] = useState({
    deal_created: "",
    deal_updated: "",
    deal_deleted: "",
    user_registered: "",
  });
  const [security, setSecurity] = useState({
    max_login_attempts: 5,
    auto_suspend: true,
    email_verification: true,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.from("system_settings").select("*");
      if (data) {
        const webhooksSetting = data.find((s) => s.key === "webhooks");
        const securitySetting = data.find((s) => s.key === "security");
        if (webhooksSetting) setWebhooks(webhooksSetting.value as any);
        if (securitySetting) setSecurity(securitySetting.value as any);
      }
      setLoading(false);
    };
    fetchSettings();
  }, []);

  const saveWebhooks = async () => {
    const { error } = await supabase
      .from("system_settings")
      .update({ value: webhooks as any, updated_at: new Date().toISOString() })
      .eq("key", "webhooks");
    if (error) toast.error("خطأ في الحفظ");
    else toast.success("تم حفظ إعدادات Webhooks");
  };

  const saveSecurity = async () => {
    const { error } = await supabase
      .from("system_settings")
      .update({ value: security as any, updated_at: new Date().toISOString() })
      .eq("key", "security");
    if (error) toast.error("خطأ في الحفظ");
    else toast.success("تم حفظ إعدادات الأمان");
  };

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-6 h-6 text-primary" />
        <h1 className="font-heading text-2xl font-bold">الإعدادات</h1>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Webhook className="w-5 h-5 text-primary" />
              <CardTitle>Webhooks</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>عند إنشاء صفقة</Label>
              <Input value={webhooks.deal_created} onChange={(e) => setWebhooks({ ...webhooks, deal_created: e.target.value })} placeholder="https://..." dir="ltr" />
            </div>
            <div>
              <Label>عند تحديث صفقة</Label>
              <Input value={webhooks.deal_updated} onChange={(e) => setWebhooks({ ...webhooks, deal_updated: e.target.value })} placeholder="https://..." dir="ltr" />
            </div>
            <div>
              <Label>عند حذف صفقة</Label>
              <Input value={webhooks.deal_deleted} onChange={(e) => setWebhooks({ ...webhooks, deal_deleted: e.target.value })} placeholder="https://..." dir="ltr" />
            </div>
            <div>
              <Label>عند تسجيل مستخدم</Label>
              <Input value={webhooks.user_registered} onChange={(e) => setWebhooks({ ...webhooks, user_registered: e.target.value })} placeholder="https://..." dir="ltr" />
            </div>
            <Button onClick={saveWebhooks}>حفظ Webhooks</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <CardTitle>الأمان</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>عدد محاولات الدخول القصوى</Label>
              <Input
                type="number"
                value={security.max_login_attempts}
                onChange={(e) => setSecurity({ ...security, max_login_attempts: parseInt(e.target.value) || 5 })}
                className="w-24"
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <Label>إيقاف الحساب تلقائياً عند تجاوز المحاولات</Label>
              <Switch checked={security.auto_suspend} onCheckedChange={(v) => setSecurity({ ...security, auto_suspend: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>التحقق بالبريد الإلكتروني</Label>
              <Switch checked={security.email_verification} onCheckedChange={(v) => setSecurity({ ...security, email_verification: v })} />
            </div>
            <Button onClick={saveSecurity}>حفظ إعدادات الأمان</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SettingsPage;
