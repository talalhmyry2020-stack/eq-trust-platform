import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { FileText, Send, CheckCircle, Loader2, ShieldCheck, KeyRound, MessageSquareWarning, Download } from "lucide-react";

interface Contract {
  id: string;
  deal_id: string;
  contract_html: string;
  shipping_type: string;
  platform_fee_percentage: number;
  total_amount: number;
  currency: string;
  client_name: string;
  factory_name: string;
  status: string;
  client_signed: boolean;
  signed_at: string | null;
  client_notes: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  drafting: "جاري صياغة العقد",
  client_review: "بانتظار مراجعتك",
  client_objection: "تم إرسال ملاحظاتك - قيد المراجعة",
  admin_review: "قيد مراجعة المدير",
  revision: "جاري تعديل العقد",
  factory_review: "قيد موافقة المصنع",
  client_signing: "جاهز للتوقيع",
  admin_approval: "بانتظار موافقة المدير",
  factory_approval: "بانتظار موافقة المورّد",
  signed: "تم التوقيع",
};

const ClientContractPage = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const dealId = searchParams.get("deal_id");
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [codeSent, setCodeSent] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [dealNumber, setDealNumber] = useState<number | null>(null);
  const [clientNotes, setClientNotes] = useState("");

  const fetchContract = async () => {
    if (!dealId) return;
    setLoading(true);

    const { data: deal } = await supabase
      .from("deals")
      .select("deal_number")
      .eq("id", dealId)
      .single();

    if (deal) setDealNumber(deal.deal_number);

    const { data } = await supabase
      .from("deal_contracts")
      .select("*")
      .eq("deal_id", dealId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      setContract(data[0] as unknown as Contract);
    }
    setLoading(false);
  };

  useEffect(() => { fetchContract(); }, [dealId]);

  // Client approves contract → move to signing
  const handleApproveContract = async () => {
    if (!contract) return;
    setActionLoading(true);

    await supabase
      .from("deal_contracts")
      .update({ status: "client_signing", client_notes: null })
      .eq("id", contract.id);

    await supabase
      .from("deals")
      .update({ current_phase: "contract_signing" })
      .eq("id", contract.deal_id);

    toast.success("تمت الموافقة على العقد. يمكنك الآن التوقيع الإلكتروني.");
    setActionLoading(false);
    fetchContract();
  };

  // Client sends notes/objections back
  const handleSendNotes = async () => {
    if (!contract || !clientNotes.trim()) {
      toast.error("يرجى كتابة ملاحظاتك على العقد");
      return;
    }
    setActionLoading(true);

    await supabase
      .from("deal_contracts")
      .update({ status: "client_objection", client_notes: clientNotes.trim() })
      .eq("id", contract.id);

    await supabase
      .from("deals")
      .update({ current_phase: "contract_objection" })
      .eq("id", contract.deal_id);

    toast.success("تم إرسال ملاحظاتك للمدير ووكيل العقود");
    setClientNotes("");
    setActionLoading(false);
    fetchContract();
  };

  const handleSendCode = async () => {
    if (!contract) return;
    setActionLoading(true);

    const { error } = await supabase.functions.invoke("sign-contract", {
      body: { action: "send_code", contract_id: contract.id },
    });

    if (error) {
      toast.error("خطأ في إرسال رمز التوقيع");
    } else {
      toast.success("تم إرسال رمز التوقيع إلى إشعاراتك");
      setCodeSent(true);
    }
    setActionLoading(false);
  };

  const handleSign = async () => {
    if (!contract || !verifyCode.trim()) {
      toast.error("يرجى إدخال رمز التوقيع");
      return;
    }
    setActionLoading(true);

    const { error } = await supabase.functions.invoke("sign-contract", {
      body: { action: "verify_and_sign", contract_id: contract.id, code: verifyCode.trim() },
    });

    if (error) {
      toast.error("رمز التوقيع غير صحيح أو منتهي الصلاحية");
    } else {
      toast.success("تم توقيع العقد بنجاح! 🎉");
      fetchContract();
    }
    setActionLoading(false);
  };

  const handleExportPDF = () => {
    if (!contract) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8" /><title>عقد الصفقة #${dealNumber}</title>
      <style>@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
      *{margin:0;padding:0;box-sizing:border-box}body{font-family:'Cairo',sans-serif;color:#000;padding:40px;line-height:1.8;font-size:14px;background:#fff}
      h1,h2,h3{color:#000;margin-bottom:10px}table{width:100%;border-collapse:collapse;margin:16px 0}th,td{border:1px solid #333;padding:8px 12px;text-align:right}th{background:#f0f0f0;font-weight:700}
      @media print{body{padding:20px}}</style></head><body>${contract.contract_html}</body></html>`);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  if (!dealId) return <div className="text-center py-8 text-muted-foreground">لم يتم تحديد صفقة</div>;

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin ml-2" />
      <span>جاري التحميل...</span>
    </div>
  );

  if (!contract) return (
    <div className="text-center py-8">
      <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
      <p className="text-muted-foreground">لا يوجد عقد متاح لهذه الصفقة حالياً</p>
    </div>
  );

  const isClientReview = contract.status === "client_review";
  const isSignable = contract.status === "client_signing" && !contract.client_signed;
  const statusLabel = STATUS_LABELS[contract.status] || contract.status;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">عقد الصفقة #{dealNumber}</h1>
          <p className="text-muted-foreground">
            {contract.client_name} ↔ {contract.factory_name}
          </p>
        </div>
        <Badge variant={contract.client_signed ? "default" : "outline"} className={contract.client_signed ? "bg-green-600" : ""}>
          {contract.client_signed ? "تم التوقيع ✅" : statusLabel}
        </Badge>
        {contract.client_signed && (
          <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-1">
            <Download className="w-4 h-4" /> تصدير PDF
          </Button>
        )}
      </div>

      {/* Contract document */}
      <div className="bg-white rounded-lg shadow-lg border overflow-hidden">
        <div
          className="p-8 md:p-12 min-h-[600px]"
          dir="rtl"
          style={{
            fontFamily: "'Cairo', 'Tajawal', sans-serif",
            color: "#000",
            lineHeight: "1.8",
            fontSize: "14px",
          }}
          dangerouslySetInnerHTML={{ __html: contract.contract_html }}
        />
      </div>

      {/* Financial summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-4 text-center">
          <p className="text-sm text-muted-foreground">المبلغ الإجمالي</p>
          <p className="text-xl font-bold">{contract.total_amount?.toLocaleString()} {contract.currency}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-sm text-muted-foreground">نسبة المنصة</p>
          <p className="text-xl font-bold">{contract.platform_fee_percentage}%</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-sm text-muted-foreground">نوع الشحن</p>
          <p className="text-xl font-bold">{contract.shipping_type}</p>
        </CardContent></Card>
      </div>

      {/* Client review: approve or send notes */}
      {isClientReview && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              مراجعة العقد
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              يرجى مراجعة العقد بعناية. إذا كنت موافقاً اضغط "موافق على العقد". إذا لديك ملاحظات اكتبها وأرسلها.
            </p>

            <div>
              <Label className="flex items-center gap-2 mb-2">
                <MessageSquareWarning className="w-4 h-4" />
                ملاحظاتك على العقد (اختياري)
              </Label>
              <Textarea
                value={clientNotes}
                onChange={(e) => setClientNotes(e.target.value)}
                placeholder="مثال: أريد تعديل بند الشحن... أو حذف الفقرة المتعلقة بـ..."
                rows={3}
              />
            </div>

            <div className="flex gap-3">
              <Button onClick={handleApproveContract} disabled={actionLoading} className="flex-1">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <CheckCircle className="w-4 h-4 ml-2" />}
                موافق على العقد
              </Button>
              <Button variant="outline" onClick={handleSendNotes} disabled={actionLoading || !clientNotes.trim()}>
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Send className="w-4 h-4 ml-2" />}
                إرسال الملاحظات
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Client objection sent - waiting */}
      {contract.status === "client_objection" && (
        <Card className="border-amber-500">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-amber-600">
              <MessageSquareWarning className="w-6 h-6" />
              <div>
                <p className="font-bold">تم إرسال ملاحظاتك</p>
                <p className="text-sm text-muted-foreground">ملاحظاتك: {contract.client_notes}</p>
                <p className="text-sm mt-1">سيتم مراجعة ملاحظاتك من المدير وإعادة صياغة العقد.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Signing section */}
      {isSignable && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              التوقيع الإلكتروني
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              للتوقيع على العقد، سيتم إرسال رمز تحقق إلى إشعاراتك. أدخل الرمز لتأكيد التوقيع الإلكتروني.
            </p>

            {!codeSent ? (
              <Button onClick={handleSendCode} disabled={actionLoading} className="w-full">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Send className="w-4 h-4 ml-2" />}
                إرسال رمز التوقيع
              </Button>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4" />
                    أدخل رمز التوقيع
                  </Label>
                  <Input
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value)}
                    placeholder="أدخل الرمز المكون من 6 أرقام"
                    className="text-center text-lg tracking-widest mt-1"
                    maxLength={6}
                  />
                </div>
                <div className="flex gap-3">
                  <Button onClick={handleSign} disabled={actionLoading || !verifyCode.trim()} className="flex-1">
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <CheckCircle className="w-4 h-4 ml-2" />}
                    توقيع العقد
                  </Button>
                  <Button variant="outline" onClick={handleSendCode} disabled={actionLoading}>
                    إعادة إرسال الرمز
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Waiting for admin/factory approval after signing */}
      {(contract.status === "admin_approval" || contract.status === "factory_approval") && contract.client_signed && (
        <Card className="border-blue-500">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-blue-600">
              <Loader2 className="w-6 h-6 animate-spin" />
              <div>
                <p className="font-bold">{STATUS_LABELS[contract.status]}</p>
                <p className="text-sm">تم توقيعك بنجاح. بانتظار الاعتمادات النهائية.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {contract.client_signed && contract.status === "signed" && contract.signed_at && (
        <Card className="border-green-500 bg-green-50 dark:bg-green-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-green-600">
              <CheckCircle className="w-6 h-6" />
              <div>
                <p className="font-bold text-lg">تم توقيع العقد واعتماده نهائياً</p>
                <p className="text-sm">تاريخ التوقيع: {new Date(contract.signed_at).toLocaleString("ar-SA")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ClientContractPage;
