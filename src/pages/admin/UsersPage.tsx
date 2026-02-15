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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus, Ban, MessageSquare, Shield, Eye } from "lucide-react";
import { toast } from "sonner";

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  is_active: boolean;
  status: string;
  created_at: string;
  email?: string;
  roles?: string[];
  // Client deal info
  deal_count?: number;
  deal_statuses?: Record<string, number>;
  // Employee info
  job_title?: string;
  job_code?: string;
  last_sign_in_at?: string;
}

interface AuthUser {
  id: string;
  email: string;
  last_sign_in_at: string | null;
}

const PERMISSIONS = [
  { value: "view_deals", label: "مشاهدة الصفقات" },
  { value: "manage_deals", label: "إدارة الصفقات" },
  { value: "contact_clients", label: "التواصل مع العملاء" },
  { value: "view_clients", label: "مشاهدة العملاء" },
  { value: "manage_clients", label: "إدارة العملاء" },
];

const INSPECTOR_PERMISSIONS = [
  "receive_briefing",
  "geo_checkin",
  "capture_evidence",
  "visual_validation",
  "submit_report",
];

type EmployeeType = "general" | "inspector";

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
  const [employeeType, setEmployeeType] = useState<EmployeeType>("general");
  const [newEmployee, setNewEmployee] = useState({ name: "", email: "", password: "", permissions: [] as string[] });
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
    const permissions = isInspector ? INSPECTOR_PERMISSIONS : newEmployee.permissions;

    const body: Record<string, unknown> = {
      action: "create_employee",
      email: newEmployee.email,
      password: newEmployee.password,
      full_name: newEmployee.name,
      permissions,
    };

    if (isInspector) {
      body.job_title = "المفتش الميداني";
      body.job_code = "agent_06";
      body.motto = "العين التي لا ترمش.. واليد المقيدة بالحقيقة";
      body.description = "كيان بشري يعمل بعقل رقمي.";
    }

    const { error } = await supabase.functions.invoke("manage-users", { body });

    if (error) {
      toast.error("حدث خطأ أثناء إنشاء الموظف");
      return;
    }

    toast.success(isInspector ? "تم إنشاء حساب المفتش الميداني بنجاح" : "تم إنشاء حساب الموظف بنجاح");
    setShowEmployeeDialog(false);
    setNewEmployee({ name: "", email: "", password: "", permissions: [] });
    setEmployeeType("general");
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

  const togglePermission = (perm: string) => {
    setNewEmployee((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter((p) => p !== perm)
        : [...prev.permissions, perm],
    }));
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
    if (jobTitle) return <Badge variant="secondary">{jobTitle}</Badge>;
    return <Badge variant="outline">موظف عام</Badge>;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl font-bold">إدارة المستخدمين</h1>
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
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">موظف عام</SelectItem>
                    <SelectItem value="inspector">مفتش ميداني — الوكيل 06</SelectItem>
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
              {employeeType === "general" && (
                <div>
                  <Label>الصلاحيات</Label>
                  <div className="space-y-2 mt-2">
                    {PERMISSIONS.map((p) => (
                      <div key={p.value} className="flex items-center gap-2">
                        <Checkbox checked={newEmployee.permissions.includes(p.value)} onCheckedChange={() => togglePermission(p.value)} />
                        <span className="text-sm">{p.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {employeeType === "inspector" && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="p-4">
                    <p className="text-sm font-semibold mb-2">صلاحيات المفتش الميداني (تلقائية):</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>✓ استلام المواصفات المشفرة</li>
                      <li>✓ القفل الجغرافي</li>
                      <li>✓ التوثيق المقيد بالكاميرا</li>
                      <li>✓ المطابقة البصرية وإطلاق التوكن</li>
                      <li>✓ رفع التقارير للسحابة الآمنة</li>
                    </ul>
                  </CardContent>
                </Card>
              )}
              <Button onClick={createEmployee} className="w-full">
                {employeeType === "inspector" ? "إنشاء المفتش الميداني" : "إنشاء الموظف"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
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
