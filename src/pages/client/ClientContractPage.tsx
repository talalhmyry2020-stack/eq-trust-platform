import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { FileText, Send, CheckCircle, Loader2, ShieldCheck, KeyRound } from "lucide-react";

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
}

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

  const handleSendCode = async () => {
    if (!contract) return;
    setActionLoading(true);

    const { data, error } = await supabase.functions.invoke("sign-contract", {
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

    const { data, error } = await supabase.functions.invoke("sign-contract", {
      body: { action: "verify_and_sign", contract_id: contract.id, code: verifyCode.trim() },
    });

    if (error) {
      const errMsg = (error as any)?.message || "خطأ في التوقيع";
      toast.error(errMsg);
    } else {
      toast.success("تم توقيع العقد بنجاح! 🎉");
      fetchContract();
    }
    setActionLoading(false);
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

  const isSignable = contract.status === "client_signing" && !contract.client_signed;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">عقد الصفقة #{dealNumber}</h1>
          <p className="text-muted-foreground">
            {contract.shipping_type} | المبلغ: {contract.total_amount?.toLocaleString()} {contract.currency}
          </p>
        </div>
        {contract.client_signed ? (
          <Badge variant="default" className="bg-green-600">تم التوقيع ✅</Badge>
        ) : (
          <Badge variant="outline">بانتظار التوقيع</Badge>
        )}
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

      {contract.client_signed && contract.signed_at && (
        <Card className="border-green-500 bg-green-50 dark:bg-green-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-green-600">
              <CheckCircle className="w-6 h-6" />
              <div>
                <p className="font-bold text-lg">تم توقيع العقد بنجاح</p>
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
