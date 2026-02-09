import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";

const ACTION_LABELS: Record<string, string> = {
  create: "إنشاء",
  update: "تعديل",
  delete: "حذف",
  suspend: "إيقاف",
  activate: "تفعيل",
};

const LogsPage = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      const [logsRes, profilesRes] = await Promise.all([
        supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("profiles").select("user_id, full_name"),
      ]);
      setLogs(logsRes.data || []);
      setProfiles(profilesRes.data || []);
    };
    fetchData();
  }, []);

  const getUserName = (id: string | null) => profiles.find((p) => p.user_id === id)?.full_name || "النظام";

  const filtered = logs.filter((log) =>
    log.action.toLowerCase().includes(search.toLowerCase()) ||
    log.entity_type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">سجل النشاط</h1>
      <div className="relative mb-4">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="بحث في السجلات..." className="pr-10" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المستخدم</TableHead>
                <TableHead>الإجراء</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>التفاصيل</TableHead>
                <TableHead>التاريخ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium">{getUserName(log.user_id)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{ACTION_LABELS[log.action] || log.action}</Badge>
                  </TableCell>
                  <TableCell>{log.entity_type}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                    {log.details ? JSON.stringify(log.details) : "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {new Date(log.created_at).toLocaleString("ar-SA")}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">لا توجد سجلات</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default LogsPage;
