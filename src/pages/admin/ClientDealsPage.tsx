import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRight, User, FileSearch } from "lucide-react";
import DealDetailDialog from "@/components/admin/DealDetailDialog";

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
  searching_products: "جاري البحث",
  results_ready: "النتائج جاهزة",
  product_selection: "اختيار المنتج",
};

const ClientDealsPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const clientUserId = searchParams.get("user_id");

  const [clientProfile, setClientProfile] = useState<any>(null);
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeal, setSelectedDeal] = useState<any>(null);

  useEffect(() => {
    if (clientUserId) fetchData();
  }, [clientUserId]);

  const fetchData = async () => {
    setLoading(true);
    const [profileRes, dealsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", clientUserId!).single(),
      supabase.from("deals").select("*").eq("client_id", clientUserId!).order("created_at", { ascending: false }),
    ]);

    setClientProfile(profileRes.data);
    setDeals(dealsRes.data || []);
    setLoading(false);
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" });

  if (!clientUserId) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        لم يتم تحديد العميل
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/users")}>
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="font-heading text-2xl font-bold">
            صفقات العميل
          </h1>
          {clientProfile && (
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <User className="w-4 h-4" />
              <span>{clientProfile.full_name || "بدون اسم"}</span>
              {clientProfile.email && (
                <span className="font-mono text-xs">({clientProfile.email})</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {!loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{deals.length}</p>
              <p className="text-xs text-muted-foreground">إجمالي الصفقات</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-600">
                {deals.filter(d => d.status === "active").length}
              </p>
              <p className="text-xs text-muted-foreground">نشطة</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">
                {deals.filter(d => d.status === "completed").length}
              </p>
              <p className="text-xs text-muted-foreground">مكتملة</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-orange-600">
                {deals.filter(d => d.status === "pending_review").length}
              </p>
              <p className="text-xs text-muted-foreground">قيد المراجعة</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Deals Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">جميع الصفقات ({deals.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">جارٍ التحميل...</div>
          ) : deals.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">لا توجد صفقات لهذا العميل</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم الصفقة</TableHead>
                  <TableHead>نوع المنتج</TableHead>
                  <TableHead>دولة الاستيراد</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>المرحلة</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deals.map((deal) => {
                  const st = STATUS_MAP[deal.status] || { label: deal.status, variant: "secondary" as const };
                  return (
                    <TableRow
                      key={deal.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedDeal(deal)}
                    >
                      <TableCell className="font-mono font-bold">#{deal.deal_number}</TableCell>
                      <TableCell>{deal.product_type || "—"}</TableCell>
                      <TableCell>{deal.import_country || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {PHASE_MAP[deal.current_phase] || deal.current_phase || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{formatDate(deal.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedDeal(deal)}
                            title="تفاصيل الصفقة"
                          >
                            تفاصيل
                          </Button>
                          {(deal.current_phase === "results_ready" || deal.current_phase === "searching_products" || deal.current_phase === "product_selection") && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-primary"
                              onClick={() => navigate(`/admin/deal-search-results?deal_id=${deal.id}`)}
                              title="نتائج البحث"
                            >
                              <FileSearch className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Deal Detail Dialog */}
      <DealDetailDialog
        deal={selectedDeal}
        open={!!selectedDeal}
        onClose={() => setSelectedDeal(null)}
        clientName={clientProfile?.full_name || ""}
        accountOwnerName={clientProfile?.email || ""}
      />
    </div>
  );
};

export default ClientDealsPage;
