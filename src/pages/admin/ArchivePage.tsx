import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

const ArchivePage = () => {
  const [deals, setDeals] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("all");

  useEffect(() => {
    const fetchData = async () => {
      const [dealsRes, profilesRes, stagesRes] = await Promise.all([
        supabase.from("deals").select("*").in("status", ["completed", "cancelled"]).order("updated_at", { ascending: false }),
        supabase.from("profiles").select("user_id, full_name"),
        supabase.from("deal_stages").select("*"),
      ]);
      setDeals(dealsRes.data || []);
      setClients(profilesRes.data || []);
      setStages(stagesRes.data || []);
    };
    fetchData();
  }, []);

  const getClientName = (id: string | null) => clients.find((c) => c.user_id === id)?.full_name || "—";
  const getStageName = (id: string | null) => stages.find((s) => s.id === id)?.name || "—";

  const filtered = deals.filter((d) => {
    const matchSearch = d.title?.toLowerCase().includes(search.toLowerCase());
    const matchClient = clientFilter === "all" || d.client_id === clientFilter;
    return matchSearch && matchClient;
  });

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">الأرشيف</h1>
      <div className="flex gap-4 mb-4">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="بحث..." className="pr-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="تصفية بالعميل" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع العملاء</SelectItem>
            {clients.map((c) => <SelectItem key={c.user_id} value={c.user_id}>{c.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>العنوان</TableHead>
                <TableHead>العميل</TableHead>
                <TableHead>المرحلة</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>تاريخ الإنشاء</TableHead>
                <TableHead>آخر تحديث</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((deal) => (
                <TableRow key={deal.id}>
                  <TableCell className="font-mono">{deal.deal_number}</TableCell>
                  <TableCell className="font-medium">{deal.title}</TableCell>
                  <TableCell>{getClientName(deal.client_id)}</TableCell>
                  <TableCell>{getStageName(deal.stage_id)}</TableCell>
                  <TableCell>
                    <Badge variant={deal.status === "completed" ? "default" : "destructive"}>
                      {deal.status === "completed" ? "مكتملة" : "ملغاة"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{new Date(deal.created_at).toLocaleDateString("ar-SA")}</TableCell>
                  <TableCell className="font-mono text-xs">{new Date(deal.updated_at).toLocaleDateString("ar-SA")}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">لا توجد سجلات في الأرشيف</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ArchivePage;
