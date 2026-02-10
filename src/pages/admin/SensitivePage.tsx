import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Search, Shield, Save, Webhook, Loader2 } from "lucide-react";
import { toast } from "sonner";

const SensitivePage = () => {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [postbackUrl, setPostbackUrl] = useState("");
  const [savingWebhook, setSavingWebhook] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const [profilesRes, settingsRes] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("system_settings").select("*").in("key", ["verification_webhook_url", "verification_postback_url"]),
      ]);
      setProfiles(profilesRes.data || []);
      
      const settings = settingsRes.data || [];
      const wh = settings.find((s) => s.key === "verification_webhook_url");
      const pb = settings.find((s) => s.key === "verification_postback_url");
      if (wh) setWebhookUrl((wh.value as any)?.url || "");
      if (pb) setPostbackUrl((pb.value as any)?.url || "");
    };
    fetchData();
  }, []);

  const saveWebhookSettings = async () => {
    setSavingWebhook(true);
    try {
      // Upsert webhook URL
      const { error: e1 } = await supabase.from("system_settings").upsert(
        { key: "verification_webhook_url", value: { url: webhookUrl } as any },
        { onConflict: "key" }
      );
      // Upsert postback URL
      const { error: e2 } = await supabase.from("system_settings").upsert(
        { key: "verification_postback_url", value: { url: postbackUrl } as any },
        { onConflict: "key" }
      );
      if (e1 || e2) throw new Error("فشل حفظ الإعدادات");
      toast.success("تم حفظ إعدادات الـ Webhook بنجاح");
    } catch (err: any) {
      toast.error(err.message || "خطأ في الحفظ");
    } finally {
      setSavingWebhook(false);
    }
  };

  const filtered = profiles.filter((p) =>
    p.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-6 h-6 text-destructive" />
        <h1 className="font-heading text-2xl font-bold">البيانات الحساسة</h1>
      </div>

      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-6">
        <p className="text-sm text-destructive">⚠️ هذه الصفحة تحتوي على بيانات حساسة. الوصول مقتصر على المدير فقط.</p>
      </div>

      {/* Webhook Settings */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Webhook className="w-5 h-5 text-primary" />
            إعدادات الـ Webhook
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            عند إنشاء أي صفقة جديدة (قيد المراجعة)، يتم إرسال جميع بياناتها تلقائياً إلى الـ Webhook أدناه للتحقق. ثم يقوم الـ n8n بإرسال النتيجة (مقبولة/مرفوضة) عبر رابط الاستقبال.
          </p>
          <div>
            <Label htmlFor="webhookUrl">رابط الـ Webhook (إرسال بيانات الصفقة)</Label>
            <Input
              id="webhookUrl"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://your-n8n-instance.com/webhook/..."
              className="mt-1.5 font-mono text-sm"
              dir="ltr"
            />
          </div>
          <div>
            <Label htmlFor="postbackUrl">رابط استقبال النتيجة (POST من n8n)</Label>
            <Input
              id="postbackUrl"
              value={postbackUrl}
              onChange={(e) => setPostbackUrl(e.target.value)}
              placeholder="https://ihaomfghhzfcsezixviq.supabase.co/functions/v1/update-deal-status"
              className="mt-1.5 font-mono text-sm"
              dir="ltr"
            />
            <p className="text-xs text-muted-foreground mt-1">
              هذا هو الرابط الذي يرسل إليه n8n حالة الصفقة (مقبولة/مرفوضة). انسخه وضعه في n8n.
            </p>
          </div>
          <Button onClick={saveWebhookSettings} disabled={savingWebhook} className="gap-2">
            {savingWebhook ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            حفظ الإعدادات
          </Button>
        </CardContent>
      </Card>

      <div className="relative mb-4">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="بحث..." className="pr-10" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">بيانات الحسابات</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>معرف المستخدم</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>نشط</TableHead>
                <TableHead>تاريخ التسجيل</TableHead>
                <TableHead>آخر تحديث</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.full_name || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{p.user_id.substring(0, 8)}...</TableCell>
                  <TableCell>
                    <Badge variant={p.status === "active" ? "default" : "destructive"}>
                      {p.status === "active" ? "مفعل" : p.status === "suspended" ? "موقوف" : p.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.is_active ? "default" : "secondary"}>
                      {p.is_active ? "نعم" : "لا"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{new Date(p.created_at).toLocaleString("ar-SA")}</TableCell>
                  <TableCell className="font-mono text-xs">{new Date(p.updated_at).toLocaleString("ar-SA")}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">لا توجد بيانات</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default SensitivePage;
