import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Package, AlertTriangle, Handshake } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import CharterAgreement from "@/components/client/CharterAgreement";
import DealForm from "@/components/client/DealForm";
import ProductCatalog from "@/components/client/ProductCatalog";
import ClientDealDetailDialog from "@/components/client/ClientDealDetailDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

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
  negotiation: "بدء التفاوض",
  negotiating: "جاري التفاوض",
  negotiation_complete: "عروض الأسعار جاهزة",
  product_selected: "تم اختيار المنتج",
  negotiating_phase2: "جاري التفاوض النهائي",
  negotiation_phase2_complete: "العرض النهائي جاهز",
};

const statusVariant = (s: string) => {
  if (s === "pending_review") return "outline" as const;
  if (s === "active") return "default" as const;
  if (s === "delayed") return "destructive" as const;
  return "secondary" as const;
};

const ClientDeals = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [deals, setDeals] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [showCharter, setShowCharter] = useState(false);
  const [charterAccepted, setCharterAccepted] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedDealForProducts, setSelectedDealForProducts] = useState<string | null>(null);
  const [selectedDealDetail, setSelectedDealDetail] = useState<any | null>(null);
  const [objectionDeal, setObjectionDeal] = useState<any | null>(null);
  const [objectionText, setObjectionText] = useState("");
  const [submittingObjection, setSubmittingObjection] = useState(false);

  const fetchDeals = async () => {
    if (!user) return;
    const [d, s] = await Promise.all([
      supabase.from("deals").select("*").eq("client_id", user.id).order("created_at", { ascending: false }),
      supabase.from("deal_stages").select("*").order("display_order"),
    ]);
    setDeals(d.data || []);
    setStages(s.data || []);
  };

  useEffect(() => { fetchDeals(); }, [user]);

  const getStageName = (id: string | null) => stages.find((s) => s.id === id)?.name || "—";

  const submitObjection = async () => {
    if (!objectionDeal || !objectionText.trim() || !user) return;
    setSubmittingObjection(true);
    try {
      const { error } = await supabase.from("deal_objections" as any).insert({
        deal_id: objectionDeal.id,
        client_id: user.id,
        reason: objectionText.trim(),
      } as any);
      if (error) throw error;
      toast({ title: "تم إرسال الاعتراض بنجاح", description: "سيتم مراجعته من قبل الإدارة" });
      setObjectionDeal(null);
      setObjectionText("");
    } catch (err) {
      toast({ title: "خطأ", description: "فشل في إرسال الاعتراض", variant: "destructive" });
    } finally {
      setSubmittingObjection(false);
    }
  };

  const isMobile = useIsMobile();

  const renderDealActions = (deal: any) => (
    <div className="flex gap-1 flex-wrap">
      {(deal.current_phase === "product_selection" || deal.current_phase === "searching_products") && deal.status === "active" && (
        <Button size="sm" variant="outline" onClick={() => setSelectedDealForProducts(deal.id)} className="gap-1">
          <Package className="w-4 h-4" /> المنتجات
        </Button>
      )}
      {(deal.current_phase === "negotiation_complete" || deal.current_phase === "negotiating_phase2" || deal.current_phase === "negotiation_phase2_complete") && deal.status === "active" && (
        <Button size="sm" variant="outline" onClick={() => navigate(`/client/negotiation-results?deal_id=${deal.id}`)} className="gap-1">
          <Handshake className="w-4 h-4" /> العروض
        </Button>
      )}
      {deal.status === "cancelled" && (
        <Button size="sm" variant="outline" onClick={() => setObjectionDeal(deal)} className="gap-1 text-destructive border-destructive/30">
          <AlertTriangle className="w-4 h-4" /> اعتراض
        </Button>
      )}
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3">
        <h1 className="font-heading text-xl md:text-2xl font-bold">صفقاتي</h1>
        <Button onClick={() => setShowCharter(true)} size={isMobile ? "sm" : "default"}>
          <Plus className="w-4 h-4 ml-2" /> إنشاء صفقة
        </Button>
      </div>

      {showCharter && !charterAccepted && (
        <CharterAgreement
          onAgree={() => { setCharterAccepted(true); setShowCharter(false); setShowForm(true); }}
          onCancel={() => setShowCharter(false)}
        />
      )}

      {showForm && (
        <DealForm
          onSubmit={() => { setShowForm(false); setCharterAccepted(false); fetchDeals(); }}
          onCancel={() => { setShowForm(false); setCharterAccepted(false); }}
        />
      )}

      {/* Mobile: cards, Desktop: table */}
      {isMobile ? (
        <div className="space-y-3">
          {deals.length === 0 && (
            <Card><CardContent className="text-center text-muted-foreground py-8">لا توجد صفقات نشطة</CardContent></Card>
          )}
          {deals.map((deal) => (
            <Card key={deal.id} className="cursor-pointer" onClick={() => setSelectedDealDetail(deal)}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">{deal.title}</p>
                    <p className="text-xs text-muted-foreground font-mono">#{deal.deal_number}</p>
                  </div>
                  <Badge variant={statusVariant(deal.status)} className="text-xs shrink-0">
                    {statusMap[deal.status] || deal.status}
                  </Badge>
                </div>
                {deal.current_phase && (
                  <Badge variant="outline" className="text-xs">
                    {phaseMap[deal.current_phase] || deal.current_phase}
                  </Badge>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{new Date(deal.updated_at).toLocaleDateString("ar-SA")}</span>
                  {renderDealActions(deal)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>العنوان</TableHead>
                  <TableHead>المرحلة</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>التقدم</TableHead>
                  <TableHead>آخر تحديث</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deals.map((deal) => (
                  <TableRow key={deal.id} className="cursor-pointer hover:bg-muted/50" onDoubleClick={() => setSelectedDealDetail(deal)}>
                    <TableCell className="font-mono">{deal.deal_number}</TableCell>
                    <TableCell className="font-medium">{deal.title}</TableCell>
                    <TableCell>{getStageName(deal.stage_id)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(deal.status)}>{statusMap[deal.status] || deal.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {deal.current_phase && (
                        <Badge variant="outline" className="text-xs">
                          {phaseMap[deal.current_phase] || deal.current_phase}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{new Date(deal.updated_at).toLocaleDateString("ar-SA")}</TableCell>
                    <TableCell className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      {renderDealActions(deal)}
                    </TableCell>
                  </TableRow>
                ))}
                {deals.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">لا توجد صفقات نشطة</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* كتالوج المنتجات */}
      <Dialog open={!!selectedDealForProducts} onOpenChange={() => setSelectedDealForProducts(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>المنتجات المتاحة</DialogTitle>
          </DialogHeader>
          {selectedDealForProducts && (
            <ProductCatalog
              dealId={selectedDealForProducts}
              onProductSelected={() => {
                toast({ title: "تم اختيار المنتج بنجاح" });
                fetchDeals();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* تفاصيل الصفقة */}
      <ClientDealDetailDialog
        deal={selectedDealDetail}
        open={!!selectedDealDetail}
        onClose={() => setSelectedDealDetail(null)}
      />

      {/* حوار الاعتراض */}
      <Dialog open={!!objectionDeal} onOpenChange={() => { setObjectionDeal(null); setObjectionText(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تقديم اعتراض على الصفقة #{objectionDeal?.deal_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">يمكنك كتابة سبب اعتراضك وسيتم مراجعته من قبل الإدارة.</p>
            <Textarea
              placeholder="اكتب سبب الاعتراض..."
              value={objectionText}
              onChange={(e) => setObjectionText(e.target.value)}
              rows={4}
              dir="rtl"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setObjectionDeal(null); setObjectionText(""); }}>إلغاء</Button>
              <Button onClick={submitObjection} disabled={!objectionText.trim() || submittingObjection}>
                {submittingObjection ? "جاري الإرسال..." : "إرسال الاعتراض"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientDeals;
