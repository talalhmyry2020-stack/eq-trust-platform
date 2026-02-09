import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Shield } from "lucide-react";

const SensitivePage = () => {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      setProfiles(data || []);
    };
    fetchData();
  }, []);

  const filtered = profiles.filter((p) =>
    p.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-6 h-6 text-destructive" />
        <h1 className="font-heading text-2xl font-bold">البيانات الحساسة</h1>
      </div>

      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-6">
        <p className="text-sm text-destructive">⚠️ هذه الصفحة تحتوي على بيانات حساسة. الوصول مقتصر على المدير فقط.</p>
      </div>

      <div className="relative mb-4">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="بحث..." className="pr-10" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">بيانات الحسابات</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>معرف المستخدم</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>نشط</TableHead>
                <TableHead>تاريخ التسجيل</TableHead>
                <TableHead>آخر تحديث</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.full_name || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{p.user_id.substring(0, 8)}...</TableCell>
                  <TableCell>
                    <Badge variant={p.status === "active" ? "default" : "destructive"}>
                      {p.status === "active" ? "مفعل" : p.status === "suspended" ? "موقوف" : p.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.is_active ? "default" : "secondary"}>
                      {p.is_active ? "نعم" : "لا"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{new Date(p.created_at).toLocaleString("ar-SA")}</TableCell>
                  <TableCell className="font-mono text-xs">{new Date(p.updated_at).toLocaleString("ar-SA")}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">لا توجد بيانات</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default SensitivePage;
