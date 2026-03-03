import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus, Ban, MessageSquare, Shield, ShieldCheck, Eye, Trash2, Truck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  is_active: boolean;
  status: string;
  created_at: string;
  email?: string;
  roles?: string[];
  deal_count?: number;
  deal_statuses?: Record<string, number>;
  job_title?: string;
  job_code?: string;
  last_sign_in_at?: string;
}

interface AuthUser {
  id: string;
  email: string;
  last_sign_in_at: string | null;
}

type EmployeeType = "inspector" | "logistics" | "quality";

const INSPECTOR_PERMISSIONS = [
  "receive_briefing",
  "geo_checkin",
  "capture_evidence",
  "visual_validation",
  "submit_report",
];

const LOGISTICS_PERMISSIONS = [
  "view_deals",
  "manage_deals",
];

const PHASE_LABELS: Record<string, string> = {
  verification: "قيد المراجعة",
  product_search: "مقبولة",
  searching_products: "جاري البحث",
  results_ready: "النتائج جاهزة",
};

const UsersPage = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState<UserProfile[]>([]);
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showEmployeeDialog, setShowEmployeeDialog] = useState(false);
  const [employeeType, setEmployeeType] = useState<EmployeeType>("inspector");
  const [newEmployee, setNewEmployee] = useState({ name: "", email: "", password: "", country: "" });
  const [msgDialog, setMsgDialog] = useState<{ open: boolean; userId: string; userName: string }>({ open: false, userId: "", userName: "" });
  const [msgTitle, setMsgTitle] = useState("");
  const [msgBody, setMsgBody] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);

    // Fetch profiles, roles, deals, employee_details, and auth data in parallel
    const [profilesRes, rolesRes, dealsRes, detailsRes, authRes] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("user_roles").select("*"),
      supabase.from("deals").select("id, client_id, current_phase, status"),
      supabase.from("employee_details").select("user_id, job_title, job_code"),
      supabase.functions.invoke("manage-users", { body: { action: "list_users_auth" } }),
    ]);

    const profiles = profilesRes.data || [];
    const roles = rolesRes.data || [];
    const deals = dealsRes.data || [];
    const details = detailsRes.data || [];
    const authUsers: AuthUser[] = authRes.data?.users || [];

    const enriched = profiles.map((p) => {
      const userRoles = roles.filter((r) => r.user_id === p.user_id).map((r) => r.role);
      const userDeals = deals.filter((d) => d.client_id === p.user_id);
      const detail = details.find((d) => d.user_id === p.user_id);
      const authUser = authUsers.find((a) => a.id === p.user_id);

      // Count deals by phase
      const dealStatuses: Record<string, number> = {};
      userDeals.forEach((d) => {
        const phase = d.current_phase || "unknown";
        dealStatuses[phase] = (dealStatuses[phase] || 0) + 1;
      });

      return {
        ...p,
        roles: userRoles,
        deal_count: userDeals.length,
        deal_statuses: dealStatuses,
        job_title: detail?.job_title || "",
        job_code: detail?.job_code || "",
        last_sign_in_at: authUser?.last_sign_in_at || null,
      };
    });

    setClients(enriched.filter((u) => u.roles?.includes("client") && !u.roles?.includes("admin")));
    setEmployees(enriched.filter((u) => u.roles?.includes("employee")));
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const suspendUser = async (userId: string) => {
    await supabase.from("profiles").update({ status: "suspended" }).eq("user_id", userId);
    toast.success("تم إيقاف الحساب");
    fetchUsers();
  };

  const activateUser = async (userId: string) => {
    await supabase.from("profiles").update({ status: "active" }).eq("user_id", userId);
    toast.success("تم تفعيل الحساب");
    fetchUsers();
  };

  const createEmployee = async () => {
    if (!newEmployee.email || !newEmployee.password || !newEmployee.name) {
      toast.error("جميع الحقول مطلوبة");
      return;
    }

    const isInspector = employeeType === "inspector";
    const isQuality = employeeType === "quality";

    const body: Record<string, unknown> = {
      action: "create_employee",
      email: newEmployee.email,
      password: newEmployee.password,
      full_name: newEmployee.name,
      country: newEmployee.country.trim() || "",
      permissions: isInspector || isQuality ? INSPECTOR_PERMISSIONS : LOGISTICS_PERMISSIONS,
      job_title: isInspector ? "المفتش الميداني" : isQuality ? "وكيل الجودة" : "موظف اللوجستيك",
      job_code: isInspector ? "agent_06" : isQuality ? "quality_agent" : "agent_07",
      motto: isInspector
        ? "العين التي لا ترمش.. واليد المقيدة بالحقيقة"
        : isQuality
        ? "درع الحماية الأساسي ضد التلاعب بالمواصفات"
        : "نوثّق كل شحنة.. ونتابع كل رحلة حتى الميناء",
      description: isInspector
        ? "كيان بشري يعمل بعقل رقمي."
        : isQuality
        ? "وكيل فحص الجودة والمطابقة الفنية للمنتجات."
        : "مسؤول توثيق ومتابعة الشحنات اللوجستية.",
    };

    const { error } = await supabase.functions.invoke("manage-users", { body });

    if (error) {
      toast.error("حدث خطأ أثناء إنشاء الموظف");
      return;
    }

    toast.success(isInspector ? "تم إنشاء حساب المفتش الميداني بنجاح" : isQuality ? "تم إنشاء حساب وكيل الجودة بنجاح" : "تم إنشاء حساب موظف اللوجستيك بنجاح");
    setShowEmployeeDialog(false);
    setNewEmployee({ name: "", email: "", password: "", country: "" });
    setEmployeeType("inspector");
    fetchUsers();
  };

  const sendMessage = async () => {
    if (!msgTitle.trim() || !msgBody.trim()) {
      toast.error("العنوان والرسالة مطلوبان");
      return;
    }
    setSendingMsg(true);
    const { error } = await supabase.functions.invoke("manage-users", {
      body: { action: "send_notification", user_id: msgDialog.userId, title: msgTitle.trim(), message: msgBody.trim() },
    });
    setSendingMsg(false);
    if (error) {
      toast.error("فشل إرسال الرسالة");
      return;
    }
    toast.success(`تم إرسال الرسالة إلى ${msgDialog.userName}`);
    setMsgDialog({ open: false, userId: "", userName: "" });
    setMsgTitle("");
    setMsgBody("");
  };
  const deleteEmployee = async (userId: string, userName: string) => {
    if (!confirm(`هل أنت متأكد من حذف الموظف "${userName}"؟ لا يمكن التراجع عن هذا الإجراء.`)) return;
    const { error } = await supabase.functions.invoke("manage-users", {
      body: { action: "delete_employee", user_id: userId },
    });
    if (error) {
      toast.error("فشل حذف الموظف");
      return;
    }
    toast.success("تم حذف الموظف بنجاح");
    fetchUsers();
  };

  const purgeAllUsers = async () => {
    if (!confirm("⚠️ هل أنت متأكد من حذف جميع المستخدمين (موظفين + عملاء)؟\nسيبقى حسابك كمدير فقط.\nلا يمكن التراجع عن هذا الإجراء!")) return;
    toast.loading("جاري حذف جميع الحسابات...");
    const { data, error } = await supabase.functions.invoke("purge-users");
    toast.dismiss();
    if (error) {
      toast.error("فشل حذف الحسابات");
      return;
    }
    toast.success(`تم حذف ${data.deleted} حساب بنجاح`);
    fetchUsers();
  };


  const filteredClients = clients.filter((c) =>
    (c.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.email || "").toLowerCase().includes(search.toLowerCase())
  );
  const filteredEmployees = employees.filter((e) =>
    (e.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (e.email || "").toLowerCase().includes(search.toLowerCase())
  );

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
      active: { label: "مفعل", variant: "default" },
      suspended: { label: "موقوف", variant: "destructive" },
    };
    const s = map[status] || { label: status, variant: "secondary" as const };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  const formatDate = (d: string | null | undefined) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const dealStatusSummary = (statuses: Record<string, number> | undefined, count: number | undefined) => {
    if (!count) return <span className="text-muted-foreground text-xs">لا توجد صفقات</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {Object.entries(statuses || {}).map(([phase, cnt]) => (
          <Badge key={phase} variant="outline" className="text-[10px] px-1.5 py-0.5">
            {PHASE_LABELS[phase] || phase}: {cnt}
          </Badge>
        ))}
      </div>
    );
  };

  const employeeTypeBadge = (jobTitle: string, jobCode: string) => {
    if (jobCode === "agent_06") {
      return (
        <Badge className="bg-primary/10 text-primary border-primary/20 gap-1">
          <Shield className="w-3 h-3" />
          مفتش ميداني
        </Badge>
      );
    }
    if (jobCode === "agent_07" || jobCode === "logistics") {
      return (
        <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20 gap-1">
          <Truck className="w-3 h-3" />
          موظف لوجستيك
        </Badge>
      );
    }
    if (jobCode === "quality_agent") {
      return (
        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1">
          <ShieldCheck className="w-3 h-3" />
          وكيل جودة
        </Badge>
      );
    }
    if (jobTitle) return <Badge variant="secondary">{jobTitle}</Badge>;
    return <Badge variant="outline">موظف</Badge>;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl font-bold">إدارة المستخدمين</h1>
        <div className="flex gap-2">
          <Button variant="destructive" size="sm" onClick={purgeAllUsers}>
            <AlertTriangle className="w-4 h-4 ml-2" />حذف الكل
          </Button>
          <Dialog open={showEmployeeDialog} onOpenChange={setShowEmployeeDialog}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 ml-2" />إضافة موظف</Button>
            </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>إنشاء حساب موظف</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>نوع الموظف</Label>
                <Select value={employeeType} onValueChange={(v) => setEmployeeType(v as EmployeeType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inspector">
                      <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-primary" />مفتش ميداني</div>
                    </SelectItem>
                    <SelectItem value="quality">
                      <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-500" />وكيل جودة</div>
                    </SelectItem>
                    <SelectItem value="logistics">
                      <div className="flex items-center gap-2"><Truck className="w-4 h-4 text-purple-500" />موظف لوجستيك</div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>الاسم الكامل</Label>
                <Input value={newEmployee.name} onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })} />
              </div>
              <div>
                <Label>البريد الإلكتروني</Label>
                <Input type="email" value={newEmployee.email} onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })} />
              </div>
              <div>
                <Label>كلمة المرور المؤقتة</Label>
                <Input type="password" value={newEmployee.password} onChange={(e) => setNewEmployee({ ...newEmployee, password: e.target.value })} />
              </div>
              <div>
                <Label>البلد (دولة تواجد الموظف)</Label>
                <Input placeholder="مثال: مصر، الصين، تركيا..." value={newEmployee.country} onChange={(e) => setNewEmployee({ ...newEmployee, country: e.target.value })} />
                <p className="text-xs text-muted-foreground mt-1">يُستخدم لتعيين الموظف تلقائياً للصفقات في نفس بلده</p>
              </div>
              {employeeType === "inspector" ? (
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="p-4">
                    <p className="text-sm font-semibold mb-2">صلاحيات المفتش الميداني:</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>✓ استلام المواصفات المشفرة</li>
                      <li>✓ القفل الجغرافي</li>
                      <li>✓ التوثيق المقيد بالكاميرا</li>
                      <li>✓ المطابقة البصرية وإطلاق التوكن</li>
                      <li>✓ رفع التقارير للسحابة الآمنة</li>
                    </ul>
                  </CardContent>
                </Card>
              ) : employeeType === "quality" ? (
                <Card className="border-emerald-500/20 bg-emerald-500/5">
                  <CardContent className="p-4">
                    <p className="text-sm font-semibold mb-2">مهام وكيل الجودة:</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>✓ المطابقة الفنية مع العينة المرجعية</li>
                      <li>✓ القفل الجغرافي + الختم الزمني</li>
                      <li>✓ التوثيق البصري المقيد بالكاميرا</li>
                      <li>✓ إصدار شهادة السلامة الفنية</li>
                      <li>✓ كسر خديعة المواصفات ومنع التلاعب</li>
                      <li>✓ رفع التقارير للسحابة الآمنة</li>
                    </ul>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-purple-500/20 bg-purple-500/5">
                  <CardContent className="p-4">
                    <p className="text-sm font-semibold mb-2">مهام موظف اللوجستيك:</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>✓ توثيق تحميل البضاعة</li>
                      <li>✓ متابعة مغادرة المصنع</li>
                      <li>✓ توثيق ميناء التصدير</li>
                      <li>✓ تتبع الشحنة في البحر</li>
                      <li>✓ توثيق الوصول لميناء الوجهة</li>
                      <li>✓ رفع الصور والتقارير لكل مرحلة</li>
                    </ul>
                  </CardContent>
                </Card>
              )}
              <Button onClick={createEmployee} className="w-full">
                {employeeType === "inspector" ? "إنشاء المفتش الميداني" : employeeType === "quality" ? "إنشاء وكيل الجودة" : "إنشاء موظف اللوجستيك"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="بحث بالاسم أو البريد..." className="pr-10" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Tabs defaultValue="clients">
        <TabsList>
          <TabsTrigger value="clients">العملاء ({clients.length})</TabsTrigger>
          <TabsTrigger value="employees">الموظفون ({employees.length})</TabsTrigger>
        </TabsList>

        {/* ===== CLIENTS TAB ===== */}
        <TabsContent value="clients">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الاسم</TableHead>
                    <TableHead>البريد</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>الصفقات</TableHead>
                    <TableHead>حالة الصفقات</TableHead>
                    <TableHead>تاريخ التسجيل</TableHead>
                    <TableHead>إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.map((client) => (
                    <TableRow
                      key={client.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/admin/client-deals?user_id=${client.user_id}`)}
                    >
                      <TableCell className="font-medium">{client.full_name || "بدون اسم"}</TableCell>
                      <TableCell className="text-xs font-mono">{client.email || "—"}</TableCell>
                      <TableCell>{statusBadge(client.status)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{client.deal_count || 0}</Badge>
                      </TableCell>
                      <TableCell>{dealStatusSummary(client.deal_statuses, client.deal_count)}</TableCell>
                      <TableCell className="text-xs">{formatDate(client.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" variant="outline" className="text-primary" onClick={() => navigate(`/admin/client-deals?user_id=${client.user_id}`)}>
                            <Eye className="w-3 h-3 ml-1" />الصفقات
                          </Button>
                          {client.status === "active" ? (
                            <Button size="sm" variant="outline" onClick={() => suspendUser(client.user_id)}>
                              <Ban className="w-3 h-3 ml-1" />إيقاف
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => activateUser(client.user_id)}>
                              تفعيل
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => setMsgDialog({ open: true, userId: client.user_id, userName: client.full_name || client.email || "" })}>
                            <MessageSquare className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredClients.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">لا يوجد عملاء</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== EMPLOYEES TAB ===== */}
        <TabsContent value="employees">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الاسم</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>آخر دخول</TableHead>
                    <TableHead>تاريخ التسجيل</TableHead>
                    <TableHead>إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium">{emp.full_name || "بدون اسم"}</TableCell>
                      <TableCell>{employeeTypeBadge(emp.job_title || "", emp.job_code || "")}</TableCell>
                      <TableCell>{statusBadge(emp.status)}</TableCell>
                      <TableCell className="text-xs">{formatDate(emp.last_sign_in_at)}</TableCell>
                      <TableCell className="text-xs">{formatDate(emp.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {emp.status === "active" ? (
                            <Button size="sm" variant="outline" onClick={() => suspendUser(emp.user_id)}>
                              <Ban className="w-3 h-3 ml-1" />إيقاف
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => activateUser(emp.user_id)}>
                              تفعيل
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => setMsgDialog({ open: true, userId: emp.user_id, userName: emp.full_name || emp.email || "" })}>
                            <MessageSquare className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteEmployee(emp.user_id, emp.full_name || emp.email || "")}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredEmployees.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">لا يوجد موظفين</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ===== SEND MESSAGE DIALOG ===== */}
      <Dialog open={msgDialog.open} onOpenChange={(open) => { if (!open) setMsgDialog({ open: false, userId: "", userName: "" }); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>إرسال رسالة إلى {msgDialog.userName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>عنوان الرسالة</Label>
              <Input value={msgTitle} onChange={(e) => setMsgTitle(e.target.value)} placeholder="مثال: تحديث بخصوص صفقتك" />
            </div>
            <div>
              <Label>نص الرسالة</Label>
              <Textarea value={msgBody} onChange={(e) => setMsgBody(e.target.value)} placeholder="اكتب رسالتك هنا..." rows={4} />
            </div>
            <Button onClick={sendMessage} disabled={sendingMsg} className="w-full">
              {sendingMsg ? "جارٍ الإرسال..." : "إرسال الرسالة"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersPage;
