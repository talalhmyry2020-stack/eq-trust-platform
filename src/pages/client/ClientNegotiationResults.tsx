import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, DollarSign, Package, ImageIcon, CheckCircle, Check, Truck, Clock } from "lucide-react";
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
  negotiation_phase: number;
  requested_quantity: number | null;
  final_price: number | null;
  shipping_time: string | null;
}

const hiddenKeys = ["الشحن", "وقت التسليم", "Shipping", "Delivery Time"];

const ClientNegotiationResults = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dealId = searchParams.get("deal_id");

  const [negotiations, setNegotiations] = useState<ClientNegotiation[]>([]);
  const [phase2Results, setPhase2Results] = useState<ClientNegotiation[]>([]);
  const [deal, setDeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNeg, setSelectedNeg] = useState<ClientNegotiation | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [quantity, setQuantity] = useState<string>("");
  const [quantityUnit, setQuantityUnit] = useState<string>("وحدة");
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (dealId && user) fetchData();
  }, [dealId, user]);

  const fetchData = async () => {
    setLoading(true);
    const [dealRes, negRes] = await Promise.all([
      supabase.from("deals").select("*").eq("id", dealId!).eq("client_id", user!.id).single(),
      supabase.from("deal_negotiations").select("*").eq("deal_id", dealId!).order("offered_price", { ascending: true }),
    ]);
    setDeal(dealRes.data);
    const allNegs = (negRes.data as unknown as ClientNegotiation[]) || [];
    // Phase 1 responded offers
    setNegotiations(allNegs.filter(n => n.negotiation_phase === 1 && n.status === "responded"));
    // Phase 2 results
    setPhase2Results(allNegs.filter(n => n.negotiation_phase === 2 && n.status === "responded"));
    setLoading(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 2) {
        next.add(id);
      } else {
        toast({ title: "يمكنك اختيار عرضين كحد أقصى", variant: "destructive" });
      }
      return next;
    });
  };

  const handleSubmitSelection = async () => {
    if (selectedIds.size === 0 || !quantity || parseInt(quantity) <= 0) {
      toast({ title: "يرجى اختيار عرض واحد على الأقل وتحديد الكمية", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      // Mark selected negotiations as accepted with quantity
      for (const id of selectedIds) {
        await supabase.from("deal_negotiations").update({ 
          status: "accepted",
          requested_quantity: parseInt(quantity),
          quantity_unit: quantityUnit,
        } as any).eq("id", id);
      }
      // Move deal to negotiating_phase2
      await supabase.from("deals").update({ current_phase: "negotiating_phase2" }).eq("id", dealId!);
      
      toast({ title: "تم إرسال اختيارك بنجاح", description: "سيتم التفاوض مع المصانع على السعر النهائي والكمية المطلوبة" });
      setConfirmSubmit(false);
      // Navigate back to deals list - the deal will show "waiting for phase 2" status
      navigate("/client/deals");
    } catch {
      toast({ title: "خطأ", description: "فشل في إرسال الاختيار", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!dealId) {
    return <div className="text-center py-20 text-muted-foreground">لم يتم تحديد صفقة</div>;
  }

  const alreadySelected = negotiations.some(n => n.status === "accepted");
  const isPhase2 = deal?.current_phase === "negotiating_phase2" || deal?.current_phase === "negotiation_phase2_complete";
  const showPhase1Selection = deal?.current_phase === "negotiation_complete" && !alreadySelected;

  // Phase 2 complete view
  if (deal?.current_phase === "negotiation_phase2_complete" && phase2Results.length > 0) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowRight className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-heading text-2xl font-bold">العرض النهائي</h1>
            {deal && (
              <p className="text-muted-foreground text-sm">
                صفقة #{deal.deal_number} — {deal.product_type || deal.title}
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {phase2Results.map((neg, idx) => (
            <Card key={neg.id} className="overflow-hidden border-primary/30">
              {neg.product_image_url && (
                <div className="w-full h-40 overflow-hidden">
                  <img src={neg.product_image_url} alt="المنتج" className="w-full h-full object-cover" />
                </div>
              )}
              <CardContent className="p-4 space-y-3">
                <h3 className="font-semibold text-lg">العرض النهائي #{idx + 1}</h3>
                <p className="text-sm text-muted-foreground">{neg.product_name}</p>
                
                <div className="grid grid-cols-2 gap-3">
                  <Card>
                    <CardContent className="p-3 text-center">
                      <DollarSign className="w-4 h-4 mx-auto mb-1 text-green-600" />
                      <p className="text-xl font-bold text-green-600">${neg.final_price}</p>
                      <p className="text-xs text-muted-foreground">السعر النهائي / وحدة</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <Package className="w-4 h-4 mx-auto mb-1 text-blue-600" />
                      <p className="text-xl font-bold text-blue-600">{neg.requested_quantity}</p>
                      <p className="text-xs text-muted-foreground">الكمية</p>
                    </CardContent>
                  </Card>
                </div>

                {neg.shipping_time && (
                  <div className="flex items-center gap-2 text-sm bg-muted/50 p-2 rounded-md">
                    <Truck className="w-4 h-4 text-muted-foreground" />
                    <span>فترة الشحن: <strong>{neg.shipping_time}</strong></span>
                  </div>
                )}

                {neg.final_price && neg.requested_quantity && (
                  <div className="text-center bg-primary/5 p-3 rounded-md">
                    <p className="text-sm text-muted-foreground">الإجمالي التقديري</p>
                    <p className="text-2xl font-bold text-primary">${(neg.final_price * neg.requested_quantity).toLocaleString()}</p>
                  </div>
                )}

                {neg.specifications && (() => {
                  const filtered = Object.entries(neg.specifications).filter(([key]) => !hiddenKeys.includes(key));
                  return filtered.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {filtered.map(([key, val]) => (
                        <Badge key={key} variant="outline" className="text-xs">{key}: {String(val)}</Badge>
                      ))}
                    </div>
                  ) : null;
                })()}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Waiting for phase 2 results
  if (deal?.current_phase === "negotiating_phase2") {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowRight className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-heading text-2xl font-bold">جاري التفاوض النهائي</h1>
            {deal && (
              <p className="text-muted-foreground text-sm">
                صفقة #{deal.deal_number} — {deal.product_type || deal.title}
              </p>
            )}
          </div>
        </div>
        <Card>
          <CardContent className="text-center py-16 space-y-4">
            <Clock className="w-12 h-12 mx-auto text-primary animate-pulse" />
            <h2 className="text-xl font-semibold">جاري التفاوض مع المصانع</h2>
            <p className="text-muted-foreground">تم إرسال اختيارك والكمية المطلوبة للمصانع. سنخبرك فور وصول الرد بالسعر النهائي.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

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
            {alreadySelected ? "تم اختيار العروض وإرسالها للتفاوض النهائي" : "لا توجد عروض أسعار لهذه الصفقة بعد"}
          </CardContent>
        </Card>
      ) : (
        <>
          {showPhase1Selection && (
            <div className="bg-muted/50 rounded-lg p-4 mb-4 space-y-3">
              <p className="text-sm font-medium">اختر عرضاً أو عرضين (حد أقصى 2) ثم حدد الكمية ووحدة القياس:</p>
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  type="number"
                  placeholder="الكمية المطلوبة"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  min={1}
                  className="max-w-[160px]"
                  dir="ltr"
                />
                <Select value={quantityUnit} onValueChange={setQuantityUnit}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="وحدة القياس" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="وحدة">وحدة</SelectItem>
                    <SelectItem value="كرتون">كرتون</SelectItem>
                    <SelectItem value="كيلو">كيلو</SelectItem>
                    <SelectItem value="طن">طن</SelectItem>
                    <SelectItem value="لتر">لتر</SelectItem>
                    <SelectItem value="متر">متر</SelectItem>
                    <SelectItem value="قطعة">قطعة</SelectItem>
                  </SelectContent>
                </Select>
                <Badge variant="outline">{selectedIds.size} / 2 عروض مختارة</Badge>
                <Button 
                  onClick={() => setConfirmSubmit(true)} 
                  disabled={selectedIds.size === 0 || !quantity || parseInt(quantity) <= 0}
                  className="gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  تأكيد وإرسال للتفاوض النهائي
                </Button>
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {negotiations.map((neg, idx) => {
              const isSelected = selectedIds.has(neg.id);
              return (
                <Card
                  key={neg.id}
                  className={`cursor-pointer transition-all overflow-hidden ${isSelected ? "border-primary ring-2 ring-primary/20" : "hover:border-primary/50"}`}
                  onClick={() => showPhase1Selection ? toggleSelect(neg.id) : setSelectedNeg(neg)}
                >
                  {showPhase1Selection && (
                    <div className={`h-1 ${isSelected ? "bg-primary" : "bg-transparent"}`} />
                  )}
                  {neg.product_image_url && (
                    <div className="w-full h-40 overflow-hidden relative">
                      <img src={neg.product_image_url} alt="المنتج" className="w-full h-full object-cover" />
                      {isSelected && (
                        <div className="absolute top-2 left-2 bg-primary text-primary-foreground rounded-full p-1">
                          <Check className="w-4 h-4" />
                        </div>
                      )}
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
                      </div>
                    </div>
                    {neg.specifications && Object.keys(neg.specifications).length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {Object.entries(neg.specifications)
                          .filter(([key]) => !hiddenKeys.includes(key))
                          .slice(0, 3).map(([key, val]) => (
                          <Badge key={key} variant="outline" className="text-xs">{key}: {String(val)}</Badge>
                        ))}
                      </div>
                    )}
                    {!showPhase1Selection && isSelected && (
                      <Badge className="mt-2">تم الاختيار</Badge>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* تفاصيل العرض - فقط في حالة غير الاختيار */}
      <Dialog open={!!selectedNeg && !showPhase1Selection} onOpenChange={() => setSelectedNeg(null)}>
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

                {selectedNeg.specifications && Object.keys(selectedNeg.specifications).length > 0 && (() => {
                  const filtered = Object.entries(selectedNeg.specifications).filter(([key]) => !hiddenKeys.includes(key));
                  return filtered.length > 0 ? (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-1"><Package className="w-4 h-4" />المواصفات</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableBody>
                          {filtered.map(([key, val]) => (
                            <TableRow key={key}>
                              <TableCell className="font-medium text-muted-foreground">{key}</TableCell>
                              <TableCell>{String(val)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                  ) : null;
                })()}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* تأكيد الاختيار */}
      <Dialog open={confirmSubmit} onOpenChange={() => setConfirmSubmit(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>تأكيد الاختيار والكمية</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              سيتم إرسال <strong className="text-foreground">{selectedIds.size} عرض(ين)</strong> بكمية <strong className="text-foreground">{quantity} {quantityUnit}</strong> للتفاوض النهائي مع المصانع.
            </p>
            <p className="text-sm text-muted-foreground">
              ستختفي العروض الأخرى وستنتقل الصفقة لمرحلة التفاوض النهائي.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmSubmit(false)}>إلغاء</Button>
            <Button onClick={handleSubmitSelection} disabled={submitting}>
              {submitting ? "جاري الإرسال..." : "تأكيد الإرسال"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientNegotiationResults;
