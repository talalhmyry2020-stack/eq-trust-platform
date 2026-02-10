import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Settings, Webhook, Shield, Code, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const API_BASE = `https://ihaomfghhzfcsezixviq.supabase.co/rest/v1`;
const FUNCTIONS_BASE = `https://ihaomfghhzfcsezixviq.supabase.co/functions/v1`;

const CodeBlock = ({ title, code }: { title: string; code: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">{title}</Label>
        <Button variant="ghost" size="sm" onClick={handleCopy} className="gap-1.5 h-7 text-xs">
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? "تم النسخ" : "نسخ"}
        </Button>
      </div>
      <pre className="bg-muted/50 border border-border rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap" dir="ltr">
        <code>{code}</code>
      </pre>
    </div>
  );
};

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

  const getDealsExample = `GET ${API_BASE}/deals?select=*&status=eq.pending_review

Headers:
  apikey: YOUR_ANON_KEY
  Authorization: Bearer YOUR_SERVICE_ROLE_KEY`;

  const getSingleDealExample = `GET ${API_BASE}/deals?id=eq.{DEAL_ID}&select=*

Headers:
  apikey: YOUR_ANON_KEY
  Authorization: Bearer YOUR_SERVICE_ROLE_KEY`;

  const updateStatusExample = `PATCH ${API_BASE}/deals?id=eq.{DEAL_ID}

Headers:
  apikey: YOUR_ANON_KEY
  Authorization: Bearer YOUR_SERVICE_ROLE_KEY
  Content-Type: application/json
  Prefer: return=minimal

Body:
{
  "status": "active"
}

// القيم المتاحة للحالة:
// "active"         → نشطة (تمت الموافقة)
// "cancelled"      → ملغاة (مرفوضة)
// "delayed"        → متأخرة
// "paused"         → متوقفة
// "completed"      → مكتملة
// "pending_review" → قيد المراجعة`;

  const curlPostExample = `curl -X PATCH '${API_BASE}/deals?id=eq.YOUR_DEAL_ID' \\
  -H "apikey: YOUR_ANON_KEY" \\
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Prefer: return=minimal" \\
  -d '{"status": "active"}'`;

  const n8nHttpExample = `// في n8n - استخدم HTTP Request node:
// Method: PATCH
// URL: ${API_BASE}/deals?id=eq.{{$json.deal_id}}
//
// Headers:
//   apikey: YOUR_ANON_KEY
//   Authorization: Bearer YOUR_SERVICE_ROLE_KEY
//   Content-Type: application/json
//   Prefer: return=minimal
//
// Body (JSON):
// {
//   "status": "active"   // أو "cancelled" في حال الرفض
// }
//
// ملاحظة: deal_id يأتي من payload الـ webhook الذي أرسلناه`;

  const webhookPayloadExample = `// البيانات التي تُرسل تلقائياً إلى n8n عند إنشاء صفقة:
{
  "deal_id": "uuid",
  "deal_number": 1,
  "title": "نوع المنتج",
  "deal_type": "وساطة",
  "status": "pending_review",
  "client_id": "uuid",
  "client_full_name": "اسم العميل",
  "country": "مصر",
  "city": "القاهرة",
  "national_id": "12345678901234",
  "commercial_register_number": "123456",
  "entity_type": "شركة",
  "product_type": "أجهزة إلكترونية",
  "product_description": "وصف المنتج",
  "import_country": "الصين",
  "created_at": "2026-02-10T...",
  "identity_doc_signed_url": "https://...signed-url (صالح لمدة ساعة)",
  "commercial_register_signed_url": "https://...signed-url",
  "product_image_signed_url": "https://...signed-url أو null"
}`;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-6 h-6 text-primary" />
        <h1 className="font-heading text-2xl font-bold">الإعدادات</h1>
      </div>

      <Tabs defaultValue="webhooks" dir="rtl">
        <TabsList className="mb-4">
          <TabsTrigger value="webhooks" className="gap-2"><Webhook className="w-4 h-4" /> Webhooks</TabsTrigger>
          <TabsTrigger value="security" className="gap-2"><Shield className="w-4 h-4" /> الأمان</TabsTrigger>
          <TabsTrigger value="api" className="gap-2"><Code className="w-4 h-4" /> مرجع API</TabsTrigger>
        </TabsList>

        <TabsContent value="webhooks">
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
        </TabsContent>

        <TabsContent value="security">
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
        </TabsContent>

        <TabsContent value="api">
          <div className="space-y-6">
            {/* Webhook Payload */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">📤 بيانات الـ Webhook المُرسلة (Outgoing)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  عند إنشاء صفقة جديدة، يتم إرسال البيانات التالية تلقائياً إلى رابط N8N_WEBHOOK_URL مع روابط موقعة للمستندات.
                </p>
                <CodeBlock title="Webhook Payload" code={webhookPayloadExample} />
              </CardContent>
            </Card>

            {/* GET APIs */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">📥 جلب الصفقات (GET)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <CodeBlock title="جلب جميع الصفقات قيد المراجعة" code={getDealsExample} />
                <CodeBlock title="جلب صفقة واحدة بالـ ID" code={getSingleDealExample} />
              </CardContent>
            </Card>

            {/* POST/PATCH APIs */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">✏️ تحديث حالة الصفقة (PATCH)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <CodeBlock title="تحديث حالة الصفقة" code={updateStatusExample} />
                <CodeBlock title="مثال cURL" code={curlPostExample} />
              </CardContent>
            </Card>

            {/* n8n Example */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">🔗 مثال n8n (HTTP Request Node)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  بعد فحص البيانات في n8n، استخدم HTTP Request node لتحديث حالة الصفقة تلقائياً.
                </p>
                <CodeBlock title="إعدادات n8n" code={n8nHttpExample} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;
