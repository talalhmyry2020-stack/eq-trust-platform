import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { FileText, Send, Edit, CheckCircle, RotateCcw, Loader2 } from "lucide-react";

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
  admin_review: { label: "قيد مراجعة المدير", variant: "secondary" },
  revision: { label: "قيد التعديل", variant: "outline" },
  client_signing: { label: "بانتظار توقيع العميل", variant: "default" },
  signed: { label: "تم التوقيع", variant: "default" },
};

const ContractReviewPage = () => {
  const [searchParams] = useSearchParams();
  const dealId = searchParams.get("deal_id");
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminNotes, setAdminNotes] = useState("");
  const [shippingType, setShippingType] = useState("FOB");
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

    const { data, error } = await supabase
      .from("deal_contracts")
      .select("*")
      .eq("deal_id", dealId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const c = data[0] as unknown as Contract;
      setContract(c);
      setShippingType(c.shipping_type);
    }
    setLoading(false);
  };

  useEffect(() => { fetchContract(); }, [dealId]);

  const handleApproveForSigning = async () => {
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

    toast.success("تم اعتماد العقد وإرساله للعميل للتوقيع");
    setActionLoading(false);
    fetchContract();
  };

  const handleRequestRevision = async () => {
    if (!contract || !adminNotes.trim()) {
      toast.error("يرجى كتابة ملاحظات التعديل");
      return;
    }
    setActionLoading(true);

    // Update contract shipping type if changed
    await supabase
      .from("deal_contracts")
      .update({ 
        status: "revision", 
        admin_notes: adminNotes,
        shipping_type: shippingType,
      })
      .eq("id", contract.id);

    await supabase
      .from("deals")
      .update({ current_phase: "contract_revision" })
      .eq("id", contract.deal_id);

    // Trigger AI revision
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">مراجعة العقد - الصفقة #{dealNumber}</h1>
          <p className="text-muted-foreground">
            {contract.client_name} ↔ {contract.factory_name} | {contract.shipping_type} | ربح المنصة: {contract.platform_fee_percentage}%
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={st.variant}>{st.label}</Badge>
          {contract.revision_count > 0 && (
            <Badge variant="outline">مراجعة #{contract.revision_count}</Badge>
          )}
        </div>
      </div>

      {/* Contract financial summary */}
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
          <p className="text-xl font-bold">{contract.shipping_type}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-sm text-muted-foreground">الحالة</p>
          <p className="text-xl font-bold">{contract.client_signed ? "موقّع ✅" : "غير موقّع"}</p>
        </CardContent></Card>
      </div>

      {/* Contract content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            نص العقد
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div 
            className="prose prose-sm max-w-none bg-white dark:bg-gray-900 p-6 rounded-lg border min-h-[400px] overflow-auto"
            dir="rtl"
            dangerouslySetInnerHTML={{ __html: contract.contract_html }}
          />
        </CardContent>
      </Card>

      {/* Admin actions */}
      {contract.status === "admin_review" && (
        <Card>
          <CardHeader>
            <CardTitle>إجراءات المدير</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <Label>نوع الشحن (يؤثر على نسبة الربح)</Label>
                <Select value={shippingType} onValueChange={setShippingType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CIF">CIF - من ميناء المستورد (3%)</SelectItem>
                    <SelectItem value="FOB">FOB - من ميناء المورد (5%)</SelectItem>
                    <SelectItem value="DOOR_TO_DOOR">Door to Door - باب لباب (7%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>ملاحظات التعديل (اختياري - لإعادة الصياغة)</Label>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="اكتب ملاحظاتك هنا لإعادة صياغة العقد بواسطة الوكيل..."
                rows={3}
              />
            </div>

            <div className="flex gap-3">
              <Button onClick={handleApproveForSigning} disabled={actionLoading} className="flex-1">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <CheckCircle className="w-4 h-4 ml-2" />}
                اعتماد العقد وإرساله للتوقيع
              </Button>
              <Button variant="outline" onClick={handleRequestRevision} disabled={actionLoading || !adminNotes.trim()}>
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <RotateCcw className="w-4 h-4 ml-2" />}
                إعادة صياغة
              </Button>
            </div>
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
