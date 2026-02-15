import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Search, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface SearchColumn {
  id: string;
  column_name: string;
  column_order: number;
}

interface SearchRow {
  id: string;
  row_order: number;
  row_data: Record<string, string>;
}

const DealSearchResultsPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dealId = searchParams.get("deal_id");

  const [columns, setColumns] = useState<SearchColumn[]>([]);
  const [rows, setRows] = useState<SearchRow[]>([]);
  const [dealInfo, setDealInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  const fetchResults = async () => {
    if (!dealId) return;
    setLoading(true);

    const [dealRes, colsRes, rowsRes] = await Promise.all([
      supabase.from("deals").select("id, deal_number, title, product_type, import_country, current_phase, client_full_name").eq("id", dealId).single(),
      supabase.from("deal_search_columns").select("*").eq("deal_id", dealId).order("column_order"),
      supabase.from("deal_search_rows").select("*").eq("deal_id", dealId).order("row_order"),
    ]);

    setDealInfo(dealRes.data);
    setColumns(colsRes.data || []);
    setRows((rowsRes.data || []) as SearchRow[]);
    setLoading(false);
  };

  useEffect(() => { fetchResults(); }, [dealId]);

  const runSearchAgent = async () => {
    if (!dealId) return;
    setSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("search-products-agent", {
        body: { deal_id: dealId },
      });
      if (error) throw error;
      toast.success(`تم العثور على ${data.factories_count} مصنع/مورد`);
      fetchResults();
    } catch (err: any) {
      toast.error("فشل في البحث: " + (err.message || "خطأ غير معروف"));
    } finally {
      setSearching(false);
    }
  };

  if (!dealId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">لم يتم تحديد صفقة</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/deals")}>
            <ArrowRight className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-heading text-2xl font-bold">
              نتائج البحث - صفقة #{dealInfo?.deal_number || "..."}
            </h1>
            {dealInfo && (
              <p className="text-sm text-muted-foreground mt-1">
                {dealInfo.title} • {dealInfo.product_type} • {dealInfo.import_country} • العميل: {dealInfo.client_full_name || "—"}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {dealInfo?.current_phase && (
            <Badge variant="outline" className="text-xs">
              {dealInfo.current_phase === "results_ready" ? "النتائج جاهزة" : dealInfo.current_phase}
            </Badge>
          )}
          <Button onClick={runSearchAgent} disabled={searching}>
            {searching ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Search className="w-4 h-4 ml-2" />}
            {searching ? "جاري البحث..." : "إعادة البحث"}
          </Button>
          <Button variant="outline" onClick={fetchResults}>
            <RefreshCw className="w-4 h-4 ml-2" />
            تحديث
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <Search className="w-12 h-12 text-muted-foreground" />
            <p className="text-muted-foreground text-lg">لا توجد نتائج بحث لهذه الصفقة بعد</p>
            <Button onClick={runSearchAgent} disabled={searching}>
              {searching ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Search className="w-4 h-4 ml-2" />}
              بدء البحث عن المصانع
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>تم العثور على {rows.length} نتيجة</span>
              <Badge>{rows.length} مصنع/مورد</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    {columns.map(col => (
                      <TableHead key={col.id} className="min-w-[120px] whitespace-nowrap">
                        {col.column_name}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, idx) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">{idx + 1}</TableCell>
                      {columns.map(col => {
                        const val = row.row_data[col.column_name] || "";
                        const isUrl = val.startsWith("http") || val.includes("www.");
                        const isEmail = val.includes("@");
                        return (
                          <TableCell key={col.id} className="text-sm">
                            {isUrl ? (
                              <a href={val.startsWith("http") ? val : `https://${val}`} target="_blank" rel="noopener noreferrer"
                                className="text-primary hover:underline text-xs" dir="ltr">
                                {val.length > 30 ? val.substring(0, 30) + "..." : val}
                              </a>
                            ) : isEmail ? (
                              <a href={`mailto:${val}`} className="text-primary hover:underline text-xs" dir="ltr">
                                {val}
                              </a>
                            ) : (
                              <span className={col.column_name === "التقييم" ? "font-medium" : ""}>
                                {val || "—"}
                              </span>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DealSearchResultsPage;
