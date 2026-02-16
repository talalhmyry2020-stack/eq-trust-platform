import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Eye, Download, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const STATUS_LABELS: Record<string, string> = {
  drafting: "جاري الصياغة",
  client_review: "بانتظار مراجعتك",
  client_objection: "ملاحظاتك قيد المراجعة",
  admin_review: "مراجعة المدير",
  revision: "جاري التعديل",
  client_signing: "جاهز للتوقيع",
  admin_approval: "بانتظار اعتماد المدير",
  factory_approval: "بانتظار موافقة المورّد",
  signed: "تم التوقيع ✅",
};

const statusVariant = (s: string) => {
  if (s === "signed") return "default" as const;
  if (s === "client_review" || s === "client_signing") return "destructive" as const;
  return "outline" as const;
};

interface ContractRow {
  id: string;
  deal_id: string;
  status: string;
  client_signed: boolean;
  signed_at: string | null;
  created_at: string;
  updated_at: string;
  total_amount: number | null;
  currency: string;
  client_name: string | null;
  contract_html: string;
  deal_number?: number;
}

const ClientContractsListPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      setLoading(true);
      // Get client's deals first
      const { data: deals } = await supabase
        .from("deals")
        .select("id, deal_number")
        .eq("client_id", user.id);

      if (!deals || deals.length === 0) {
        setContracts([]);
        setLoading(false);
        return;
      }

      const dealIds = deals.map((d) => d.id);
      const dealMap = Object.fromEntries(deals.map((d) => [d.id, d.deal_number]));

      const { data: contractData } = await supabase
        .from("deal_contracts")
        .select("*")
        .in("deal_id", dealIds)
        .order("created_at", { ascending: false });

      const enriched = (contractData || []).map((c) => ({
        ...c,
        deal_number: dealMap[c.deal_id],
      })) as ContractRow[];

      setContracts(enriched);
      setLoading(false);
    };
    fetch();
  }, [user]);

  const handleExportPDF = (contract: ContractRow) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>عقد الصفقة #${contract.deal_number}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Cairo', sans-serif; color: #000; padding: 40px; line-height: 1.8; font-size: 14px; background: #fff; }
          h1, h2, h3 { color: #000; margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin: 16px 0; }
          th, td { border: 1px solid #333; padding: 8px 12px; text-align: right; }
          th { background: #f0f0f0; font-weight: 700; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>${contract.contract_html}</body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
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
    <div>
      <div className="flex items-center gap-3 mb-6">
        <FileText className="w-6 h-6 text-primary" />
        <h1 className="font-heading text-2xl font-bold">العقود</h1>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم الصفقة</TableHead>
                <TableHead>العميل</TableHead>
                <TableHead>المبلغ</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>تاريخ التوقيع</TableHead>
                <TableHead>إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono">#{c.deal_number}</TableCell>
                  <TableCell>{c.client_name || "—"}</TableCell>
                  <TableCell className="font-mono">
                    {c.total_amount ? `${c.total_amount.toLocaleString()} ${c.currency}` : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(c.status)}>
                      {STATUS_LABELS[c.status] || c.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {c.signed_at ? new Date(c.signed_at).toLocaleDateString("ar-SA") : "—"}
                  </TableCell>
                  <TableCell className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/client/contract?deal_id=${c.deal_id}`)}
                      className="gap-1"
                    >
                      <Eye className="w-4 h-4" /> عرض
                    </Button>
                    {c.client_signed && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleExportPDF(c)}
                        className="gap-1"
                      >
                        <Download className="w-4 h-4" /> PDF
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {contracts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    لا توجد عقود حالياً
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientContractsListPage;
