import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import {
  FileText, CheckCircle, Loader2, Eye, Lock,
  AlertTriangle, MessageSquareWarning, ShieldCheck
} from "lucide-react";

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
  client_notes: string | null;
  deals: { deal_number: number; title: string; current_phase: string | null } | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  drafting: { label: "جاري الصياغة", color: "bg-muted text-muted-foreground" },
  client_review: { label: "بانتظار مراجعة العميل", color: "bg-blue-500/20 text-blue-400" },
  client_objection: { label: "اعتراض العميل ⚠️", color: "bg-amber-500/20 text-amber-400" },
  revision: { label: "جاري التعديل", color: "bg-orange-500/20 text-orange-400" },
  client_signing: { label: "بانتظار توقيع العميل", color: "bg-purple-500/20 text-purple-400" },
  admin_approval: { label: "بانتظار اعتمادك", color: "bg-primary/20 text-primary" },
  factory_approval: { label: "بانتظار المصنع", color: "bg-cyan-500/20 text-cyan-400" },
  signed: { label: "تم التوقيع ✅", color: "bg-green-600/20 text-green-400" },
};

// Statuses that mean the client has approved/signed (can enter contract review)
const CLIENT_APPROVED_STATUSES = ["client_signing", "admin_approval", "factory_approval", "signed"];

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
    if (tab === "approved") return CLIENT_APPROVED_STATUSES.includes(c.status) || c.client_signed;
    if (tab === "signed") return c.client_signed && c.status === "signed";
    if (tab === "objections") return c.status === "client_objection";
    if (tab === "review") return c.status === "admin_approval";
    return true;
  });

  const counts = {
    all: contracts.length,
    approved: contracts.filter((c) => CLIENT_APPROVED_STATUSES.includes(c.status) || c.client_signed).length,
    signed: contracts.filter((c) => c.client_signed && c.status === "signed").length,
    objections: contracts.filter((c) => c.status === "client_objection").length,
    review: contracts.filter((c) => c.status === "admin_approval").length,
  };

  const canEnterContract = (c: ContractRow) => {
    return CLIENT_APPROVED_STATUSES.includes(c.status) || c.client_signed || c.status === "client_objection";
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
      {/* Header with stats */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold">لوحة العقود</h1>
          <p className="text-sm text-muted-foreground">إدارة ومتابعة جميع العقود والاعتراضات</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Card className="px-4 py-2 text-center">
            <p className="text-xs text-muted-foreground">إجمالي</p>
            <p className="text-xl font-bold">{counts.all}</p>
          </Card>
          <Card className="px-4 py-2 text-center border-green-600">
            <p className="text-xs text-muted-foreground">موقّعة نهائياً</p>
            <p className="text-xl font-bold text-green-500">{counts.signed}</p>
          </Card>
          <Card className="px-4 py-2 text-center border-primary">
            <p className="text-xs text-muted-foreground">تحتاج اعتمادك</p>
            <p className="text-xl font-bold text-primary">{counts.review}</p>
          </Card>
          {counts.objections > 0 && (
            <Card className="px-4 py-2 text-center border-amber-500">
              <p className="text-xs text-muted-foreground">اعتراضات</p>
              <p className="text-xl font-bold text-amber-500">{counts.objections}</p>
            </Card>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="all">الكل ({counts.all})</TabsTrigger>
          <TabsTrigger value="approved">موافق عليها ({counts.approved})</TabsTrigger>
          <TabsTrigger value="signed">موقّعة ({counts.signed})</TabsTrigger>
          <TabsTrigger value="objections">
            اعتراضات ({counts.objections})
          </TabsTrigger>
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
                const st = STATUS_LABELS[c.status] || { label: c.status, color: "bg-muted text-muted-foreground" };
                const productAmount = c.total_amount || 0;
                const feeAmount = productAmount * (c.platform_fee_percentage / 100);
                const accessible = canEnterContract(c);

                return (
                  <Card
                    key={c.id}
                    className={`transition-shadow ${accessible ? "hover:shadow-md" : "opacity-70"}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-bold text-base">
                              صفقة #{deal?.deal_number || "—"}
                            </span>
                            <Badge className={`${st.color} text-xs`}>{st.label}</Badge>
                            {c.revision_count > 0 && (
                              <Badge variant="outline" className="text-xs">مراجعة {c.revision_count}</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {deal?.title || "بدون عنوان"}
                          </p>

                          {/* Client objection notes inline */}
                          {c.status === "client_objection" && c.client_notes && (
                            <div className="mt-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                              <div className="flex items-start gap-2">
                                <MessageSquareWarning className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                                <div>
                                  <p className="text-xs font-bold text-amber-500 mb-1">اعتراض العميل:</p>
                                  <p className="text-sm">{c.client_notes}</p>
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                            <span>👤 {c.client_name || "—"}</span>
                            <span>🏭 {c.factory_name || "—"}</span>
                            <span>🚢 {c.shipping_type}</span>
                            <span>💰 {productAmount.toLocaleString()} {c.currency}</span>
                            <span>📊 عمولة {c.platform_fee_percentage}%</span>
                          </div>
                          {c.signed_at && (
                            <p className="text-xs text-green-500 mt-1">
                              ✅ وُقّع بتاريخ: {new Date(c.signed_at).toLocaleString("ar-SA")}
                            </p>
                          )}
                        </div>

                        {accessible ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 shrink-0"
                            onClick={() => navigate(`/admin/contract-review?deal_id=${c.deal_id}`)}
                          >
                            <Eye className="w-4 h-4" />
                            عرض
                          </Button>
                        ) : (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                            <Lock className="w-4 h-4" />
                            <span>بانتظار العميل</span>
                          </div>
                        )}
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
