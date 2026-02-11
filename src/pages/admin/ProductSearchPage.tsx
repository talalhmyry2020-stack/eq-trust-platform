import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, Save, X, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface ProductResult {
  id: string;
  deal_id: string;
  product_name: string;
  price: number | null;
  currency: string | null;
  quality_rating: string | null;
  product_image_url: string | null;
  selected: boolean | null;
  specifications: any;
  supplier_name: string | null;
  origin_country: string | null;
  product_url: string | null;
  notes: string | null;
  created_at: string;
}

interface Deal {
  id: string;
  deal_number: number;
  title: string;
  client_full_name: string | null;
}

const emptyProduct = {
  product_name: "",
  price: "",
  currency: "USD",
  quality_rating: "",
  product_image_url: "",
  supplier_name: "",
  origin_country: "",
  product_url: "",
  notes: "",
};

const ProductSearchPage = () => {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [selectedDealId, setSelectedDealId] = useState<string>("");
  const [products, setProducts] = useState<ProductResult[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductResult | null>(null);
  const [form, setForm] = useState(emptyProduct);

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

  const fetchProducts = useCallback(async () => {
    if (!selectedDealId) return;
    const { data } = await supabase
      .from("deal_product_results")
      .select("*")
      .eq("deal_id", selectedDealId)
      .order("created_at", { ascending: true });
    setProducts(data as ProductResult[] || []);
  }, [selectedDealId]);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);
  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const openAdd = () => {
    setForm(emptyProduct);
    setEditingProduct(null);
    setShowAddDialog(true);
  };

  const openEdit = (p: ProductResult) => {
    setEditingProduct(p);
    setForm({
      product_name: p.product_name || "",
      price: p.price?.toString() || "",
      currency: p.currency || "USD",
      quality_rating: p.quality_rating || "",
      product_image_url: p.product_image_url || "",
      supplier_name: p.supplier_name || "",
      origin_country: p.origin_country || "",
      product_url: p.product_url || "",
      notes: p.notes || "",
    });
    setShowAddDialog(true);
  };

  const saveProduct = async () => {
    if (!form.product_name) { toast.error("اسم المنتج مطلوب"); return; }
    const payload = {
      deal_id: selectedDealId,
      product_name: form.product_name,
      price: form.price ? parseFloat(form.price) : null,
      currency: form.currency || "USD",
      quality_rating: form.quality_rating || null,
      product_image_url: form.product_image_url || null,
      supplier_name: form.supplier_name || null,
      origin_country: form.origin_country || null,
      product_url: form.product_url || null,
      notes: form.notes || null,
    };

    if (editingProduct) {
      const { error } = await supabase.from("deal_product_results").update(payload).eq("id", editingProduct.id);
      if (error) { toast.error("خطأ في التحديث"); return; }
      toast.success("تم التحديث");
    } else {
      const { error } = await supabase.from("deal_product_results").insert(payload);
      if (error) { toast.error("خطأ في الإضافة"); return; }
      toast.success("تمت الإضافة");
    }
    setShowAddDialog(false);
    fetchProducts();
  };

  const deleteProduct = async (id: string) => {
    const { error } = await supabase.from("deal_product_results").delete().eq("id", id);
    if (error) { toast.error("خطأ في الحذف"); return; }
    toast.success("تم الحذف");
    fetchProducts();
  };

  const selectedDeal = deals.find(d => d.id === selectedDealId);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl font-bold">نتائج البحث عن المنتجات</h1>
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
        {selectedDealId && (
          <Button onClick={openAdd}>
            <Plus className="w-4 h-4 ml-2" />
            إضافة منتج
          </Button>
        )}
      </div>

      {/* Selected deal info */}
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

      {/* Products table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>اسم المنتج</TableHead>
                  <TableHead>المورد</TableHead>
                  <TableHead>بلد المنشأ</TableHead>
                  <TableHead>السعر</TableHead>
                  <TableHead>العملة</TableHead>
                  <TableHead>التقييم</TableHead>
                  <TableHead>رابط</TableHead>
                  <TableHead>صورة</TableHead>
                  <TableHead>ملاحظات</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p, idx) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{idx + 1}</TableCell>
                    <TableCell className="font-medium">{p.product_name}</TableCell>
                    <TableCell>{p.supplier_name || "—"}</TableCell>
                    <TableCell>{p.origin_country || "—"}</TableCell>
                    <TableCell className="font-mono">{p.price ?? "—"}</TableCell>
                    <TableCell>{p.currency || "—"}</TableCell>
                    <TableCell>{p.quality_rating || "—"}</TableCell>
                    <TableCell>
                      {p.product_url ? (
                        <a href={p.product_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      {p.product_image_url ? (
                        <img src={p.product_image_url} alt={p.product_name} className="w-10 h-10 object-cover rounded" />
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-xs max-w-[150px] truncate">{p.notes || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(p)} title="تعديل">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteProduct(p.id)} title="حذف">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {products.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                      لا توجد نتائج بحث لهذه الصفقة
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "تعديل المنتج" : "إضافة منتج جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>اسم المنتج *</Label><Input value={form.product_name} onChange={e => setForm({ ...form, product_name: e.target.value })} /></div>
            <div><Label>المورد / الشركة</Label><Input value={form.supplier_name} onChange={e => setForm({ ...form, supplier_name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>السعر</Label><Input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></div>
              <div><Label>العملة</Label>
                <Select value={form.currency} onValueChange={v => setForm({ ...form, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="SAR">SAR</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="CNY">CNY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>بلد المنشأ</Label><Input value={form.origin_country} onChange={e => setForm({ ...form, origin_country: e.target.value })} /></div>
            <div><Label>التقييم / الجودة</Label><Input value={form.quality_rating} onChange={e => setForm({ ...form, quality_rating: e.target.value })} /></div>
            <div><Label>رابط المنتج</Label><Input value={form.product_url} onChange={e => setForm({ ...form, product_url: e.target.value })} dir="ltr" /></div>
            <div><Label>رابط صورة المنتج</Label><Input value={form.product_image_url} onChange={e => setForm({ ...form, product_image_url: e.target.value })} dir="ltr" /></div>
            <div><Label>ملاحظات</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            <Button onClick={saveProduct} className="w-full">
              <Save className="w-4 h-4 ml-2" />
              {editingProduct ? "تحديث" : "إضافة"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductSearchPage;
