import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRight, Mail, Phone, Globe, DollarSign, Package, Image, MessageSquare } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Negotiation {
  id: string;
  deal_id: string;
  factory_name: string;
  factory_email: string | null;
  factory_phone: string | null;
  factory_country: string | null;
  product_name: string | null;
  message_sent: string | null;
  factory_response: string | null;
  offered_price: number | null;
  currency: string | null;
  product_image_url: string | null;
  specifications: Record<string, string>;
  status: string;
  response_date: string | null;
  created_at: string;
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "بانتظار الرد", variant: "outline" },
  responded: { label: "تم الرد", variant: "default" },
  accepted: { label: "مقبول", variant: "default" },
  rejected: { label: "مرفوض", variant: "destructive" },
};

const DealNegotiationsPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dealId = searchParams.get("deal_id");
  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
  const [deal, setDeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNeg, setSelectedNeg] = useState<Negotiation | null>(null);

  useEffect(() => {
    if (dealId) fetchData();
  }, [dealId]);

  const fetchData = async () => {
    setLoading(true);
    const [dealRes, negRes] = await Promise.all([
      supabase.from("deals").select("*").eq("id", dealId!).single(),
      supabase.from("deal_negotiations").select("*").eq("deal_id", dealId!).order("created_at"),
    ]);
    setDeal(dealRes.data);
    setNegotiations((negRes.data as unknown as Negotiation[]) || []);
    setLoading(false);
  };

  if (!dealId) {
    return <div className="text-center py-20 text-muted-foreground">لم يتم تحديد صفقة</div>;
  }

  const respondedCount = negotiations.filter(n => n.status === "responded").length;
  const avgPrice = negotiations.filter(n => n.offered_price).reduce((sum, n) => sum + (n.offered_price || 0), 0) / (respondedCount || 1);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="font-heading text-2xl font-bold">نتائج التفاوض</h1>
          {deal && (
            <p className="text-muted-foreground text-sm">
              صفقة #{deal.deal_number} — {deal.product_type || deal.title}
            </p>
          )}
        </div>
      </div>

      {/* ملخص */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">{negotiations.length}</p>
            <p className="text-sm text-muted-foreground">مصانع تم التواصل معها</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-green-600">{respondedCount}</p>
            <p className="text-sm text-muted-foreground">ردود مستلمة</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">{negotiations.length - respondedCount}</p>
            <p className="text-sm text-muted-foreground">بانتظار الرد</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">${Math.round(avgPrice)}</p>
            <p className="text-sm text-muted-foreground">متوسط السعر المعروض</p>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="text-center py-10 text-muted-foreground">جاري التحميل...</div>
      ) : negotiations.length === 0 ? (
        <Card>
          <CardContent className="text-center py-10 text-muted-foreground">
            لا توجد نتائج تفاوض لهذه الصفقة بعد
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {negotiations.map((neg) => {
            const st = STATUS_LABELS[neg.status] || { label: neg.status, variant: "secondary" as const };
            return (
              <Card key={neg.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setSelectedNeg(neg)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-lg">{neg.factory_name}</h3>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        {neg.factory_email && (
                          <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{neg.factory_email}</span>
                        )}
                        {neg.factory_phone && (
                          <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{neg.factory_phone}</span>
                        )}
                        {neg.factory_country && (
                          <span className="flex items-center gap-1"><Globe className="w-3 h-3" />{neg.factory_country}</span>
                        )}
                      </div>
                      {neg.factory_response && (
                        <p className="text-sm bg-muted/50 rounded-lg p-3 mt-2">{neg.factory_response}</p>
                      )}
                    </div>
                    <div className="text-left shrink-0">
                      {neg.offered_price ? (
                        <div className="text-center">
                          <p className="text-2xl font-bold text-green-600">${neg.offered_price}</p>
                          <p className="text-xs text-muted-foreground">{neg.currency}</p>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">—</p>
                      )}
                      {neg.product_image_url && (
                        <img src={neg.product_image_url} alt="المنتج" className="w-20 h-20 object-cover rounded-lg mt-2 border" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* تفاصيل التفاوض */}
      <Dialog open={!!selectedNeg} onOpenChange={() => setSelectedNeg(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedNeg && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  تفاصيل التفاوض — {selectedNeg.factory_name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                {/* الرسالة المرسلة */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">الرسالة المرسلة من الشركة</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm bg-primary/5 rounded-lg p-3">{selectedNeg.message_sent}</p>
                  </CardContent>
                </Card>

                {/* رد المصنع */}
                {selectedNeg.factory_response && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-muted-foreground">رد المصنع</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm bg-green-50 dark:bg-green-950/20 rounded-lg p-3">{selectedNeg.factory_response}</p>
                    </CardContent>
                  </Card>
                )}

                {/* السعر والصورة */}
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-1"><DollarSign className="w-4 h-4" />السعر المعروض</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {selectedNeg.offered_price ? (
                        <p className="text-3xl font-bold text-green-600">${selectedNeg.offered_price} <span className="text-sm font-normal text-muted-foreground">{selectedNeg.currency}</span></p>
                      ) : (
                        <p className="text-muted-foreground">لم يتم تقديم عرض</p>
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-1"><Image className="w-4 h-4" />صورة المنتج</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {selectedNeg.product_image_url ? (
                        <img src={selectedNeg.product_image_url} alt="المنتج" className="w-full max-h-40 object-cover rounded-lg" />
                      ) : (
                        <p className="text-muted-foreground text-sm">لا تتوفر صورة</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* المواصفات */}
                {selectedNeg.specifications && Object.keys(selectedNeg.specifications).length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-1"><Package className="w-4 h-4" />المواصفات</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableBody>
                          {Object.entries(selectedNeg.specifications).map(([key, val]) => (
                            <TableRow key={key}>
                              <TableCell className="font-medium text-muted-foreground">{key}</TableCell>
                              <TableCell>{String(val)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}

                {/* معلومات التواصل */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">معلومات التواصل</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {selectedNeg.factory_email && (
                      <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground" />{selectedNeg.factory_email}</div>
                    )}
                    {selectedNeg.factory_phone && (
                      <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" /><span dir="ltr">{selectedNeg.factory_phone}</span></div>
                    )}
                    {selectedNeg.factory_country && (
                      <div className="flex items-center gap-2"><Globe className="w-4 h-4 text-muted-foreground" />{selectedNeg.factory_country}</div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DealNegotiationsPage;
