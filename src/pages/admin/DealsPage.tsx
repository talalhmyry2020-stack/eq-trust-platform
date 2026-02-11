import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, Pause, Play, Trash2, Clock, Eye, CheckCircle, XCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import DealDetailDialog from "@/components/admin/DealDetailDialog";

interface Deal {
  id: string;
  deal_number: number;
  title: string;
  deal_type: string;
  status: string;
  created_at: string;
  client_id: string | null;
  employee_id: string | null;
  stage_id: string | null;
  description: string | null;
  client_full_name: string | null;
  country: string | null;
  city: string | null;
  national_id: string | null;
  commercial_register_number: string | null;
  entity_type: string | null;
  identity_doc_url: string | null;
  commercial_register_doc_url: string | null;
  product_type: string | null;
  product_description: string | null;
  product_image_url: string | null;
  import_country: string | null;
  current_phase: string | null;
}

interface Stage {
  id: string;
  name: string;
  display_order: number;
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending_review: { label: "قيد المراجعة", variant: "outline" },
  active: { label: "نشطة", variant: "default" },
  delayed: { label: "متأخرة", variant: "secondary" },
  paused: { label: "متوقفة", variant: "outline" },
  completed: { label: "مكتملة", variant: "default" },
  cancelled: { label: "ملغاة", variant: "destructive" },
};

const DealsPage = () => {
  const { user } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [clients, setClients] = useState<{ user_id: string; full_name: string }[]>([]);
  const [employees, setEmployees] = useState<{ user_id: string; full_name: string }[]>([]);
  const [allProfiles, setAllProfiles] = useState<{ user_id: string; full_name: string; email?: string }[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [newDeal, setNewDeal] = useState({ title: "", deal_type: "", client_id: "", employee_id: "", stage_id: "", description: "" });

  const fetchData = async () => {
    const [dealsRes, stagesRes, profilesRes, rolesRes] = await Promise.all([
      supabase.from("deals").select("*").order("created_at", { ascending: false }),
      supabase.from("deal_stages").select("*").order("display_order"),
      supabase.from("profiles").select("user_id, full_name, email"),
      supabase.from("user_roles").select("user_id, role"),
    ]);

    setDeals(dealsRes.data as Deal[] || []);
    setStages(stagesRes.data || []);

    const roles = rolesRes.data || [];
    const profiles = profilesRes.data || [];
    setAllProfiles(profiles);
    setClients(profiles.filter((p) => roles.some((r) => r.user_id === p.user_id && r.role === "client")));
    setEmployees(profiles.filter((p) => roles.some((r) => r.user_id === p.user_id && r.role === "employee")));
  };

  useEffect(() => { fetchData(); }, []);

  const createDeal = async () => {
    if (!newDeal.title) { toast.error("عنوان الصفقة مطلوب"); return; }
    const { error } = await supabase.from("deals").insert({
      title: newDeal.title,
      deal_type: newDeal.deal_type,
      client_id: newDeal.client_id || null,
      employee_id: newDeal.employee_id || null,
      stage_id: newDeal.stage_id || null,
      description: newDeal.description,
      created_by: user?.id,
      status: "active" as const,
    });
    if (error) { toast.error("خطأ في إنشاء الصفقة"); return; }
    toast.success("تم إنشاء الصفقة");
    setShowCreateDialog(false);
    setNewDeal({ title: "", deal_type: "", client_id: "", employee_id: "", stage_id: "", description: "" });
    fetchData();
  };

  const updateStatus = async (id: string, status: "active" | "delayed" | "paused" | "completed" | "cancelled" | "pending_review") => {
    await supabase.from("deals").update({ status }).eq("id", id);
    toast.success("تم تحديث الحالة");
    fetchData();

    // عند قبول الصفقة، إرسال بيانات المنتج تلقائياً لـ n8n للبحث
    if (status === "active") {
      triggerProductSearch(id);
    }
  };

  const triggerProductSearch = async (dealId: string) => {
    toast.info("جاري إرسال طلب البحث عن المنتجات...");
    const { error } = await supabase.functions.invoke("search-products", {
      body: { deal_id: dealId },
    });
    if (error) {
      toast.error("فشل إرسال طلب البحث");
    } else {
      toast.success("تم إرسال طلب البحث بنجاح");
      fetchData();
    }
  };

  const deleteDeal = async (id: string) => {
    await supabase.from("deals").delete().eq("id", id);
    toast.success("تم حذف الصفقة");
    fetchData();
  };

  const getStageName = (stageId: string | null) =>
    stages.find((s) => s.id === stageId)?.name || "—";

  const getClientName = (clientId: string | null) =>
    clients.find((c) => c.user_id === clientId)?.full_name || "—";

  const getAccountOwnerEmail = (clientId: string | null) => {
    if (!clientId) return "—";
    return allProfiles.find((p) => p.user_id === clientId)?.email || "—";
  };

  const filtered = deals.filter((d) => {
    const matchSearch = d.title.toLowerCase().includes(search.toLowerCase()) ||
      (d.client_full_name || "").toLowerCase().includes(search.toLowerCase()) ||
      String(d.deal_number).includes(search);
    const matchStatus = statusFilter === "all" || d.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const pendingDeals = filtered.filter(d => d.status === "pending_review");
  const acceptedDeals = filtered.filter(d => d.status === "active" || d.status === "completed" || d.status === "delayed" || d.status === "paused");
  const rejectedDeals = filtered.filter(d => d.status === "cancelled");

  const renderDealsTable = (dealsList: Deal[]) => (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>العنوان</TableHead>
              <TableHead>العميل</TableHead>
              <TableHead>صاحب الحساب</TableHead>
              <TableHead>النوع</TableHead>
              <TableHead>المرحلة</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead>إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dealsList.map((deal) => {
              const st = STATUS_MAP[deal.status] || { label: deal.status, variant: "secondary" as const };
              return (
                <TableRow key={deal.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedDeal(deal)}>
                  <TableCell className="font-mono">{deal.deal_number}</TableCell>
                  <TableCell className="font-medium">{deal.title}</TableCell>
                  <TableCell>{deal.client_full_name || getClientName(deal.client_id)}</TableCell>
                  <TableCell className="text-muted-foreground text-xs" dir="ltr">{getAccountOwnerEmail(deal.client_id)}</TableCell>
                  <TableCell>{deal.deal_type || "—"}</TableCell>
                  <TableCell>{getStageName(deal.stage_id)}</TableCell>
                  <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{new Date(deal.created_at).toLocaleDateString("ar-SA")}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setSelectedDeal(deal)} title="عرض التفاصيل">
                        <Eye className="w-4 h-4" />
                      </Button>
                      {deal.status === "pending_review" && (
                        <>
                          <Button size="icon" variant="ghost" className="text-green-600" onClick={() => updateStatus(deal.id, "active")} title="موافقة">
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => updateStatus(deal.id, "cancelled")} title="رفض">
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      {deal.status === "active" && (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => updateStatus(deal.id, "paused")} title="إيقاف">
                            <Pause className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => updateStatus(deal.id, "delayed")} title="تأخير">
                            <Clock className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-primary" onClick={() => triggerProductSearch(deal.id)} title="بحث عن منتجات">
                            <Send className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      {(deal.status === "paused" || deal.status === "delayed") && (
                        <Button size="icon" variant="ghost" onClick={() => updateStatus(deal.id, "active")} title="تفعيل">
                          <Play className="w-4 h-4" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteDeal(deal.id)} title="حذف">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {dealsList.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">لا توجد صفقات</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl font-bold">إدارة الصفقات</h1>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 ml-2" />صفقة جديدة</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>إنشاء صفقة جديدة</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>عنوان الصفقة</Label><Input value={newDeal.title} onChange={(e) => setNewDeal({ ...newDeal, title: e.target.value })} /></div>
              <div><Label>نوع الصفقة</Label><Input value={newDeal.deal_type} onChange={(e) => setNewDeal({ ...newDeal, deal_type: e.target.value })} /></div>
              <div>
                <Label>العميل</Label>
                <Select value={newDeal.client_id} onValueChange={(v) => setNewDeal({ ...newDeal, client_id: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر عميل" /></SelectTrigger>
                  <SelectContent>{clients.map((c) => <SelectItem key={c.user_id} value={c.user_id}>{c.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>الموظف المسؤول</Label>
                <Select value={newDeal.employee_id} onValueChange={(v) => setNewDeal({ ...newDeal, employee_id: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر موظف" /></SelectTrigger>
                  <SelectContent>{employees.map((e) => <SelectItem key={e.user_id} value={e.user_id}>{e.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>المرحلة</Label>
                <Select value={newDeal.stage_id} onValueChange={(v) => setNewDeal({ ...newDeal, stage_id: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر مرحلة" /></SelectTrigger>
                  <SelectContent>{stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>الوصف</Label><Textarea value={newDeal.description} onChange={(e) => setNewDeal({ ...newDeal, description: e.target.value })} /></div>
              <Button onClick={createDeal} className="w-full">إنشاء الصفقة</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4 mb-4">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="بحث بالاسم أو الرقم..." className="pr-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الحالات</SelectItem>
            <SelectItem value="pending_review">قيد المراجعة</SelectItem>
            <SelectItem value="active">نشطة</SelectItem>
            <SelectItem value="delayed">متأخرة</SelectItem>
            <SelectItem value="paused">متوقفة</SelectItem>
            <SelectItem value="completed">مكتملة</SelectItem>
            <SelectItem value="cancelled">ملغاة</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="all">جميع الصفقات ({filtered.length})</TabsTrigger>
          <TabsTrigger value="pending">قيد المراجعة ({pendingDeals.length})</TabsTrigger>
          <TabsTrigger value="accepted">مقبولة ({acceptedDeals.length})</TabsTrigger>
          <TabsTrigger value="rejected">مرفوضة ({rejectedDeals.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="all">{renderDealsTable(filtered)}</TabsContent>
        <TabsContent value="pending">{renderDealsTable(pendingDeals)}</TabsContent>
        <TabsContent value="accepted">{renderDealsTable(acceptedDeals)}</TabsContent>
        <TabsContent value="rejected">{renderDealsTable(rejectedDeals)}</TabsContent>
      </Tabs>

      <DealDetailDialog
        deal={selectedDeal}
        open={!!selectedDeal}
        onClose={() => setSelectedDeal(null)}
        clientName={selectedDeal ? getClientName(selectedDeal.client_id) : ""}
        accountOwnerName={selectedDeal ? getAccountOwnerEmail(selectedDeal.client_id) : ""}
      />
    </div>
  );
};

export default DealsPage;
