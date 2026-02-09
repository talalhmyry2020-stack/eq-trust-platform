import { useEffect, useState } from "react";
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
import { Search, Plus, Ban, Trash2, Edit } from "lucide-react";
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
}

const PERMISSIONS = [
  { value: "view_deals", label: "مشاهدة الصفقات" },
  { value: "manage_deals", label: "إدارة الصفقات" },
  { value: "contact_clients", label: "التواصل مع العملاء" },
  { value: "view_clients", label: "مشاهدة العملاء" },
  { value: "manage_clients", label: "إدارة العملاء" },
];

const UsersPage = () => {
  const [clients, setClients] = useState<UserProfile[]>([]);
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showEmployeeDialog, setShowEmployeeDialog] = useState(false);
  const [newEmployee, setNewEmployee] = useState({ name: "", email: "", password: "", permissions: [] as string[] });

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from("profiles").select("*");
    const { data: roles } = await supabase.from("user_roles").select("*");

    if (profiles && roles) {
      const enriched = profiles.map((p) => ({
        ...p,
        roles: roles.filter((r) => r.user_id === p.user_id).map((r) => r.role),
      }));
      setClients(enriched.filter((u) => u.roles?.includes("client") && !u.roles?.includes("admin")));
      setEmployees(enriched.filter((u) => u.roles?.includes("employee")));
    }
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

    const { data, error } = await supabase.functions.invoke("manage-users", {
      body: {
        action: "create_employee",
        email: newEmployee.email,
        password: newEmployee.password,
        full_name: newEmployee.name,
        permissions: newEmployee.permissions,
      },
    });

    if (error) {
      toast.error("حدث خطأ أثناء إنشاء الموظف");
      return;
    }

    toast.success("تم إنشاء حساب الموظف بنجاح");
    setShowEmployeeDialog(false);
    setNewEmployee({ name: "", email: "", password: "", permissions: [] });
    fetchUsers();
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
    c.full_name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredEmployees = employees.filter((e) =>
    e.full_name.toLowerCase().includes(search.toLowerCase())
  );

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
      active: { label: "مفعل", variant: "default" },
      suspended: { label: "موقوف", variant: "destructive" },
    };
    const s = map[status] || { label: status, variant: "secondary" as const };
    return <Badge variant={s.variant}>{s.label}</Badge>;
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
                <Label>الصلاحيات</Label>
                <div className="space-y-2 mt-2">
                  {PERMISSIONS.map((p) => (
                    <div key={p.value} className="flex items-center gap-2">
                      <Checkbox
                        checked={newEmployee.permissions.includes(p.value)}
                        onCheckedChange={() => togglePermission(p.value)}
                      />
                      <span className="text-sm">{p.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <Button onClick={createEmployee} className="w-full">إنشاء الموظف</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative mb-4">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="بحث بالاسم..."
          className="pr-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Tabs defaultValue="clients">
        <TabsList>
          <TabsTrigger value="clients">العملاء ({clients.length})</TabsTrigger>
          <TabsTrigger value="employees">الموظفون ({employees.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="clients">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الاسم</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>تاريخ التسجيل</TableHead>
                    <TableHead>إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.full_name || "بدون اسم"}</TableCell>
                      <TableCell>{statusBadge(client.status)}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {new Date(client.created_at).toLocaleDateString("ar-SA")}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {client.status === "active" ? (
                            <Button size="sm" variant="outline" onClick={() => suspendUser(client.user_id)}>
                              <Ban className="w-3 h-3 ml-1" />إيقاف
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => activateUser(client.user_id)}>
                              تفعيل
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredClients.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        لا يوجد عملاء
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="employees">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الاسم</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>تاريخ التسجيل</TableHead>
                    <TableHead>إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium">{emp.full_name || "بدون اسم"}</TableCell>
                      <TableCell>{statusBadge(emp.status)}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {new Date(emp.created_at).toLocaleDateString("ar-SA")}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {emp.status === "active" ? (
                            <Button size="sm" variant="outline" onClick={() => suspendUser(emp.user_id)}>
                              <Ban className="w-3 h-3 ml-1" />إيقاف
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => activateUser(emp.user_id)}>
                              تفعيل
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredEmployees.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        لا يوجد موظفين
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UsersPage;
