import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";
import CharterAgreement from "@/components/client/CharterAgreement";
import DealForm from "@/components/client/DealForm";

const statusMap: Record<string, string> = {
  pending_review: "قيد المراجعة",
  active: "نشطة",
  delayed: "متأخرة",
  paused: "متوقفة",
  completed: "مكتملة",
  cancelled: "ملغاة",
};

const statusVariant = (s: string) => {
  if (s === "pending_review") return "outline";
  if (s === "active") return "default";
  if (s === "delayed") return "destructive";
  return "secondary";
};

const ClientDeals = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [deals, setDeals] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [showCharter, setShowCharter] = useState(false);
  const [charterAccepted, setCharterAccepted] = useState(false);
  const [showForm, setShowForm] = useState(false);

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

      {/* Charter Agreement */}
      {showCharter && !charterAccepted && (
        <CharterAgreement
          onAgree={() => {
            setCharterAccepted(true);
            setShowCharter(false);
            setShowForm(true);
          }}
          onCancel={() => setShowCharter(false)}
        />
      )}

      {/* Deal Form - shown after charter acceptance */}
      {showForm && (
        <DealForm
          onSubmit={() => {
            setShowForm(false);
            setCharterAccepted(false);
            fetchDeals();
          }}
          onCancel={() => {
            setShowForm(false);
            setCharterAccepted(false);
          }}
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
