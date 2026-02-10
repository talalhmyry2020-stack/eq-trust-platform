import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Settings, Code, Copy, Check } from "lucide-react";
import { toast } from "sonner";

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
  const getAllPendingExample = `GET ${FUNCTIONS_BASE}/get-pending-deals

// يجلب جميع الصفقات قيد المراجعة مع روابط المستندات الموقعة`;

  const getSingleDealExample = `GET ${FUNCTIONS_BASE}/get-pending-deals?deal_id=DEAL_UUID

// يجلب صفقة واحدة بالـ ID الخاص بها`;

  const curlGetExample = `curl '${FUNCTIONS_BASE}/get-pending-deals'`;

  const curlGetSingleExample = `curl '${FUNCTIONS_BASE}/get-pending-deals?deal_id=DEAL_UUID'`;

  const getResponseExample = `// الاستجابة:
{
  "deals": [
    {
      "deal_id": "uuid-فريد-لكل-صفقة",
      "deal_number": 1,
      "title": "نوع المنتج",
      "deal_type": "وساطة",
      "status": "pending_review",
      "current_phase": "verification",
      "client_full_name": "اسم العميل",
      "national_id": "12345678901234",
      "commercial_register_number": "123456",
      "entity_type": "شركة",
      "country": "مصر",
      "city": "القاهرة",
      "product_type": "أجهزة إلكترونية",
      "product_description": "وصف المنتج",
      "import_country": "الصين",
      "identity_doc_signed_url": "https://...signed-url",
      "commercial_register_signed_url": "https://...signed-url",
      "product_image_signed_url": "https://...signed-url أو null",
      "created_at": "2026-02-10T..."
    }
  ],
  "count": 1
}`;

  const postAcceptExample = `POST ${FUNCTIONS_BASE}/update-deal-status
Content-Type: application/json

{
  "deal_id": "deal_id-من-الاستجابة-أعلاه",
  "status": "active"
}`;

  const postRejectExample = `POST ${FUNCTIONS_BASE}/update-deal-status
Content-Type: application/json

{
  "deal_id": "deal_id-من-الاستجابة-أعلاه",
  "status": "cancelled"
}`;

  const curlAcceptExample = `curl -X POST '${FUNCTIONS_BASE}/update-deal-status' \\
  -H "Content-Type: application/json" \\
  -d '{"deal_id": "DEAL_UUID", "status": "active"}'`;

  const curlRejectExample = `curl -X POST '${FUNCTIONS_BASE}/update-deal-status' \\
  -H "Content-Type: application/json" \\
  -d '{"deal_id": "DEAL_UUID", "status": "cancelled"}'`;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-6 h-6 text-primary" />
        <h1 className="font-heading text-2xl font-bold">الإعدادات</h1>
      </div>

      <div className="space-y-6">
        {/* GET - Fetch pending deals */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Code className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">📥 GET - جلب الصفقات قيد المراجعة</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground">
              استخدم هذا الرابط في n8n لجلب جميع الصفقات قيد المراجعة مع مستنداتها. كل صفقة لها <code className="text-primary font-mono">deal_id</code> فريد للتعامل معها بشكل مستقل.
            </p>

            <div className="bg-muted/50 border border-border rounded-lg p-3">
              <Label className="text-xs font-semibold text-muted-foreground">رابط GET (انسخه لـ n8n)</Label>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-xs font-mono flex-1" dir="ltr">{FUNCTIONS_BASE}/get-pending-deals</code>
                <Button variant="ghost" size="sm" className="h-7" onClick={() => { navigator.clipboard.writeText(`${FUNCTIONS_BASE}/get-pending-deals`); toast.success("تم النسخ"); }}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>

            <CodeBlock title="جلب جميع الصفقات المعلقة" code={getAllPendingExample} />
            <CodeBlock title="جلب صفقة واحدة بالـ ID" code={getSingleDealExample} />
            <CodeBlock title="مثال cURL - جلب الكل" code={curlGetExample} />
            <CodeBlock title="مثال cURL - جلب صفقة واحدة" code={curlGetSingleExample} />
            <CodeBlock title="شكل الاستجابة" code={getResponseExample} />
          </CardContent>
        </Card>

        {/* POST - Update deal status */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Code className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">📤 POST - تحديث حالة الصفقة (مقبولة / مرفوضة)</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground">
              بعد مراجعة الصفقة في n8n، أرسل POST مع <code className="text-primary font-mono">deal_id</code> الخاص بالصفقة وحالتها الجديدة.
            </p>

            <div className="bg-muted/50 border border-border rounded-lg p-3">
              <Label className="text-xs font-semibold text-muted-foreground">رابط POST (انسخه لـ n8n)</Label>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-xs font-mono flex-1" dir="ltr">{FUNCTIONS_BASE}/update-deal-status</code>
                <Button variant="ghost" size="sm" className="h-7" onClick={() => { navigator.clipboard.writeText(`${FUNCTIONS_BASE}/update-deal-status`); toast.success("تم النسخ"); }}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>

            <CodeBlock title="قبول صفقة" code={postAcceptExample} />
            <CodeBlock title="رفض صفقة" code={postRejectExample} />
            <CodeBlock title="مثال cURL - قبول" code={curlAcceptExample} />
            <CodeBlock title="مثال cURL - رفض" code={curlRejectExample} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SettingsPage;
