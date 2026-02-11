import { useState, useRef } from "react";
import DealSummaryCard from "./DealSummaryCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Image, Loader2, ShieldCheck } from "lucide-react";

const COUNTRIES = ["مصر", "السعودية", "الإمارات", "أخرى"];
const IMPORT_COUNTRIES = ["مصر", "الصين"];
const EGYPT_CITIES = [
  "القاهرة", "الإسكندرية", "الجيزة", "شبرا الخيمة", "بورسعيد",
  "السويس", "المنصورة", "طنطا", "الأقصر", "أسوان",
  "الزقازيق", "دمياط", "المنيا", "أسيوط", "سوهاج",
  "بني سويف", "الفيوم", "قنا", "المحلة الكبرى", "الإسماعيلية",
];

interface DealFormProps {
  onSubmit: () => void;
  onCancel: () => void;
}

const DealForm = ({ onSubmit, onCancel }: DealFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [submittedDeal, setSubmittedDeal] = useState<any>(null);
  const [verificationStatus, setVerificationStatus] = useState<"pending" | "phase1" | "phase2" | "done" | "error">("pending");

  const [clientFullName, setClientFullName] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [commercialRegNumber, setCommercialRegNumber] = useState("");
  const [entityType, setEntityType] = useState("");
  const [productType, setProductType] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [importCountry, setImportCountry] = useState("");
  const [agreement, setAgreement] = useState(false);

  const [identityFile, setIdentityFile] = useState<File | null>(null);
  const [commercialFile, setCommercialFile] = useState<File | null>(null);
  const [productImage, setProductImage] = useState<File | null>(null);

  const identityRef = useRef<HTMLInputElement>(null);
  const commercialRef = useRef<HTMLInputElement>(null);
  const productRef = useRef<HTMLInputElement>(null);

  const isEgypt = country === "مصر";
  const descLength = productDescription.length;

  const isValid =
    clientFullName.trim() &&
    country &&
    city.trim() &&
    nationalId.trim() &&
    commercialRegNumber.trim() &&
    entityType &&
    identityFile &&
    commercialFile &&
    productType.trim() &&
    productDescription.trim() &&
    productDescription.length <= 100 &&
    importCountry &&
    agreement;

  const uploadFile = async (file: File, folder: string) => {
    if (!user) return null;
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${folder}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("deal-documents").upload(path, file);
    if (error) throw error;
    return path;
  };

  const handleSubmit = async () => {
    if (!user || !isValid) return;
    setSubmitting(true);
    try {
      const [identityPath, commercialPath, productPath] = await Promise.all([
        uploadFile(identityFile!, "identity"),
        uploadFile(commercialFile!, "commercial"),
        productImage ? uploadFile(productImage, "product") : Promise.resolve(null),
      ]);

      const { data: dealData, error } = await supabase.from("deals").insert({
        title: productType.trim(),
        deal_type: "وساطة",
        description: productDescription.trim(),
        client_id: user.id,
        created_by: user.id,
        client_full_name: clientFullName.trim(),
        country,
        city: city.trim(),
        national_id: nationalId.trim(),
        commercial_register_number: commercialRegNumber.trim(),
        entity_type: entityType,
        identity_doc_url: identityPath,
        commercial_register_doc_url: commercialPath,
        product_type: productType.trim(),
        product_description: productDescription.trim(),
        product_image_url: productPath || "",
        import_country: importCountry,
        status: "pending_review" as any,
      }).select("id, deal_number").single();

      if (error) throw error;

      // حفظ بيانات الصفقة لعرض الملخص
      const dealSummary = {
        deal_number: dealData?.deal_number,
        client_full_name: clientFullName.trim(),
        country,
        city: city.trim(),
        national_id: nationalId.trim(),
        commercial_register_number: commercialRegNumber.trim(),
        entity_type: entityType,
        product_type: productType.trim(),
        product_description: productDescription.trim(),
        import_country: importCountry,
        status: "pending_review",
      };
      setSubmittedDeal(dealSummary);
      setVerificationStatus("phase1");

      toast({ title: "تم الإرسال", description: "تم إنشاء الصفقة بنجاح وجاري التحقق..." });

      // إرسال للـ webhook على مرحلتين (غير معطل)
      if (dealData?.id) {
        try {
          setVerificationStatus("phase1");
          const { data: webhookResult, error: webhookError } = await supabase.functions.invoke("send-deal-webhook", {
            body: { deal_id: dealData.id },
          });

          if (webhookError) {
            console.error("Webhook error:", webhookError);
            setVerificationStatus("error");
          } else {
            setVerificationStatus("done");
            // تحديث الحالة في الملخص بناءً على نتيجة الـ webhook
            if (webhookResult?.final_status) {
              setSubmittedDeal((prev: any) => ({ ...prev, status: webhookResult.final_status }));
            }
          }
        } catch (e) {
          console.error("Webhook failed:", e);
          setVerificationStatus("error");
        }
      }
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message || "فشل إنشاء الصفقة", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const FileUploadButton = ({
    label,
    accept,
    file,
    inputRef,
    onChange,
    icon: Icon,
    required = true,
  }: {
    label: string;
    accept: string;
    file: File | null;
    inputRef: React.RefObject<HTMLInputElement>;
    onChange: (f: File | null) => void;
    icon: typeof FileText;
    required?: boolean;
  }) => (
    <div>
      <Label className="mb-1.5 block">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] || null)}
      />
      <Button
        type="button"
        variant="outline"
        className="w-full justify-start gap-2 h-auto py-3"
        onClick={() => inputRef.current?.click()}
      >
        <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
        <span className="truncate text-sm">
          {file ? file.name : "اضغط لاختيار الملف"}
        </span>
        <Upload className="w-4 h-4 mr-auto text-muted-foreground" />
      </Button>
    </div>
  );

  // إذا تم إرسال الصفقة، عرض الملخص فقط
  if (submittedDeal) {
    return (
      <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-y-auto">
        <div className="max-w-2xl mx-auto py-8 px-4">
          <DealSummaryCard
            deal={submittedDeal}
            verificationStatus={verificationStatus}
            onClose={onSubmit}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-y-auto">
      <div className="max-w-2xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-4">
            <ShieldCheck className="w-7 h-7 text-primary" />
          </div>
          <h1 className="font-heading text-2xl font-bold mb-2">نموذج بيانات الصفقة</h1>
          <p className="text-muted-foreground text-sm">
            يرجى تعبئة جميع الحقول المطلوبة بدقة لضمان معالجة طلبك بسرعة
          </p>
        </div>

        <div className="space-y-8">
          {/* القسم الأول: بيانات العميل */}
          <section className="space-y-4">
            <h2 className="font-heading text-lg font-semibold border-b border-border pb-2 text-primary">
              🟦 القسم الأول: بيانات العميل
            </h2>
            <div>
              <Label htmlFor="fullName">الاسم الكامل للعميل <span className="text-destructive">*</span></Label>
              <Input id="fullName" value={clientFullName} onChange={(e) => setClientFullName(e.target.value)} placeholder="أدخل الاسم الكامل" className="mt-1.5" />
            </div>
            <div>
              <Label>الدولة <span className="text-destructive">*</span></Label>
              <Select value={country} onValueChange={(v) => { setCountry(v); setCity(""); }}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="اختر الدولة" /></SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>المدينة <span className="text-destructive">*</span></Label>
              {isEgypt ? (
                <Select value={city} onValueChange={setCity}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="اختر المدينة" /></SelectTrigger>
                  <SelectContent>
                    {EGYPT_CITIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="أدخل المدينة" className="mt-1.5" />
              )}
            </div>
          </section>

          {/* القسم الثاني: البيانات القانونية */}
          <section className="space-y-4">
            <h2 className="font-heading text-lg font-semibold border-b border-border pb-2 text-primary">
              🟦 القسم الثاني: البيانات القانونية
            </h2>
            <div>
              <Label htmlFor="nationalId">رقم الهوية الوطنية <span className="text-destructive">*</span></Label>
              <Input id="nationalId" value={nationalId} onChange={(e) => setNationalId(e.target.value)} placeholder="أدخل رقم الهوية" className="mt-1.5" dir="ltr" />
            </div>
            <div>
              <Label htmlFor="commercialReg">رقم السجل التجاري <span className="text-destructive">*</span></Label>
              <Input id="commercialReg" value={commercialRegNumber} onChange={(e) => setCommercialRegNumber(e.target.value)} placeholder="أدخل رقم السجل التجاري" className="mt-1.5" dir="ltr" />
            </div>
            <div>
              <Label>نوع الكيان التجاري <span className="text-destructive">*</span></Label>
              <RadioGroup value={entityType} onValueChange={setEntityType} className="flex gap-6 mt-2">
                {["فرد", "شركة", "مؤسسة"].map((t) => (
                  <div key={t} className="flex items-center gap-2">
                    <RadioGroupItem value={t} id={`entity-${t}`} />
                    <Label htmlFor={`entity-${t}`} className="cursor-pointer font-normal">{t}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </section>

          {/* القسم الثالث: المستندات */}
          <section className="space-y-4">
            <h2 className="font-heading text-lg font-semibold border-b border-border pb-2 text-primary">
              🟦 القسم الثالث: المستندات
            </h2>
            <FileUploadButton
              label="صورة الهوية (صورة)"
              accept="image/*"
              file={identityFile}
              inputRef={identityRef as React.RefObject<HTMLInputElement>}
              onChange={setIdentityFile}
              icon={Image}
            />
            <FileUploadButton
              label="السجل التجاري (صورة)"
              accept="image/*"
              file={commercialFile}
              inputRef={commercialRef as React.RefObject<HTMLInputElement>}
              onChange={setCommercialFile}
              icon={Image}
            />
          </section>

          {/* القسم الرابع: بيانات المنتج */}
          <section className="space-y-4">
            <h2 className="font-heading text-lg font-semibold border-b border-border pb-2 text-primary">
              🟦 القسم الرابع: بيانات المنتج
            </h2>
            <div>
              <Label htmlFor="productType">نوع المنتج <span className="text-destructive">*</span></Label>
              <Input id="productType" value={productType} onChange={(e) => setProductType(e.target.value)} placeholder="مثال: أجهزة إلكترونية، ملابس..." className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="productDesc">وصف المنتج <span className="text-destructive">*</span></Label>
              <Textarea
                id="productDesc"
                value={productDescription}
                onChange={(e) => { if (e.target.value.length <= 100) setProductDescription(e.target.value); }}
                placeholder="وصف مختصر للمنتج"
                rows={2}
                className="mt-1.5"
              />
              <p className={`text-xs mt-1 text-left ${descLength > 90 ? "text-destructive" : "text-muted-foreground"}`}>
                {descLength}/100
              </p>
            </div>
            <FileUploadButton
              label="صورة المنتج (إن وُجدت)"
              accept="image/*"
              file={productImage}
              inputRef={productRef as React.RefObject<HTMLInputElement>}
              onChange={setProductImage}
              icon={Image}
              required={false}
            />
          </section>

          {/* القسم الخامس: دولة الاستيراد */}
          <section className="space-y-4">
            <h2 className="font-heading text-lg font-semibold border-b border-border pb-2 text-primary">
              🟦 القسم الخامس: دولة الاستيراد
            </h2>
            <div>
              <Label>الدولة المستورد منها <span className="text-destructive">*</span></Label>
              <Select value={importCountry} onValueChange={setImportCountry}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="اختر دولة الاستيراد" /></SelectTrigger>
                <SelectContent>
                  {IMPORT_COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </section>

          {/* القسم السادس: الإقرار */}
          <section className="space-y-4">
            <h2 className="font-heading text-lg font-semibold border-b border-border pb-2 text-primary">
              🟦 القسم السادس: الإقرار والموافقة
            </h2>
            <div className="flex items-start gap-3 p-4 rounded-lg border border-border bg-muted/30">
              <Checkbox
                id="agreement"
                checked={agreement}
                onCheckedChange={(v) => setAgreement(v === true)}
                className="mt-0.5"
              />
              <Label htmlFor="agreement" className="cursor-pointer font-normal text-sm leading-relaxed">
                أقرّ بأن جميع البيانات والمستندات صحيحة، وأتحمل مسؤولية أي خطأ قد يؤدي إلى رفض الطلب.
              </Label>
            </div>
          </section>

          {/* Buttons */}
          <div className="flex gap-3 pt-4 border-t border-border">
            <Button onClick={handleSubmit} disabled={!isValid || submitting} className="flex-1 gap-2">
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الإرسال...</> : "إرسال الطلب"}
            </Button>
            <Button variant="outline" onClick={onCancel} disabled={submitting}>
              إلغاء
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DealForm;
