import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { User, MapPin, FileText, Package, Globe, Download, ExternalLink, Clock } from "lucide-react";

interface DealDetailDialogProps {
  deal: any;
  open: boolean;
  onClose: () => void;
  clientName: string;
  accountOwnerName?: string;
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending_review: { label: "قيد المراجعة", variant: "outline" },
  active: { label: "نشطة", variant: "default" },
  delayed: { label: "متأخرة", variant: "secondary" },
  paused: { label: "متوقفة", variant: "outline" },
  completed: { label: "مكتملة", variant: "default" },
  cancelled: { label: "ملغاة", variant: "destructive" },
};

const PHASE_MAP: Record<string, string> = {
  verification: "التحقق من البيانات",
  product_search: "البحث عن المنتج",
  searching_products: "جاري البحث عن منتجات",
  product_selection: "اختيار المنتج",
};

const DealDetailDialog = ({ deal, open, onClose, clientName, accountOwnerName }: DealDetailDialogProps) => {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open && deal) {
      generateSignedUrls();
    }
  }, [open, deal]);

  const generateSignedUrls = async () => {
    const urls: Record<string, string> = {};
    for (const field of ["identity_doc_url", "commercial_register_doc_url", "product_image_url"]) {
      const path = deal[field];
      if (path) {
        const { data } = await supabase.storage
          .from("deal-documents")
          .createSignedUrl(path, 3600);
        if (data?.signedUrl) urls[field] = data.signedUrl;
      }
    }
    setSignedUrls(urls);
  };

  if (!deal) return null;

  const st = STATUS_MAP[deal.status] || { label: deal.status, variant: "secondary" as const };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>تفاصيل الصفقة #{deal.deal_number}</span>
            <div className="flex gap-2">
              <Badge variant={st.variant}>{st.label}</Badge>
              {deal.current_phase && (
                <Badge variant="outline" className="text-xs">
                  {PHASE_MAP[deal.current_phase] || deal.current_phase}
                </Badge>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* بيانات العميل */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="w-4 h-4" /> بيانات العميل
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">الاسم:</span>
                <span className="font-medium mr-2">{deal.client_full_name || clientName}</span>
              </div>
              <div>
                <span className="text-muted-foreground">الموقع:</span>
                <span className="font-medium mr-2">{deal.city}، {deal.country}</span>
              </div>
              <div>
                <span className="text-muted-foreground">نوع الكيان:</span>
                <span className="font-medium mr-2">{deal.entity_type || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">صاحب الحساب:</span>
                <span className="font-medium mr-2">{accountOwnerName || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">التاريخ:</span>
                <span className="font-medium font-mono mr-2">{new Date(deal.created_at).toLocaleDateString("ar-SA")}</span>
              </div>
            </CardContent>
          </Card>

          {/* البيانات القانونية */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="w-4 h-4" /> البيانات القانونية
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">رقم الهوية:</span>
                <span className="font-medium font-mono mr-2" dir="ltr">{deal.national_id || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">رقم السجل التجاري:</span>
                <span className="font-medium font-mono mr-2" dir="ltr">{deal.commercial_register_number || "—"}</span>
              </div>
            </CardContent>
          </Card>

          {/* المستندات */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Download className="w-4 h-4" /> المستندات المرفقة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {signedUrls.identity_doc_url ? (
                <a href={signedUrls.identity_doc_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline">
                  <ExternalLink className="w-4 h-4" /> صورة الهوية (PDF)
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">لا يوجد ملف هوية</p>
              )}
              {signedUrls.commercial_register_doc_url ? (
                <a href={signedUrls.commercial_register_doc_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline">
                  <ExternalLink className="w-4 h-4" /> السجل التجاري (PDF)
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">لا يوجد سجل تجاري</p>
              )}
              {signedUrls.product_image_url && (
                <div className="mt-3">
                  <p className="text-sm text-muted-foreground mb-2">صورة المنتج:</p>
                  <img src={signedUrls.product_image_url} alt="صورة المنتج" className="max-w-xs rounded-lg border" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* بيانات المنتج */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Package className="w-4 h-4" /> بيانات المنتج
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">نوع المنتج:</span>
                <span className="font-medium mr-2">{deal.product_type || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">دولة الاستيراد:</span>
                <span className="font-medium mr-2">{deal.import_country || "—"}</span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">الوصف:</span>
                <p className="font-medium mt-1">{deal.product_description || deal.description || "—"}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DealDetailDialog;
