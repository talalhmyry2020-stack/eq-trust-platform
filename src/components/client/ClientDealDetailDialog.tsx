import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { User, MapPin, FileText, Package, Globe, DollarSign, Star, Check, Loader2 } from "lucide-react";

const statusMap: Record<string, string> = {
  pending_review: "قيد المراجعة",
  active: "نشطة",
  delayed: "متأخرة",
  paused: "متوقفة",
  completed: "مكتملة",
  cancelled: "ملغاة",
};

const phaseMap: Record<string, string> = {
  verification: "التحقق",
  product_search: "البحث عن منتج",
  searching_products: "جاري البحث",
  product_selection: "اختيار المنتج",
  results_ready: "النتائج جاهزة",
};

interface ClientDealDetailDialogProps {
  deal: any | null;
  open: boolean;
  onClose: () => void;
}

const ClientDealDetailDialog = ({ deal, open, onClose }: ClientDealDetailDialogProps) => {
  const [products, setProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => {
    if (!deal?.id || !open) return;
    setLoadingProducts(true);
    supabase
      .from("deal_product_results")
      .select("*")
      .eq("deal_id", deal.id)
      .order("created_at")
      .then(({ data }) => {
        setProducts((data as any[]) || []);
        setLoadingProducts(false);
      });
  }, [deal?.id, open]);

  if (!deal) return null;

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            تفاصيل الصفقة #{deal.deal_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* الحالة والمرحلة */}
          <div className="flex flex-wrap gap-2">
            <Badge variant={deal.status === "active" ? "default" : deal.status === "delayed" ? "destructive" : "outline"}>
              {statusMap[deal.status] || deal.status}
            </Badge>
            {deal.current_phase && (
              <Badge variant="secondary">
                {phaseMap[deal.current_phase] || deal.current_phase}
              </Badge>
            )}
          </div>

          <Separator />

          {/* بيانات العميل */}
          <div>
            <h3 className="font-semibold text-sm text-muted-foreground mb-2">بيانات العميل</h3>
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
          </div>

          <Separator />

          {/* بيانات المنتج */}
          <div>
            <h3 className="font-semibold text-sm text-muted-foreground mb-2">بيانات المنتج</h3>
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
              {deal.estimated_amount && (
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">المبلغ التقريبي:</span>
                  <span className="font-medium">${Number(deal.estimated_amount).toLocaleString()}</span>
                </div>
              )}
              <div className="col-span-full flex items-start gap-2">
                <span className="text-muted-foreground shrink-0">الوصف:</span>
                <span className="font-medium">{deal.product_description}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* التواريخ */}
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>تاريخ الإنشاء: {new Date(deal.created_at).toLocaleDateString("ar-SA")}</span>
            <span>آخر تحديث: {new Date(deal.updated_at).toLocaleDateString("ar-SA")}</span>
          </div>

          {/* نتائج البحث */}
          {loadingProducts ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="mr-2 text-sm text-muted-foreground">جاري تحميل نتائج البحث...</span>
            </div>
          ) : products.length > 0 ? (
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground mb-3">نتائج البحث ({products.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {products.map((p) => (
                  <Card key={p.id} className={`transition-all ${p.selected ? "border-primary ring-2 ring-primary/20" : ""}`}>
                    {p.product_image_url && (
                      <div className="aspect-video overflow-hidden rounded-t-lg">
                        <img src={p.product_image_url} alt={p.product_name} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between">
                        <h4 className="font-medium text-sm">{p.product_name}</h4>
                        {p.selected && (
                          <Badge variant="default" className="text-xs shrink-0">
                            <Check className="w-3 h-3 ml-1" /> مختار
                          </Badge>
                        )}
                      </div>
                      {p.price && (
                        <p className="text-lg font-bold text-primary">
                          {Number(p.price).toLocaleString()} {p.currency}
                        </p>
                      )}
                      {p.quality_rating && (
                        <div className="flex items-center gap-1 text-xs">
                          <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                          <span>{p.quality_rating}</span>
                        </div>
                      )}
                      {p.specifications && Object.keys(p.specifications).length > 0 && (
                        <div className="text-xs space-y-0.5">
                          {Object.entries(p.specifications).slice(0, 3).map(([key, val]) => (
                            <div key={key} className="flex justify-between">
                              <span className="text-muted-foreground">{key}:</span>
                              <span>{String(val)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ClientDealDetailDialog;
