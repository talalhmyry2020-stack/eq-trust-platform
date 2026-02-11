import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Settings, Code, Copy, Check, Play, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
  const [isProcessing, setIsProcessing] = useState(false);

  const triggerAutoProcess = async () => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("auto-process-deals");
      if (error) throw error;
      
      if (data?.processed > 0) {
        toast.success(`تمت معالجة ${data.processed} صفقة بنجاح`);
      } else {
        toast.info(data?.message || "لا توجد صفقات تحتاج معالجة");
      }
      if (data?.failed > 0) {
        toast.warning(`فشلت ${data.failed} صفقة`);
      }
    } catch (err: any) {
      toast.error("خطأ في تشغيل المعالجة: " + (err.message || ""));
    } finally {
      setIsProcessing(false);
    }
  };

  // === API Examples ===

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
      "deal_id": "uuid",
      "deal_number": 1,
      "title": "نوع المنتج",
      "status": "pending_review",
      "client_full_name": "اسم العميل",
      "product_type": "أجهزة إلكترونية",
      "product_description": "وصف المنتج",
      "import_country": "الصين",
      "identity_doc_signed_url": "https://...signed-url",
      "commercial_register_signed_url": "https://...signed-url",
      "product_image_signed_url": "https://...signed-url أو null"
    }
  ]
}`;

  const postAcceptExample = `POST ${FUNCTIONS_BASE}/update-deal-status
Content-Type: application/json

{
  "deal_id": "DEAL_UUID",
  "status": "active"
}`;

  const postRejectExample = `POST ${FUNCTIONS_BASE}/update-deal-status
Content-Type: application/json

{
  "deal_id": "DEAL_UUID",
  "status": "cancelled"
}`;

  const curlAcceptExample = `curl -X POST '${FUNCTIONS_BASE}/update-deal-status' \\
  -H "Content-Type: application/json" \\
  -d '{"deal_id": "DEAL_UUID", "status": "active"}'`;

  const curlRejectExample = `curl -X POST '${FUNCTIONS_BASE}/update-deal-status' \\
  -H "Content-Type: application/json" \\
  -d '{"deal_id": "DEAL_UUID", "status": "cancelled"}'`;

  // === Phase 2: Auto Process & Search Results ===

  const autoProcessExample = `POST ${FUNCTIONS_BASE}/auto-process-deals

// يبحث تلقائياً عن جميع الصفقات المقبولة التي تحتاج بحث منتجات
// ويرسل كل صفقة على حدة إلى n8n
// لا يحتاج أي بيانات في الطلب`;

  const autoProcessResponseExample = `// الاستجابة:
{
  "success": true,
  "total": 3,
  "processed": 3,
  "failed": 0,
  "results": [
    { "deal_id": "uuid-1", "deal_number": 1, "success": true },
    { "deal_id": "uuid-2", "deal_number": 2, "success": true }
  ]
}`;

  const searchProductsExample = `POST ${FUNCTIONS_BASE}/search-products
Content-Type: application/json

// يرسل بيانات صفقة واحدة يدوياً لـ n8n للبحث
{
  "deal_id": "DEAL_UUID"
}`;

  const searchProductsPayloadExample = `// البيانات التي تُرسل لـ n8n:
{
  "deal_id": "uuid",
  "deal_number": 5,
  "product_type": "أكياس بلاستيك",
  "product_description": "أكياس تغليف شفافة 30×40",
  "import_country": "الصين",
  "product_image_signed_url": "https://...signed-url أو null",
  "callback_url": "${FUNCTIONS_BASE}/receive-search-results"
}`;

  const receiveResultsExample = `POST ${FUNCTIONS_BASE}/receive-search-results
Content-Type: application/json

// n8n يرسل نتائج البحث لكل صفقة عبر هذا الرابط
{
  "deal_id": "DEAL_UUID",
  "columns": ["اسم الشركة", "البريد الإلكتروني", "رقم التواصل", "الموقع", "السعر"],
  "rows": [
    {
      "اسم الشركة": "شركة الصناعات المتقدمة",
      "البريد الإلكتروني": "info@advanced.com",
      "رقم التواصل": "+86123456789",
      "الموقع": "https://advanced.com",
      "السعر": "$0.05/piece"
    },
    {
      "اسم الشركة": "مصنع النجاح",
      "البريد الإلكتروني": "sales@success.cn",
      "رقم التواصل": "+86987654321",
      "الموقع": "https://success.cn",
      "السعر": "$0.04/piece"
    }
  ]
}`;

  const receiveResultsResponseExample = `// الاستجابة:
{
  "success": true,
  "columns_count": 5,
  "rows_count": 2
}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-primary" />
          <h1 className="font-heading text-2xl font-bold">الإعدادات</h1>
        </div>
      </div>

      <div className="space-y-6">
        {/* النظام المخفي - المعالجة التلقائية */}
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Play className="w-5 h-5 text-primary" />
                <CardTitle className="text-base">⚡ النظام المخفي - المعالجة التلقائية</CardTitle>
              </div>
              <Button onClick={triggerAutoProcess} disabled={isProcessing} className="gap-2">
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {isProcessing ? "جاري المعالجة..." : "تشغيل الآن"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              النظام المخفي يعمل تلقائياً على جميع الصفقات المقبولة. يبحث عن صفقات في مرحلة <code className="text-primary font-mono">product_search</code>، ويرسل كل صفقة بشكل مستقل إلى n8n مع بيانات المنتج (النوع، الوصف، دولة الاستيراد، صورة المنتج). بعد الإرسال تتحول المرحلة إلى <code className="text-primary font-mono">searching_products</code> لمنع التكرار.
            </p>
            <CodeBlock title="تشغيل المعالجة التلقائية" code={autoProcessExample} />
            <CodeBlock title="الاستجابة" code={autoProcessResponseExample} />
          </CardContent>
        </Card>

        {/* المرحلة 1: GET - جلب الصفقات قيد المراجعة */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Code className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">📥 المرحلة 1: جلب الصفقات قيد المراجعة (GET)</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground">
              n8n يسحب الصفقات قيد المراجعة مع مستنداتها. كل صفقة لها <code className="text-primary font-mono">deal_id</code> فريد.
            </p>

            <div className="bg-muted/50 border border-border rounded-lg p-3">
              <Label className="text-xs font-semibold text-muted-foreground">رابط GET</Label>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-xs font-mono flex-1" dir="ltr">{FUNCTIONS_BASE}/get-pending-deals</code>
                <Button variant="ghost" size="sm" className="h-7" onClick={() => { navigator.clipboard.writeText(`${FUNCTIONS_BASE}/get-pending-deals`); toast.success("تم النسخ"); }}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>

            <CodeBlock title="جلب جميع الصفقات المعلقة" code={getAllPendingExample} />
            <CodeBlock title="جلب صفقة واحدة بالـ ID" code={getSingleDealExample} />
            <CodeBlock title="مثال cURL" code={curlGetExample} />
            <CodeBlock title="شكل الاستجابة" code={getResponseExample} />
          </CardContent>
        </Card>

        {/* المرحلة 1: POST - تحديث حالة الصفقة */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Code className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">📤 المرحلة 1: تحديث حالة الصفقة (POST)</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground">
              بعد مراجعة الصفقة، n8n يرسل POST مع <code className="text-primary font-mono">deal_id</code> والحالة الجديدة. عند القبول (active) يتحول تلقائياً لمرحلة البحث.
            </p>

            <div className="bg-muted/50 border border-border rounded-lg p-3">
              <Label className="text-xs font-semibold text-muted-foreground">رابط POST</Label>
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

        {/* المرحلة 2: البحث عن المنتجات */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Code className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">🔍 المرحلة 2: إرسال بيانات المنتج لـ n8n</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground">
              عند قبول الصفقة، النظام يرسل تلقائياً بيانات المنتج لـ n8n. يمكنك أيضاً إرسال صفقة يدوياً.
            </p>

            <div className="bg-muted/50 border border-border rounded-lg p-3">
              <Label className="text-xs font-semibold text-muted-foreground">رابط البحث اليدوي</Label>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-xs font-mono flex-1" dir="ltr">{FUNCTIONS_BASE}/search-products</code>
                <Button variant="ghost" size="sm" className="h-7" onClick={() => { navigator.clipboard.writeText(`${FUNCTIONS_BASE}/search-products`); toast.success("تم النسخ"); }}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>

            <CodeBlock title="إرسال يدوي لصفقة واحدة" code={searchProductsExample} />
            <CodeBlock title="البيانات التي تُرسل لـ n8n" code={searchProductsPayloadExample} />
          </CardContent>
        </Card>

        {/* المرحلة 2: استقبال نتائج البحث */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Code className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">📊 المرحلة 2: استقبال نتائج البحث من n8n</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground">
              n8n يرسل نتائج البحث (الشركات والموردين) لكل صفقة عبر هذا الرابط. البيانات تُخزن تلقائياً في جدول البيانات الديناميكي الخاص بالصفقة (أعمدة وصفوف مرنة).
            </p>

            <div className="bg-muted/50 border border-border rounded-lg p-3">
              <Label className="text-xs font-semibold text-muted-foreground">رابط استقبال النتائج (لـ n8n)</Label>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-xs font-mono flex-1" dir="ltr">{FUNCTIONS_BASE}/receive-search-results</code>
                <Button variant="ghost" size="sm" className="h-7" onClick={() => { navigator.clipboard.writeText(`${FUNCTIONS_BASE}/receive-search-results`); toast.success("تم النسخ"); }}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>

            <CodeBlock title="إرسال نتائج البحث من n8n" code={receiveResultsExample} />
            <CodeBlock title="الاستجابة" code={receiveResultsResponseExample} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SettingsPage;
