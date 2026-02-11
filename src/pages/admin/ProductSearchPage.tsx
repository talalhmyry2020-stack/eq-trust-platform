import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, GripVertical, Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";

interface Column {
  id: string;
  deal_id: string;
  column_name: string;
  column_order: number;
}

interface Row {
  id: string;
  deal_id: string;
  row_data: Record<string, string>;
  row_order: number;
}

interface Deal {
  id: string;
  deal_number: number;
  title: string;
  client_full_name: string | null;
}

const ProductSearchPage = () => {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [selectedDealId, setSelectedDealId] = useState<string>("");
  const [columns, setColumns] = useState<Column[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [showAddColDialog, setShowAddColDialog] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [editingCell, setEditingCell] = useState<{ rowId: string; colId: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [editColName, setEditColName] = useState("");

  const fetchDeals = useCallback(async () => {
    const { data } = await supabase
      .from("deals")
      .select("id, deal_number, title, client_full_name")
      .order("deal_number", { ascending: false });
    setDeals(data || []);
    if (data && data.length > 0 && !selectedDealId) {
      setSelectedDealId(data[0].id);
    }
  }, [selectedDealId]);

  const fetchColumns = useCallback(async () => {
    if (!selectedDealId) return;
    const { data } = await supabase
      .from("deal_search_columns")
      .select("*")
      .eq("deal_id", selectedDealId)
      .order("column_order", { ascending: true });
    setColumns((data as Column[]) || []);
  }, [selectedDealId]);

  const fetchRows = useCallback(async () => {
    if (!selectedDealId) return;
    const { data } = await supabase
      .from("deal_search_rows")
      .select("*")
      .eq("deal_id", selectedDealId)
      .order("row_order", { ascending: true });
    setRows((data as Row[]) || []);
  }, [selectedDealId]);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);
  useEffect(() => { fetchColumns(); fetchRows(); }, [fetchColumns, fetchRows]);

  // --- Column CRUD ---
  const addColumn = async () => {
    if (!newColName.trim()) { toast.error("اسم العمود مطلوب"); return; }
    const maxOrder = columns.length > 0 ? Math.max(...columns.map(c => c.column_order)) + 1 : 0;
    const { error } = await supabase.from("deal_search_columns").insert({
      deal_id: selectedDealId,
      column_name: newColName.trim(),
      column_order: maxOrder,
    });
    if (error) { toast.error("خطأ في إضافة العمود"); return; }
    toast.success("تم إضافة العمود");
    setNewColName("");
    setShowAddColDialog(false);
    fetchColumns();
  };

  const deleteColumn = async (colId: string, colName: string) => {
    const { error } = await supabase.from("deal_search_columns").delete().eq("id", colId);
    if (error) { toast.error("خطأ في حذف العمود"); return; }
    // Remove column data from all rows
    const updatedRows = rows.map(r => {
      const newData = { ...r.row_data };
      delete newData[colName];
      return { id: r.id, row_data: newData };
    });
    for (const r of updatedRows) {
      await supabase.from("deal_search_rows").update({ row_data: r.row_data }).eq("id", r.id);
    }
    toast.success("تم حذف العمود");
    fetchColumns();
    fetchRows();
  };

  const saveColumnRename = async (colId: string, oldName: string) => {
    if (!editColName.trim()) { setEditingColId(null); return; }
    const { error } = await supabase.from("deal_search_columns").update({ column_name: editColName.trim() }).eq("id", colId);
    if (error) { toast.error("خطأ في تعديل العمود"); return; }
    // Rename key in all rows
    if (editColName.trim() !== oldName) {
      for (const r of rows) {
        const newData = { ...r.row_data };
        if (oldName in newData) {
          newData[editColName.trim()] = newData[oldName];
          delete newData[oldName];
        }
        await supabase.from("deal_search_rows").update({ row_data: newData }).eq("id", r.id);
      }
    }
    setEditingColId(null);
    fetchColumns();
    fetchRows();
  };

  // --- Row CRUD ---
  const addRow = async () => {
    const maxOrder = rows.length > 0 ? Math.max(...rows.map(r => r.row_order)) + 1 : 0;
    const emptyData: Record<string, string> = {};
    columns.forEach(c => { emptyData[c.column_name] = ""; });
    const { error } = await supabase.from("deal_search_rows").insert({
      deal_id: selectedDealId,
      row_data: emptyData,
      row_order: maxOrder,
    });
    if (error) { toast.error("خطأ في إضافة الصف"); return; }
    fetchRows();
  };

  const deleteRow = async (rowId: string) => {
    const { error } = await supabase.from("deal_search_rows").delete().eq("id", rowId);
    if (error) { toast.error("خطأ في حذف الصف"); return; }
    fetchRows();
  };

  const startEditCell = (rowId: string, colName: string, value: string) => {
    setEditingCell({ rowId, colId: colName });
    setEditValue(value || "");
  };

  const saveCellEdit = async (rowId: string, colName: string) => {
    const row = rows.find(r => r.id === rowId);
    if (!row) return;
    const newData = { ...row.row_data, [colName]: editValue };
    const { error } = await supabase.from("deal_search_rows").update({ row_data: newData }).eq("id", rowId);
    if (error) { toast.error("خطأ في الحفظ"); return; }
    setEditingCell(null);
    fetchRows();
  };

  const selectedDeal = deals.find(d => d.id === selectedDealId);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl font-bold">نتائج البحث</h1>
      </div>

      {/* Deal selector */}
      <div className="flex gap-4 mb-6 items-end">
        <div className="flex-1">
          <Label className="mb-2 block">اختر الصفقة</Label>
          <Select value={selectedDealId} onValueChange={setSelectedDealId}>
            <SelectTrigger>
              <SelectValue placeholder="اختر صفقة..." />
            </SelectTrigger>
            <SelectContent>
              {deals.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  #{d.deal_number} — {d.title} {d.client_full_name ? `(${d.client_full_name})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Deal info */}
      {selectedDeal && (
        <Card className="mb-4">
          <CardHeader className="py-3">
            <CardTitle className="text-base">
              صفقة #{selectedDeal.deal_number} — {selectedDeal.title}
              {selectedDeal.client_full_name && <span className="text-muted-foreground mr-2">({selectedDeal.client_full_name})</span>}
            </CardTitle>
          </CardHeader>
        </Card>
      )}

      {/* Toolbar */}
      {selectedDealId && (
        <div className="flex gap-2 mb-4">
          <Button variant="outline" size="sm" onClick={() => setShowAddColDialog(true)}>
            <Plus className="w-4 h-4 ml-1" />
            عمود جديد
          </Button>
          <Button variant="outline" size="sm" onClick={addRow} disabled={columns.length === 0}>
            <Plus className="w-4 h-4 ml-1" />
            صف جديد
          </Button>
        </div>
      )}

      {/* Spreadsheet */}
      {selectedDealId && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              {columns.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  لا توجد أعمدة بعد. أضف عموداً للبدء.
                </div>
              ) : (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-2 text-center w-12 font-medium text-muted-foreground">#</th>
                      {columns.map((col) => (
                        <th key={col.id} className="p-2 text-right font-medium text-muted-foreground min-w-[150px] group">
                          {editingColId === col.id ? (
                            <div className="flex items-center gap-1">
                              <Input
                                value={editColName}
                                onChange={e => setEditColName(e.target.value)}
                                className="h-7 text-xs"
                                autoFocus
                                onKeyDown={e => {
                                  if (e.key === "Enter") saveColumnRename(col.id, col.column_name);
                                  if (e.key === "Escape") setEditingColId(null);
                                }}
                              />
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => saveColumnRename(col.id, col.column_name)}>
                                <Save className="w-3 h-3" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingColId(null)}>
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <span>{col.column_name}</span>
                              <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 transition-opacity">
                                <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => { setEditingColId(col.id); setEditColName(col.column_name); }}>
                                  <Pencil className="w-3 h-3" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-5 w-5 text-destructive" onClick={() => deleteColumn(col.id, col.column_name)}>
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </th>
                      ))}
                      <th className="p-2 w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr key={row.id} className="border-b hover:bg-muted/30">
                        <td className="p-2 text-center font-mono text-xs text-muted-foreground">{idx + 1}</td>
                        {columns.map((col) => {
                          const isEditing = editingCell?.rowId === row.id && editingCell?.colId === col.column_name;
                          const cellValue = row.row_data?.[col.column_name] || "";
                          return (
                            <td key={col.id} className="p-0 border-l">
                              {isEditing ? (
                                <Input
                                  value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  className="h-8 rounded-none border-0 border-primary ring-1 ring-primary text-xs"
                                  autoFocus
                                  onBlur={() => saveCellEdit(row.id, col.column_name)}
                                  onKeyDown={e => {
                                    if (e.key === "Enter") saveCellEdit(row.id, col.column_name);
                                    if (e.key === "Escape") setEditingCell(null);
                                  }}
                                />
                              ) : (
                                <div
                                  className="px-2 py-1.5 min-h-[32px] cursor-text text-xs hover:bg-muted/50"
                                  onClick={() => startEditCell(row.id, col.column_name, cellValue)}
                                >
                                  {cellValue || <span className="text-muted-foreground/40">—</span>}
                                </div>
                              )}
                            </td>
                          );
                        })}
                        <td className="p-1 text-center">
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deleteRow(row.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={columns.length + 2} className="text-center text-muted-foreground py-8">
                          لا توجد بيانات. أضف صفاً للبدء.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add column dialog */}
      <Dialog open={showAddColDialog} onOpenChange={setShowAddColDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>إضافة عمود جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>اسم العمود</Label>
              <Input
                value={newColName}
                onChange={e => setNewColName(e.target.value)}
                placeholder="مثال: البريد الإلكتروني"
                autoFocus
                onKeyDown={e => { if (e.key === "Enter") addColumn(); }}
              />
            </div>
            <Button onClick={addColumn} className="w-full">
              <Plus className="w-4 h-4 ml-2" />
              إضافة
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductSearchPage;
