import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { ArrowRight, DollarSign, Package, ImageIcon, CheckCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface ClientNegotiation {
  id: string;
  deal_id: string;
  product_name: string | null;
  offered_price: number | null;
  currency: string | null;
  product_image_url: string | null;
  specifications: Record<string, string>;
  status: string;
  response_date: string | null;
}

const ClientNegotiationResults = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dealId = searchParams.get("deal_id");

  const [negotiations, setNegotiations] = useState<ClientNegotiation[]>([]);
  const [deal, setDeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNeg, setSelectedNeg] = useState<ClientNegotiation | null>(null);
  const [confirmSelect, setConfirmSelect] = useState<ClientNegotiation | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (dealId && user) fetchData();
  }, [dealId, user]);

  const fetchData = async () => {
    setLoading(true);
    const [dealRes, negRes] = await Promise.all([
      supabase.from("deals").select("*").eq("id", dealId!).eq("client_id", user!.id).single(),
      supabase.from("deal_negotiations").select("id, deal_id, product_name, offered_price, currency, product_image_url, specifications, status, response_date").eq("deal_id", dealId!).eq("status", "responded").order("offered_price", { ascending: true }),
    ]);
    setDeal(dealRes.data);
    setNegotiations((negRes.data as unknown as ClientNegotiation[]) || []);
    setLoading(false);
  };

  const handleSelectProduct = async (neg: ClientNegotiation) => {
    setSubmitting(true);
    try {
      // Mark selected negotiation as accepted
      await supabase.from("deal_negotiations").update({ status: "accepted" } as any).eq("id", neg.id);
      // Move deal to next phase
      await supabase.from("deals").update({ current_phase: "product_selected" }).eq("id", dealId!);
      
      toast({ title: "تم اختيار المنتج بنجاح", description: "سيتم متابعة الصفقة في المرحلة التالية" });
      setConfirmSelect(null);
      setSelectedNeg(null);
      fetchData();
    } catch {
      toast({ title: "خطأ", description: "فشل في اختيار المنتج", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!dealId) {
    return <div className="text-center py-20 text-muted-foreground">لم يتم تحديد صفقة</div>;
  }

  const alreadySelected = negotiations.some(n => n.status === "accepted");

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="font-heading text-2xl font-bold">عروض الأسعار المتاحة</h1>
          {deal && (
            <p className="text-muted-foreground text-sm">
              صفقة #{deal.deal_number} — {deal.product_type || deal.title}
            </p>
          )}
        </div>
      </div>

      {/* ملخص */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">{negotiations.length}</p>
            <p className="text-sm text-muted-foreground">عروض متاحة</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-green-600">
              {negotiations.length > 0 ? `$${Math.min(...negotiations.map(n => n.offered_price || Infinity))}` : "—"}
            </p>
            <p className="text-sm text-muted-foreground">أقل سعر</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">
              {negotiations.length > 0 ? `$${Math.max(...negotiations.map(n => n.offered_price || 0))}` : "—"}
            </p>
            <p className="text-sm text-muted-foreground">أعلى سعر</p>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="text-center py-10 text-muted-foreground">جاري التحميل...</div>
      ) : negotiations.length === 0 ? (
        <Card>
          <CardContent className="text-center py-10 text-muted-foreground">
            لا توجد عروض أسعار لهذه الصفقة بعد
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {negotiations.map((neg, idx) => (
            <Card
              key={neg.id}
              className="cursor-pointer hover:border-primary/50 transition-colors overflow-hidden"
              onClick={() => setSelectedNeg(neg)}
            >
              {neg.product_image_url && (
                <div className="w-full h-40 overflow-hidden">
                  <img src={neg.product_image_url} alt="المنتج" className="w-full h-full object-cover" />
                </div>
              )}
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">عرض #{idx + 1}</h3>
                    <p className="text-sm text-muted-foreground">{neg.product_name}</p>
                  </div>
                  <div className="text-left">
                    {neg.offered_price && (
                      <p className="text-xl font-bold text-green-600">${neg.offered_price}</p>
                    )}
                    {neg.status === "accepted" && (
                      <Badge className="mt-1">تم الاختيار</Badge>
                    )}
                  </div>
                </div>
                {neg.specifications && Object.keys(neg.specifications).length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {Object.entries(neg.specifications).slice(0, 3).map(([key, val]) => (
                      <Badge key={key} variant="outline" className="text-xs">{key}: {String(val)}</Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* تفاصيل العرض */}
      <Dialog open={!!selectedNeg && !confirmSelect} onOpenChange={() => setSelectedNeg(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedNeg && (
            <>
              <DialogHeader>
                <DialogTitle>تفاصيل العرض</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                {selectedNeg.product_image_url && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-1"><ImageIcon className="w-4 h-4" />صورة المنتج</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <img src={selectedNeg.product_image_url} alt="المنتج" className="w-full max-h-60 object-cover rounded-lg" />
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-1"><DollarSign className="w-4 h-4" />السعر</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-green-600">
                      ${selectedNeg.offered_price} <span className="text-sm font-normal text-muted-foreground">{selectedNeg.currency}</span>
                    </p>
                  </CardContent>
                </Card>

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

                {!alreadySelected && deal?.current_phase === "negotiation_complete" && (
                  <Button
                    className="w-full gap-2"
                    size="lg"
                    onClick={() => setConfirmSelect(selectedNeg)}
                  >
                    <CheckCircle className="w-5 h-5" />
                    اختيار هذا العرض
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* تأكيد الاختيار */}
      <Dialog open={!!confirmSelect} onOpenChange={() => setConfirmSelect(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>تأكيد اختيار العرض</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            هل أنت متأكد من اختيار هذا العرض بسعر <strong className="text-foreground">${confirmSelect?.offered_price}</strong>؟
            سيتم المتابعة في الخطوات التالية.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmSelect(null)}>إلغاء</Button>
            <Button onClick={() => confirmSelect && handleSelectProduct(confirmSelect)} disabled={submitting}>
              {submitting ? "جاري التأكيد..." : "تأكيد الاختيار"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientNegotiationResults;
