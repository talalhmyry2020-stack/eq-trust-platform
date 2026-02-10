import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Clock, User, MapPin, FileText, Package, Globe, Loader2 } from "lucide-react";

interface DealSummaryProps {
  deal: {
    deal_number?: number;
    client_full_name: string;
    country: string;
    city: string;
    national_id: string;
    commercial_register_number: string;
    entity_type: string;
    product_type: string;
    product_description: string;
    import_country: string;
    status: string;
  };
  verificationStatus?: "pending" | "phase1" | "phase2" | "done" | "error";
  onClose: () => void;
}

const statusMap: Record<string, string> = {
  pending_review: "قيد المراجعة",
  active: "نشطة",
  delayed: "متأخرة",
  paused: "متوقفة",
  completed: "مكتملة",
  cancelled: "ملغاة",
};

const DealSummaryCard = ({ deal, verificationStatus = "pending", onClose }: DealSummaryProps) => {
  const verificationLabel = () => {
    switch (verificationStatus) {
      case "phase1": return "جاري التحقق من المستندات...";
      case "phase2": return "جاري التحقق من المنتج...";
      case "done": return "اكتمل التحقق";
      case "error": return "حدث خطأ في التحقق";
      default: return "في انتظار التحقق";
    }
  };

  const isProcessing = verificationStatus === "phase1" || verificationStatus === "phase2";

  return (
    <Card className="mb-6 border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-heading flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            ملخص الصفقة {deal.deal_number ? `#${deal.deal_number}` : ""}
          </CardTitle>
          <div className="flex items-center gap-2">
            {isProcessing && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
            <Badge variant={verificationStatus === "done" ? "default" : verificationStatus === "error" ? "destructive" : "outline"}>
              {verificationLabel()}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* الحالة */}
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">الحالة:</span>
          <Badge variant="outline">{statusMap[deal.status] || deal.status}</Badge>
        </div>

        <Separator />

        {/* بيانات العميل */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">الاسم:</span>
            <span className="font-medium">{deal.client_full_name}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">الموقع:</span>
            <span className="font-medium">{deal.city}، {deal.country}</span>
          </div>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">رقم الهوية:</span>
            <span className="font-medium font-mono" dir="ltr">{deal.national_id}</span>
          </div>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">السجل التجاري:</span>
            <span className="font-medium font-mono" dir="ltr">{deal.commercial_register_number}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">نوع الكيان:</span>
            <span className="font-medium">{deal.entity_type}</span>
          </div>
        </div>

        <Separator />

        {/* بيانات المنتج */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">نوع المنتج:</span>
            <span className="font-medium">{deal.product_type}</span>
          </div>
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">دولة الاستيراد:</span>
            <span className="font-medium">{deal.import_country}</span>
          </div>
          <div className="col-span-full flex items-start gap-2">
            <span className="text-muted-foreground shrink-0">الوصف:</span>
            <span className="font-medium">{deal.product_description}</span>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground underline">
            إغلاق
          </button>
        </div>
      </CardContent>
    </Card>
  );
};

export default DealSummaryCard;
