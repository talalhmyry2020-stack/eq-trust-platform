import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { FileText, CheckCircle, RotateCcw, Loader2, Factory, AlertTriangle, MessageSquareWarning } from "lucide-react";

interface Contract {
  id: string;
  deal_id: string;
  contract_html: string;
  contract_text: string;
  shipping_type: string;
  platform_fee_percentage: number;
  total_amount: number;
  currency: string;
  client_name: string;
  factory_name: string;
  client_country: string;
  factory_country: string;
  status: string;
  admin_notes: string | null;
  client_notes: string | null;
  revision_count: number;
  client_signed: boolean;
  signed_at: string | null;
  created_at: string;
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  drafting: { label: "جاري الصياغة", variant: "outline" },
  client_review: { label: "بانتظار مراجعة العميل", variant: "secondary" },
  client_objection: { label: "⚠️ العميل لديه ملاحظات", variant: "destructive" },
  admin_review: { label: "قيد مراجعة المدير", variant: "secondary" },
  revision: { label: "قيد التعديل بواسطة الوكيل", variant: "outline" },
  client_signing: { label: "بانتظار توقيع العميل", variant: "default" },
  admin_approval: { label: "بانتظار موافقتك", variant: "default" },
  factory_approval: { label: "بانتظار موافقة المورّد", variant: "secondary" },
  signed: { label: "تم التوقيع والاعتماد", variant: "default" },
};

const ContractReviewPage = () => {
  const [searchParams] = useSearchParams();
  const dealId = searchParams.get("deal_id");
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminNotes, setAdminNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [dealNumber, setDealNumber] = useState<number | null>(null);

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

  // Admin sends client objection + own notes to agent for revision
  const handleSendToAgent = async () => {
    if (!contract) return;
    setActionLoading(true);

    const combinedNotes = [
      contract.client_notes ? `ملاحظات العميل: ${contract.client_notes}` : "",
      adminNotes.trim() ? `تعليمات المدير: ${adminNotes.trim()}` : "",
    ].filter(Boolean).join("\n\n");

    if (!combinedNotes) {
      toast.error("لا توجد ملاحظات لإرسالها للوكيل");
      setActionLoading(false);
      return;
    }

    await supabase
      .from("deal_contracts")
      .update({ status: "revision", admin_notes: adminNotes.trim() || null })
      .eq("id", contract.id);

    await supabase
      .from("deals")
      .update({ current_phase: "contract_revision" })
      .eq("id", contract.deal_id);

    try {
      const res = await supabase.functions.invoke("draft-contract", {
        body: { deal_id: contract.deal_id, admin_notes: combinedNotes },
      });
      if (res.error) throw res.error;
      toast.success("تم إرسال التعديلات لوكيل العقود - سيعاد إرسال العقد المعدّل للعميل");
    } catch (e) {
      toast.error("خطأ في إعادة الصياغة");
    }

    setAdminNotes("");
    setActionLoading(false);
    setTimeout(fetchContract, 3000);
  };

  // Admin approves after client signed
  const handleAdminApproval = async () => {
    if (!contract) return;
    setActionLoading(true);

    await supabase
      .from("deal_contracts")
      .update({ status: "factory_approval" })
      .eq("id", contract.id);

    await supabase
      .from("deals")
      .update({ current_phase: "contract_factory_approval" })
      .eq("id", contract.deal_id);

    toast.success("تم اعتماد العقد. بانتظار موافقة المورّد.");
    setActionLoading(false);
    fetchContract();
  };

  // Admin confirms factory approval → signed
  const handleFactoryApproval = async () => {
    if (!contract) return;
    setActionLoading(true);

    await supabase
      .from("deal_contracts")
      .update({ status: "signed" })
      .eq("id", contract.id);

    await supabase
      .from("deals")
      .update({ current_phase: "contract_signed" })
      .eq("id", contract.deal_id);

    // Notify client
    const { data: deal } = await supabase
      .from("deals")
      .select("client_id")
      .eq("id", contract.deal_id)
      .single();

    if (deal?.client_id) {
      await supabase.from("notifications").insert({
        user_id: deal.client_id,
        title: `تم اعتماد العقد نهائياً - الصفقة #${dealNumber}`,
        message: "تم اعتماد العقد من جميع الأطراف. يمكنك الاطلاع على النسخة النهائية.",
        type: "contract_signed",
        entity_type: "deal",
        entity_id: contract.deal_id,
      });
    }

    toast.success("تم اعتماد العقد نهائياً من جميع الأطراف! 🎉");
    setActionLoading(false);
    fetchContract();
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
      <p className="text-muted-foreground">لا يوجد عقد لهذه الصفقة بعد</p>
    </div>
  );

  const st = STATUS_LABELS[contract.status] || { label: contract.status, variant: "secondary" as const };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">مراجعة العقد - الصفقة #{dealNumber}</h1>
          <p className="text-muted-foreground">
            {contract.client_name} ↔ {contract.factory_name}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={st.variant}>{st.label}</Badge>
          {contract.revision_count > 0 && (
            <Badge variant="outline">مراجعة #{contract.revision_count}</Badge>
          )}
        </div>
      </div>

      {/* Client objection alert */}
      {contract.status === "client_objection" && contract.client_notes && (
        <Card className="border-destructive bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              ملاحظات العميل على العقد
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-background rounded-lg p-4 border">
              <p className="font-medium">{contract.client_notes}</p>
            </div>

            <div>
              <Label>تعليمات إضافية لوكيل العقود (اختياري)</Label>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="أضف تعليماتك للوكيل: عدّل البند الثالث... احذف الفقرة... أضف شرطاً..."
                rows={3}
              />
            </div>

            <Button onClick={handleSendToAgent} disabled={actionLoading} className="w-full">
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <RotateCcw className="w-4 h-4 ml-2" />}
              إرسال للوكيل لإعادة الصياغة
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Financial summary */}
      <div className="grid grid-cols-4 gap-4">
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
          <p className="text-lg font-bold">{contract.shipping_type}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-sm text-muted-foreground">الحالة</p>
          <p className="text-xl font-bold">{contract.client_signed ? "موقّع ✅" : "غير موقّع"}</p>
        </CardContent></Card>
      </div>

      {/* Contract document */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            نص العقد
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-white rounded-lg border shadow-inner overflow-auto">
            <div
              className="p-8 md:p-12 min-h-[500px]"
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
        </CardContent>
      </Card>

      {/* Admin approval after client signed */}
      {contract.status === "admin_approval" && contract.client_signed && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-primary" />
              اعتماد العقد
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              العميل وقّع على العقد. اضغط "موافق" لاعتماد العقد والانتقال لموافقة المورّد.
            </p>
            <Button onClick={handleAdminApproval} disabled={actionLoading} className="w-full">
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <CheckCircle className="w-4 h-4 ml-2" />}
              موافق - اعتماد العقد
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Factory approval */}
      {contract.status === "factory_approval" && (
        <Card className="border-amber-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Factory className="w-5 h-5 text-amber-500" />
              موافقة المورّد
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              بانتظار موافقة المورّد على العقد. بعد الموافقة يتم اعتماد العقد نهائياً وتبدأ المرحلة التالية.
            </p>
            <p className="text-sm text-muted-foreground font-bold">
              ⚠️ لا يبدأ العمل حتى تأكيد المبلغ في حساب الوسيط الذكي وتفعيل التوكنات.
            </p>
            <Button onClick={handleFactoryApproval} disabled={actionLoading} className="w-full">
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <CheckCircle className="w-4 h-4 ml-2" />}
              تأكيد موافقة المورّد - اعتماد نهائي
            </Button>
          </CardContent>
        </Card>
      )}

      {contract.status === "signed" && contract.signed_at && (
        <Card className="border-green-500">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-5 h-5" />
              <span className="font-bold">تم التوقيع والاعتماد النهائي بتاريخ: {new Date(contract.signed_at).toLocaleString("ar-SA")}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ContractReviewPage;
