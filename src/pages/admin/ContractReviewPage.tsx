import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { FileText, CheckCircle, RotateCcw, Loader2, Factory } from "lucide-react";

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
  revision_count: number;
  client_signed: boolean;
  signed_at: string | null;
  created_at: string;
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  drafting: { label: "جاري الصياغة", variant: "outline" },
  client_review: { label: "بانتظار اختيار العميل للشحن", variant: "secondary" },
  admin_review: { label: "قيد مراجعة المدير", variant: "secondary" },
  revision: { label: "قيد التعديل", variant: "outline" },
  factory_review: { label: "قيد موافقة المصنع", variant: "secondary" },
  client_signing: { label: "بانتظار توقيع العميل", variant: "default" },
  signed: { label: "تم التوقيع", variant: "default" },
};

const SHIPPING_LABELS: Record<string, string> = {
  CIF: "CIF - ميناء المستورد (3%)",
  FOB: "FOB - ميناء المورّد (5%)",
  DOOR_TO_DOOR: "Door to Door - باب لباب (7%)",
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

  // Admin approves → send to factory
  const handleApproveForFactory = async () => {
    if (!contract) return;
    setActionLoading(true);
    
    await supabase
      .from("deal_contracts")
      .update({ status: "factory_review" })
      .eq("id", contract.id);

    await supabase
      .from("deals")
      .update({ current_phase: "contract_factory_review" })
      .eq("id", contract.deal_id);

    toast.success("تم اعتماد العقد وإرساله للمصنع للموافقة");
    setActionLoading(false);
    fetchContract();
  };

  // Simulate factory approval → send to client for signing
  const handleFactoryApproval = async () => {
    if (!contract) return;
    setActionLoading(true);

    await supabase
      .from("deal_contracts")
      .update({ status: "client_signing" })
      .eq("id", contract.id);

    await supabase
      .from("deals")
      .update({ current_phase: "contract_signing" })
      .eq("id", contract.deal_id);

    toast.success("وافق المصنع على العقد - تم إرساله للعميل للتوقيع");
    setActionLoading(false);
    fetchContract();
  };

  const handleRequestRevision = async () => {
    if (!contract || !adminNotes.trim()) {
      toast.error("يرجى كتابة ملاحظات التعديل");
      return;
    }
    setActionLoading(true);

    await supabase
      .from("deal_contracts")
      .update({ 
        status: "revision", 
        admin_notes: adminNotes,
      })
      .eq("id", contract.id);

    await supabase
      .from("deals")
      .update({ current_phase: "contract_revision" })
      .eq("id", contract.deal_id);

    try {
      const res = await supabase.functions.invoke("draft-contract", {
        body: { deal_id: contract.deal_id, admin_notes: adminNotes },
      });
      if (res.error) throw res.error;
      toast.success("تم إرسال التعديلات لوكيل العقود");
    } catch (e) {
      toast.error("خطأ في إعادة الصياغة");
    }

    setAdminNotes("");
    setActionLoading(false);
    setTimeout(fetchContract, 3000);
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
            {contract.client_name} ↔ {contract.factory_name} | {SHIPPING_LABELS[contract.shipping_type] || contract.shipping_type}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={st.variant}>{st.label}</Badge>
          {contract.revision_count > 0 && (
            <Badge variant="outline">مراجعة #{contract.revision_count}</Badge>
          )}
        </div>
      </div>

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
          <p className="text-sm text-muted-foreground">نوع الشحن (اختاره العميل)</p>
          <p className="text-lg font-bold">{contract.shipping_type}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-sm text-muted-foreground">الحالة</p>
          <p className="text-xl font-bold">{contract.client_signed ? "موقّع ✅" : "غير موقّع"}</p>
        </CardContent></Card>
      </div>

      {/* Contract document - styled like a real paper */}
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

      {/* Admin actions - approve or revise */}
      {contract.status === "admin_review" && (
        <Card>
          <CardHeader>
            <CardTitle>إجراءات المدير</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>ملاحظات التعديل (اختياري - لإعادة الصياغة)</Label>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="اكتب ملاحظاتك هنا لإعادة صياغة العقد..."
                rows={3}
              />
            </div>

            <div className="flex gap-3">
              <Button onClick={handleApproveForFactory} disabled={actionLoading} className="flex-1">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <CheckCircle className="w-4 h-4 ml-2" />}
                اعتماد العقد وإرساله للمصنع
              </Button>
              <Button variant="outline" onClick={handleRequestRevision} disabled={actionLoading || !adminNotes.trim()}>
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <RotateCcw className="w-4 h-4 ml-2" />}
                إعادة صياغة
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Factory approval action */}
      {contract.status === "factory_review" && (
        <Card className="border-amber-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Factory className="w-5 h-5 text-amber-500" />
              موافقة المصنع
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              العقد بانتظار موافقة المصنع. بعد الموافقة سيُرسل للعميل للتوقيع الإلكتروني.
            </p>
            <p className="text-sm text-muted-foreground font-bold">
              ⚠️ شرط العقد: لا يبدأ العمل حتى تأكيد المبلغ في حساب الوسيط الذكي وتفعيل التوكنات.
            </p>
            <Button onClick={handleFactoryApproval} disabled={actionLoading} className="w-full">
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <CheckCircle className="w-4 h-4 ml-2" />}
              تأكيد موافقة المصنع وإرسال للتوقيع
            </Button>
          </CardContent>
        </Card>
      )}

      {contract.client_signed && contract.signed_at && (
        <Card className="border-green-500">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-5 h-5" />
              <span className="font-bold">تم التوقيع الإلكتروني بتاريخ: {new Date(contract.signed_at).toLocaleString("ar-SA")}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ContractReviewPage;
