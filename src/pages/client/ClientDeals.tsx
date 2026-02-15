import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Package } from "lucide-react";
import CharterAgreement from "@/components/client/CharterAgreement";
import DealForm from "@/components/client/DealForm";
import ProductCatalog from "@/components/client/ProductCatalog";
import ClientDealDetailDialog from "@/components/client/ClientDealDetailDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  const [deals, setDeals] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [showCharter, setShowCharter] = useState(false);
  const [charterAccepted, setCharterAccepted] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedDealForProducts, setSelectedDealForProducts] = useState<string | null>(null);
  const [selectedDealDetail, setSelectedDealDetail] = useState<any | null>(null);

  const fetchDeals = async () => {
    if (!user) return;
    const [d, s] = await Promise.all([
      supabase.from("deals").select("*").eq("client_id", user.id).not("status", "in", '("completed","cancelled")').order("created_at", { ascending: false }),
      supabase.from("deal_stages").select("*").order("display_order"),
    ]);
    setDeals(d.data || []);
    setStages(s.data || []);
  };

  useEffect(() => { fetchDeals(); }, [user]);

  const getStageName = (id: string | null) => stages.find((s) => s.id === id)?.name || "—";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl font-bold">صفقاتي</h1>
        <Button onClick={() => setShowCharter(true)}>
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
                  <TableCell>
                    {(deal.current_phase === "product_selection" || deal.current_phase === "searching_products") && deal.status === "active" && (
                      <Button size="sm" variant="outline" onClick={() => setSelectedDealForProducts(deal.id)} className="gap-1">
                        <Package className="w-4 h-4" /> المنتجات
                      </Button>
                    )}
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
    </div>
  );
};

export default ClientDeals;
