import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const statusMap: Record<string, string> = {
  active: "نشطة",
  delayed: "متأخرة",
  paused: "متوقفة",
  completed: "مكتملة",
  cancelled: "ملغاة",
};

const statusVariant = (s: string) => {
  if (s === "active") return "default";
  if (s === "delayed") return "destructive";
  return "secondary";
};

const ClientDeals = () => {
  const { user } = useAuth();
  const [deals, setDeals] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const [d, s] = await Promise.all([
        supabase.from("deals").select("*").eq("client_id", user.id).not("status", "in", '("completed","cancelled")').order("updated_at", { ascending: false }),
        supabase.from("deal_stages").select("*"),
      ]);
      setDeals(d.data || []);
      setStages(s.data || []);
    };
    fetch();
  }, [user]);

  const getStageName = (id: string | null) => stages.find((s) => s.id === id)?.name || "—";

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">صفقاتي</h1>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>العنوان</TableHead>
                <TableHead>المرحلة</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>آخر تحديث</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deals.map((deal) => (
                <TableRow key={deal.id}>
                  <TableCell className="font-mono">{deal.deal_number}</TableCell>
                  <TableCell className="font-medium">{deal.title}</TableCell>
                  <TableCell>{getStageName(deal.stage_id)}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(deal.status)}>{statusMap[deal.status] || deal.status}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{new Date(deal.updated_at).toLocaleDateString("ar-SA")}</TableCell>
                </TableRow>
              ))}
              {deals.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">لا توجد صفقات نشطة</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientDeals;
