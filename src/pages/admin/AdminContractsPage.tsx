import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { FileText, CheckCircle, Clock, AlertCircle, Loader2, Eye } from "lucide-react";

interface ContractRow {
  id: string;
  deal_id: string;
  status: string;
  client_name: string | null;
  factory_name: string | null;
  shipping_type: string;
  platform_fee_percentage: number;
  total_amount: number | null;
  currency: string;
  client_signed: boolean;
  signed_at: string | null;
  created_at: string;
  revision_count: number;
  deals: { deal_number: number; title: string; current_phase: string | null } | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  drafting: { label: "جاري الصياغة", color: "bg-gray-500" },
  client_review: { label: "مراجعة العميل", color: "bg-blue-500" },
  client_objection: { label: "اعتراض العميل", color: "bg-amber-500" },
  revision: { label: "جاري التعديل", color: "bg-orange-500" },
  client_signing: { label: "بانتظار التوقيع", color: "bg-purple-500" },
  admin_approval: { label: "بانتظار اعتمادك", color: "bg-indigo-500" },
  factory_approval: { label: "بانتظار المصنع", color: "bg-cyan-500" },
  signed: { label: "تم التوقيع ✅", color: "bg-green-600" },
};

const AdminContractsPage = () => {
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchContracts = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("deal_contracts")
        .select("*, deals!deal_contracts_deal_id_fkey(deal_number, title, current_phase)")
        .order("created_at", { ascending: false });

      if (data) setContracts(data as unknown as ContractRow[]);
      setLoading(false);
    };
    fetchContracts();
  }, []);

  const filtered = contracts.filter((c) => {
    if (tab === "all") return true;
    if (tab === "signed") return c.client_signed;
    if (tab === "pending") return !c.client_signed && c.status !== "drafting";
    if (tab === "review") return c.status === "admin_approval";
    return true;
  });

  const counts = {
    all: contracts.length,
    signed: contracts.filter((c) => c.client_signed).length,
    pending: contracts.filter((c) => !c.client_signed && c.status !== "drafting").length,
    review: contracts.filter((c) => c.status === "admin_approval").length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin ml-2" />
        <span>جاري التحميل...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">لوحة العقود</h1>
          <p className="text-sm text-muted-foreground">إدارة ومتابعة جميع العقود</p>
        </div>
        <div className="flex gap-3">
          <Card className="px-4 py-2 text-center">
            <p className="text-xs text-muted-foreground">إجمالي</p>
            <p className="text-xl font-bold">{counts.all}</p>
          </Card>
          <Card className="px-4 py-2 text-center border-green-500">
            <p className="text-xs text-muted-foreground">موقّعة</p>
            <p className="text-xl font-bold text-green-600">{counts.signed}</p>
          </Card>
          <Card className="px-4 py-2 text-center border-amber-500">
            <p className="text-xs text-muted-foreground">بانتظار اعتمادك</p>
            <p className="text-xl font-bold text-amber-600">{counts.review}</p>
          </Card>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-4 w-full max-w-lg">
          <TabsTrigger value="all">الكل ({counts.all})</TabsTrigger>
          <TabsTrigger value="signed">موقّعة ({counts.signed})</TabsTrigger>
          <TabsTrigger value="pending">قيد الانتظار ({counts.pending})</TabsTrigger>
          <TabsTrigger value="review">تحتاج اعتمادك ({counts.review})</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>لا توجد عقود في هذا القسم</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((c) => {
                const deal = c.deals as any;
                const st = STATUS_LABELS[c.status] || { label: c.status, color: "bg-gray-500" };
                const productAmount = c.total_amount || 0;
                const feeAmount = productAmount * (c.platform_fee_percentage / 100);

                return (
                  <Card key={c.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-base">
                              صفقة #{deal?.deal_number || "—"}
                            </span>
                            <Badge className={`${st.color} text-white text-xs`}>{st.label}</Badge>
                            {c.revision_count > 0 && (
                              <Badge variant="outline" className="text-xs">مراجعة {c.revision_count}</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {deal?.title || "بدون عنوان"}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span>👤 {c.client_name || "—"}</span>
                            <span>🏭 {c.factory_name || "—"}</span>
                            <span>🚢 {c.shipping_type}</span>
                            <span>💰 {productAmount.toLocaleString()} {c.currency}</span>
                            <span>📊 عمولة {c.platform_fee_percentage}% = {feeAmount.toLocaleString()} {c.currency}</span>
                          </div>
                          {c.signed_at && (
                            <p className="text-xs text-green-600 mt-1">
                              ✅ وُقّع بتاريخ: {new Date(c.signed_at).toLocaleString("ar-SA")}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 shrink-0"
                          onClick={() => navigate(`/admin/contract-review?deal_id=${c.deal_id}`)}
                        >
                          <Eye className="w-4 h-4" />
                          عرض
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminContractsPage;
