import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Settings, Webhook, Code, Copy, Check, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  const [webhookUrl, setWebhookUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      const [settingsRes, dealsRes] = await Promise.all([
        supabase.from("system_settings").select("value").eq("key", "verification_webhook_url").single(),
        supabase.from("deals").select("id", { count: "exact" }).eq("status", "pending_review" as any),
      ]);
      if (settingsRes.data) setWebhookUrl((settingsRes.data.value as any)?.url || "");
      setPendingCount(dealsRes.count || 0);
      setLoading(false);
    };
    fetchData();
  }, []);

  const saveWebhook = async () => {
    setSaving(true);
    const { error } = await supabase.from("system_settings").upsert(
      { key: "verification_webhook_url", value: { url: webhookUrl } as any },
      { onConflict: "key" }
    );
    if (error) toast.error("خطأ في الحفظ");
    else toast.success("تم حفظ رابط الـ Webhook");
    setSaving(false);
  };

  const sendPendingDeals = async () => {
    setSending(true);
    try {
      // Fetch all pending_review deals
      const { data: deals, error } = await supabase
        .from("deals")
        .select("id")
        .eq("status", "pending_review" as any);
      
      if (error) throw error;
      if (!deals || deals.length === 0) {
        toast.info("لا توجد صفقات قيد المراجعة");
        setSending(false);
        return;
      }

      let sent = 0;
      let failed = 0;
      for (const deal of deals) {
        const { error: fnError } = await supabase.functions.invoke("send-deal-webhook", {
          body: { deal_id: deal.id },
        });
        if (fnError) failed++;
        else sent++;
      }

      if (failed > 0) toast.warning(`تم إرسال ${sent} صفقة، فشل ${failed}`);
      else toast.success(`تم إرسال ${sent} صفقة إلى الـ Webhook بنجاح`);
      setPendingCount(0);
    } catch (err: any) {
      toast.error(err.message || "خطأ في الإرسال");
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  const postbackExample = `POST ${FUNCTIONS_BASE}/update-deal-status

Headers:
  Content-Type: application/json

Body (للقبول):
{
  "deal_id": "uuid-الصفقة",
  "status": "active"
}

Body (للرفض):
{
  "deal_id": "uuid-الصفقة",
  "status": "cancelled"
}`;

  const curlAcceptExample = `curl -X POST '${FUNCTIONS_BASE}/update-deal-status' \\
  -H "Content-Type: application/json" \\
  -d '{"deal_id": "DEAL_UUID", "status": "active"}'`;

  const curlRejectExample = `curl -X POST '${FUNCTIONS_BASE}/update-deal-status' \\
  -H "Content-Type: application/json" \\
  -d '{"deal_id": "DEAL_UUID", "status": "cancelled"}'`;

  const webhookPayloadExample = `// البيانات التي تُرسل تلقائياً عند وجود صفقة قيد المراجعة:
{
  "deal_id": "uuid",
  "deal_number": 1,
  "title": "نوع المنتج",
  "deal_type": "وساطة",
  "status": "pending_review",
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
  "identity_doc_signed_url": "https://...signed-url",
  "commercial_register_signed_url": "https://...signed-url",
  "product_image_signed_url": "https://...signed-url أو null",
  "postback_url": "${FUNCTIONS_BASE}/update-deal-status"
}`;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-6 h-6 text-primary" />
        <h1 className="font-heading text-2xl font-bold">الإعدادات</h1>
      </div>

      <Tabs defaultValue="webhooks" dir="rtl">
        <TabsList className="mb-4">
          <TabsTrigger value="webhooks" className="gap-2"><Webhook className="w-4 h-4" /> Webhook</TabsTrigger>
          <TabsTrigger value="api" className="gap-2"><Code className="w-4 h-4" /> مرجع API</TabsTrigger>
        </TabsList>

        <TabsContent value="webhooks">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Webhook className="w-5 h-5 text-primary" />
                <CardTitle>إعدادات الـ Webhook</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                عند وجود أي صفقة قيد المراجعة، يتم إرسال جميع بياناتها ومستنداتها تلقائياً إلى هذا الرابط. يقوم n8n بمراجعتها ثم يرسل النتيجة (مقبولة/مرفوضة) عبر رابط الاستقبال.
              </p>
              <div>
                <Label>رابط الـ Webhook (لإرسال بيانات الصفقات)</Label>
                <Input
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://your-n8n-instance.com/webhook/..."
                  className="mt-1.5 font-mono text-sm"
                  dir="ltr"
                />
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={saveWebhook} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  حفظ
                </Button>
                <Button onClick={sendPendingDeals} disabled={sending || !webhookUrl} variant="outline" className="gap-2">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  إرسال الصفقات المعلقة الآن ({pendingCount})
                </Button>
              </div>
              <div className="bg-muted/50 border border-border rounded-lg p-3 text-sm">
                <Label className="text-xs font-semibold text-muted-foreground">رابط استقبال النتيجة (انسخه لـ n8n)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-xs font-mono flex-1" dir="ltr">{FUNCTIONS_BASE}/update-deal-status</code>
                  <Button variant="ghost" size="sm" className="h-7" onClick={() => { navigator.clipboard.writeText(`${FUNCTIONS_BASE}/update-deal-status`); toast.success("تم النسخ"); }}>
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">📤 البيانات المرسلة عبر الـ Webhook</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  هذه البيانات تُرسل تلقائياً إلى رابط الـ Webhook عند وجود صفقة قيد المراجعة.
                </p>
                <CodeBlock title="Webhook Payload" code={webhookPayloadExample} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">📥 إرسال النتيجة من n8n (POST)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-sm text-muted-foreground">
                  بعد مراجعة البيانات في n8n، أرسل POST إلى رابط الاستقبال مع حالة الصفقة (مقبولة أو مرفوضة).
                </p>
                <CodeBlock title="صيغة الطلب" code={postbackExample} />
                <CodeBlock title="مثال cURL - قبول صفقة" code={curlAcceptExample} />
                <CodeBlock title="مثال cURL - رفض صفقة" code={curlRejectExample} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;
