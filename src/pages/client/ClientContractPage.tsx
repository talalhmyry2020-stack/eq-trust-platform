import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import {
  FileText, Send, CheckCircle, Loader2, ShieldCheck,
  KeyRound, MessageSquareWarning, Download, ChevronLeft,
  ChevronRight, Ship, Truck, Anchor
} from "lucide-react";

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
  signature_code_expires_at: string | null;
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

const SHIPPING_OPTIONS = [
  { value: "FOB", label: "FOB - التسليم في ميناء المورّد", fee: 5, icon: Anchor },
  { value: "CIF", label: "CIF - التسليم في ميناء المستورد", fee: 3, icon: Ship },
  { value: "DOOR_TO_DOOR", label: "Door to Door - من الباب للباب", fee: 7, icon: Truck },
];

// Persistent OTP state using sessionStorage
const OTP_STORAGE_KEY = "contract_otp_state";

interface OTPState {
  contractId: string;
  sentAt: number;
}

function getStoredOTP(): OTPState | null {
  try {
    const raw = sessionStorage.getItem(OTP_STORAGE_KEY);
    if (!raw) return null;
    const state: OTPState = JSON.parse(raw);
    if (Date.now() - state.sentAt > 10 * 60 * 1000) {
      sessionStorage.removeItem(OTP_STORAGE_KEY);
      return null;
    }
    return state;
  } catch { return null; }
}

function setStoredOTP(contractId: string) {
  sessionStorage.setItem(OTP_STORAGE_KEY, JSON.stringify({ contractId, sentAt: Date.now() }));
}

function clearStoredOTP() {
  sessionStorage.removeItem(OTP_STORAGE_KEY);
}

// Extract body content - simple and safe
function extractBodyContent(html: string): string {
  if (!html || html.trim().length === 0) return "";
  
  let content = html;
  
  // Extract body if full HTML document
  const bodyMatch = content.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) {
    content = bodyMatch[1];
  }
  
  // Remove structural tags only
  content = content.replace(/<!DOCTYPE[^>]*>/gi, "");
  content = content.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "");
  content = content.replace(/<\/?html[^>]*>/gi, "");
  content = content.replace(/<\/?body[^>]*>/gi, "");
  content = content.replace(/<meta[^>]*>/gi, "");
  content = content.replace(/<title[^>]*>[\s\S]*?<\/title>/gi, "");
  
  // Remove inline styles that set background colors (keep structure)
  content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  
  return content.trim();
}

// Split HTML contract into pages by <h2> sections
function splitContractPages(html: string): string[] {
  const cleaned = extractBodyContent(html);
  if (!cleaned || cleaned.replace(/<[^>]*>/g, "").trim().length < 20) {
    return [cleaned || "<p>لا يوجد محتوى</p>"];
  }

  // Split by <h2> tags - each section is a page
  const parts = cleaned.split(/(?=<h2[\s>])/gi).filter(p => p.replace(/<[^>]*>/g, "").trim().length > 10);
  
  if (parts.length > 1) return parts;
  
  // Fallback: split by <hr>
  const hrParts = cleaned.split(/<hr\s*\/?>/gi).filter(p => p.replace(/<[^>]*>/g, "").trim().length > 10);
  if (hrParts.length > 1) return hrParts;

  return [cleaned];
}

// Contract document CSS for professional look
const contractCSS = `
  .contract-page {
    font-family: 'Cairo', 'Tajawal', 'Arial', sans-serif;
    color: #000;
    line-height: 2;
    font-size: 15px;
    direction: rtl;
    text-align: right;
  }
  .contract-page h1 {
    font-size: 24px;
    font-weight: 800;
    text-align: center;
    margin-bottom: 16px;
    border-bottom: 3px double #000;
    padding-bottom: 12px;
  }
  .contract-page h2 {
    font-size: 20px;
    font-weight: 700;
    margin-top: 24px;
    margin-bottom: 12px;
    padding: 8px 16px;
    background: #f5f5f5;
    border-right: 4px solid #000;
    border-radius: 0 4px 4px 0;
  }
  .contract-page h3 {
    font-size: 17px;
    font-weight: 700;
    margin-top: 16px;
    margin-bottom: 8px;
  }
  .contract-page p {
    margin-bottom: 8px;
    text-align: justify;
  }
  .contract-page table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
  }
  .contract-page th, .contract-page td {
    border: 1px solid #333;
    padding: 10px 14px;
    text-align: right;
    font-size: 14px;
  }
  .contract-page th {
    background: #e8e8e8;
    font-weight: 700;
  }
  .contract-page ul, .contract-page ol {
    padding-right: 24px;
    margin-bottom: 12px;
  }
  .contract-page li {
    margin-bottom: 6px;
  }
  .contract-page strong, .contract-page b {
    font-weight: 700;
  }
`;

const ClientContractPage = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const dealId = searchParams.get("deal_id");
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifyCode, setVerifyCode] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [dealNumber, setDealNumber] = useState<number | null>(null);
  const [clientNotes, setClientNotes] = useState("");
  const [selectedShipping, setSelectedShipping] = useState("FOB");
  const [currentPage, setCurrentPage] = useState(0);
  const [pages, setPages] = useState<string[]>([]);
  const [otpTimeLeft, setOtpTimeLeft] = useState(0);

  // Check for persisted OTP state
  const storedOTP = getStoredOTP();
  const codeSentPersisted = !!(storedOTP && contract && storedOTP.contractId === contract.id);

  const fetchContract = useCallback(async () => {
    if (!dealId) return;
    setLoading(true);

    const { data: deal } = await supabase
      .from("deals").select("deal_number").eq("id", dealId).single();
    if (deal) setDealNumber(deal.deal_number);

    const { data } = await supabase
      .from("deal_contracts").select("*")
      .eq("deal_id", dealId).order("created_at", { ascending: false }).limit(1);

    if (data && data.length > 0) {
      const c = data[0] as unknown as Contract;
      setContract(c);
      setSelectedShipping(c.shipping_type || "FOB");
      const p = splitContractPages(c.contract_html);
      setPages(p);
      setCurrentPage(0);
    }
    setLoading(false);
  }, [dealId]);

  useEffect(() => { fetchContract(); }, [fetchContract]);

  // OTP countdown timer
  useEffect(() => {
    if (!codeSentPersisted || !storedOTP) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, 10 * 60 * 1000 - (Date.now() - storedOTP.sentAt));
      setOtpTimeLeft(Math.ceil(remaining / 1000));
      if (remaining <= 0) {
        clearStoredOTP();
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [codeSentPersisted, storedOTP?.sentAt]);

  // Approve contract with shipping type
  const handleApproveContract = async () => {
    if (!contract) return;
    setActionLoading(true);

    const shippingOpt = SHIPPING_OPTIONS.find(o => o.value === selectedShipping);
    const fee = shippingOpt?.fee || 5;

    await supabase.from("deal_contracts")
      .update({
        status: "client_signing",
        client_notes: null,
        shipping_type: selectedShipping,
        platform_fee_percentage: fee,
      })
      .eq("id", contract.id);

    await supabase.from("deals")
      .update({ current_phase: "contract_signing" })
      .eq("id", contract.deal_id);

    toast.success("تمت الموافقة على العقد. يمكنك الآن التوقيع.");
    setActionLoading(false);
    fetchContract();
  };

  const handleSendNotes = async () => {
    if (!contract || !clientNotes.trim()) {
      toast.error("يرجى كتابة ملاحظاتك على العقد");
      return;
    }
    setActionLoading(true);

    await supabase.from("deal_contracts")
      .update({ status: "client_objection", client_notes: clientNotes.trim() })
      .eq("id", contract.id);

    await supabase.from("deals")
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
      setStoredOTP(contract.id);
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
      clearStoredOTP();
      fetchContract();
    }
    setActionLoading(false);
  };

  const handleExportPDF = () => {
    if (!contract) return;
    const signatureBlock = contract.client_signed && contract.signed_at
      ? `<div style="margin-top:40px;padding:20px;border:3px solid #000;text-align:center;">
          <h3 style="margin-bottom:10px;font-size:20px;">✅ التوقيع الإلكتروني</h3>
          <p>تم التوقيع إلكترونياً بواسطة: <strong>${contract.client_name}</strong></p>
          <p>تاريخ التوقيع: <strong>${new Date(contract.signed_at).toLocaleString("ar-SA")}</strong></p>
          <p>رقم العقد: <strong>${contract.id.slice(0, 8).toUpperCase()}</strong></p>
          <p style="color:#333;font-size:12px;margin-top:8px;">هذا توقيع إلكتروني معتمد من منصة EQ للوساطة التجارية</p>
        </div>`
      : "";

    const cleanHtml = extractBodyContent(contract.contract_html);

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8" /><title>عقد الصفقة #${dealNumber}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Cairo',sans-serif;color:#000;padding:40px;line-height:2;font-size:15px;background:#fff}
        h1{font-size:24px;font-weight:800;text-align:center;border-bottom:3px double #000;padding-bottom:12px;margin-bottom:20px}
        h2{font-size:20px;font-weight:700;margin-top:20px;margin-bottom:10px;padding:8px 16px;background:#f5f5f5;border-right:4px solid #000}
        h3{font-size:17px;font-weight:700;margin-top:14px;margin-bottom:8px}
        p{margin-bottom:8px;text-align:justify}
        table{width:100%;border-collapse:collapse;margin:16px 0}
        th,td{border:1px solid #333;padding:10px 14px;text-align:right}
        th{background:#e8e8e8;font-weight:700}
        ul,ol{padding-right:24px}li{margin-bottom:6px}
        @media print{body{padding:20px}}
      </style></head><body>${cleanHtml}${signatureBlock}</body></html>`);
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
  const totalPages = pages.length;
  const showSignaturePage = isSignable || (contract.client_signed && contract.signed_at);
  const totalPagesWithSig = totalPages + (showSignaturePage ? 1 : 0);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Calculate financial display
  const shippingOpt = SHIPPING_OPTIONS.find(o => o.value === contract.shipping_type) || SHIPPING_OPTIONS[0];
  const feePercent = contract.platform_fee_percentage || shippingOpt.fee;
  const productAmount = contract.total_amount || 0; // total_amount = product price * quantity
  const platformFeeAmount = productAmount * (feePercent / 100);
  const grandTotal = productAmount + platformFeeAmount;

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-heading text-2xl font-bold">عقد الصفقة #{dealNumber}</h1>
          <p className="text-sm text-muted-foreground">
            {contract.client_name} ↔ {contract.factory_name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={contract.client_signed ? "default" : "outline"} className={contract.client_signed ? "bg-green-600" : ""}>
            {contract.client_signed ? "تم التوقيع ✅" : statusLabel}
          </Badge>
          {contract.client_signed && (
            <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-1">
              <Download className="w-4 h-4" /> تصدير PDF
            </Button>
          )}
        </div>
      </div>

      {/* Client review: shipping selection + approve/notes */}
      {isClientReview && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Ship className="w-5 h-5 text-primary" />
              اختر نوع الشحن
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup value={selectedShipping} onValueChange={setSelectedShipping} className="space-y-3">
              {SHIPPING_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <Label
                    key={opt.value}
                    className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedShipping === opt.value
                        ? "border-primary bg-primary/10 shadow-md"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <RadioGroupItem value={opt.value} />
                    <Icon className="w-6 h-6 text-primary" />
                    <div className="flex-1">
                      <p className="font-bold text-base">{opt.label}</p>
                      <p className="text-sm text-muted-foreground">عمولة المنصة: <strong>{opt.fee}%</strong></p>
                    </div>
                  </Label>
                );
              })}
            </RadioGroup>

            <div>
              <Label className="flex items-center gap-2 mb-2">
                <MessageSquareWarning className="w-4 h-4" />
                ملاحظاتك على العقد (اختياري)
              </Label>
              <Textarea
                value={clientNotes}
                onChange={(e) => setClientNotes(e.target.value)}
                placeholder="مثال: أريد تعديل بند معين..."
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

      {/* Signing section - shows OTP input persistently */}
      {isSignable && (
        <Card className="border-green-600 border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-green-700">
              <ShieldCheck className="w-5 h-5" />
              التوقيع الإلكتروني
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              للتوقيع على العقد، سيتم إرسال رمز تحقق مكون من 6 أرقام إلى إشعاراتك. أدخل الرمز لتأكيد التوقيع.
            </p>

            {!codeSentPersisted ? (
              <Button onClick={handleSendCode} disabled={actionLoading} className="w-full" size="lg">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Send className="w-4 h-4 ml-2" />}
                إرسال رمز التوقيع
              </Button>
            ) : (
              <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                <div className="text-center">
                  <Badge variant="outline" className="text-sm px-4 py-1">
                    ⏱ الرمز صالح لمدة {formatTime(otpTimeLeft)}
                  </Badge>
                </div>
                <div>
                  <Label className="flex items-center gap-2 mb-2 font-bold">
                    <KeyRound className="w-4 h-4" />
                    أدخل رمز التوقيع
                  </Label>
                  <Input
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value)}
                    placeholder="أدخل الرمز المكون من 6 أرقام"
                    className="text-center text-2xl tracking-[0.4em] font-mono h-14 border-2"
                    maxLength={6}
                  />
                </div>
                <div className="flex gap-3">
                  <Button onClick={handleSign} disabled={actionLoading || !verifyCode.trim()} className="flex-1" size="lg">
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <ShieldCheck className="w-4 h-4 ml-2" />}
                    تأكيد التوقيع
                  </Button>
                  <Button variant="outline" onClick={handleSendCode} disabled={actionLoading}>
                    رمز جديد
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Objection status */}
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

      {/* Paginated contract document - professional styling */}
      <style>{contractCSS}</style>
      <div className="bg-white rounded-xl shadow-xl border-2 border-gray-300 overflow-hidden">
        {/* Page indicator */}
        <div className="flex items-center justify-between px-5 py-3 bg-gray-100 border-b-2 border-gray-300">
          <span className="text-sm font-bold text-gray-700">
            📄 صفحة {currentPage + 1} من {totalPagesWithSig}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="sm"
              onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="gap-1"
            >
              <ChevronRight className="w-4 h-4" />
              السابق
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPagesWithSig - 1, p + 1))}
              disabled={currentPage >= totalPagesWithSig - 1}
              className="gap-1"
            >
              التالي
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content pages */}
        {currentPage < totalPages ? (
          <div
            className="contract-page p-8 md:p-14 min-h-[700px] bg-white"
            dir="rtl"
            dangerouslySetInnerHTML={{ __html: pages[currentPage] }}
          />
        ) : showSignaturePage ? (
          /* Electronic Signature Page */
          <div className="p-8 md:p-14 min-h-[700px] bg-white" dir="rtl">
            <div className="max-w-lg mx-auto space-y-8 text-center">
              <div className="border-b-4 border-double border-black pb-6">
                <h2 className="text-3xl font-extrabold text-black">التوقيع الإلكتروني</h2>
                <p className="text-base text-gray-600 mt-2">منصة EQ للوساطة التجارية</p>
              </div>

              {/* Already signed */}
              {contract.client_signed && contract.signed_at && (
                <div className="space-y-6 p-8 border-4 border-green-700 rounded-xl bg-green-50">
                  <CheckCircle className="w-16 h-16 text-green-700 mx-auto" />
                  <p className="font-extrabold text-2xl text-green-800">تم التوقيع إلكترونياً ✅</p>
                  <div className="text-right space-y-3 text-base text-black">
                    <p><strong>الموقّع:</strong> {contract.client_name}</p>
                    <p><strong>تاريخ التوقيع:</strong> {new Date(contract.signed_at).toLocaleString("ar-SA")}</p>
                    <p><strong>رقم العقد:</strong> {contract.id.slice(0, 8).toUpperCase()}</p>
                  </div>
                </div>
              )}

              {/* Not yet signed - info only (OTP is above the document) */}
              {isSignable && !codeSentPersisted && (
                <div className="p-6 border-2 border-dashed border-gray-400 rounded-lg">
                  <p className="text-gray-600 text-lg">
                    اضغط على <strong>"إرسال رمز التوقيع"</strong> في الأعلى للبدء بعملية التوقيع
                  </p>
                </div>
              )}
              {isSignable && codeSentPersisted && (
                <div className="p-6 border-2 border-dashed border-primary rounded-lg">
                  <p className="text-primary text-lg font-bold">
                    أدخل رمز التوقيع في المربع أعلاه لتأكيد التوقيع
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* Financial summary - 4 cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-2">
          <CardContent className="pt-4 text-center">
            <p className="text-xs text-muted-foreground">مبلغ الصفقة</p>
            <p className="text-lg font-bold">{productAmount.toLocaleString("en", { maximumFractionDigits: 0 })} {contract.currency}</p>
          </CardContent>
        </Card>
        <Card className="border-2">
          <CardContent className="pt-4 text-center">
            <p className="text-xs text-muted-foreground">عمولة المنصة ({feePercent}%)</p>
            <p className="text-lg font-bold">{platformFeeAmount.toLocaleString("en", { maximumFractionDigits: 0 })} {contract.currency}</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-primary">
          <CardContent className="pt-4 text-center">
            <p className="text-xs text-muted-foreground">المبلغ الإجمالي</p>
            <p className="text-lg font-bold text-primary">{grandTotal.toLocaleString("en", { maximumFractionDigits: 0 })} {contract.currency}</p>
          </CardContent>
        </Card>
        <Card className="border-2">
          <CardContent className="pt-4 text-center">
            <p className="text-xs text-muted-foreground">نوع الشحن</p>
            <p className="text-lg font-bold">{contract.shipping_type}</p>
          </CardContent>
        </Card>
      </div>

      {/* Waiting for admin/factory approval */}
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
