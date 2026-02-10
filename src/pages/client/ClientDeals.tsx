import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";

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
  const { toast } = useToast();
  const [deals, setDeals] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [dealType, setDealType] = useState("");
  const [description, setDescription] = useState("");
  const [stageId, setStageId] = useState("");

  const fetchDeals = async () => {
    if (!user) return;
    const [d, s] = await Promise.all([
      supabase.from("deals").select("*").eq("client_id", user.id).not("status", "in", '("completed","cancelled")').order("updated_at", { ascending: false }),
      supabase.from("deal_stages").select("*").order("display_order"),
    ]);
    setDeals(d.data || []);
    setStages(s.data || []);
  };

  useEffect(() => { fetchDeals(); }, [user]);

  const getStageName = (id: string | null) => stages.find((s) => s.id === id)?.name || "—";

  const handleCreate = async () => {
    if (!user || !title.trim() || !dealType.trim()) return;
    setCreating(true);
    const { error } = await supabase.from("deals").insert({
      title: title.trim(),
      deal_type: dealType.trim(),
      description: description.trim(),
      client_id: user.id,
      created_by: user.id,
      stage_id: stageId || null,
    });
    setCreating(false);
    if (error) {
      toast({ title: "خطأ", description: "فشل إنشاء الصفقة", variant: "destructive" });
    } else {
      toast({ title: "تم الإنشاء", description: "تم إنشاء الصفقة بنجاح" });
      setTitle("");
      setDealType("");
      setDescription("");
      setStageId("");
      setOpen(false);
      fetchDeals();
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl font-bold">صفقاتي</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 ml-2" /> إنشاء صفقة</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-heading">صفقة جديدة</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان الصفقة" />
              <Input value={dealType} onChange={(e) => setDealType(e.target.value)} placeholder="نوع الصفقة (مثال: بيع، شراء، وساطة)" />
              {stages.length > 0 && (
                <Select value={stageId} onValueChange={setStageId}>
                  <SelectTrigger><SelectValue placeholder="اختر المرحلة (اختياري)" /></SelectTrigger>
                  <SelectContent>
                    {stages.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="وصف الصفقة (اختياري)" rows={3} />
              <Button onClick={handleCreate} disabled={creating || !title.trim() || !dealType.trim()} className="w-full">
                {creating ? "جاري الإنشاء..." : "إنشاء الصفقة"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

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
