import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Check, Package, Star, Loader2, CheckCircle, Lock, ShoppingCart } from "lucide-react";

interface ProductResult {
  id: string;
  deal_id: string;
  product_name: string;
  product_image_url: string | null;
  price: number | null;
  currency: string;
  specifications: any;
  quality_rating: string | null;
  selected: boolean;
}

interface ProductCatalogProps {
  dealId: string;
  onProductSelected: () => void;
}

const quantityUnits = [
  { value: "وحدة", label: "وحدة" },
  { value: "كرتون", label: "كرتون" },
  { value: "كيلو", label: "كيلو" },
  { value: "طن", label: "طن" },
  { value: "لتر", label: "لتر" },
  { value: "متر", label: "متر" },
  { value: "قطعة", label: "قطعة" },
];

const ProductCatalog = ({ dealId, onProductSelected }: ProductCatalogProps) => {
  const { toast } = useToast();
  const [products, setProducts] = useState<ProductResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("");
  const [quantityUnit, setQuantityUnit] = useState("وحدة");
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [locked, setLocked] = useState(false);

  const fetchProducts = async () => {
    const { data } = await supabase
      .from("deal_product_results")
      .select("*")
      .eq("deal_id", dealId)
      .order("created_at");
    const items = (data as any[]) || [];
    setProducts(items);
    // Check if already selected
    const alreadySelected = items.find((p) => p.selected);
    if (alreadySelected) {
      setSelectedProductId(alreadySelected.id);
      setLocked(true);
    }
    setLoading(false);
  };

  useEffect(() => { fetchProducts(); }, [dealId]);

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  const handleConfirmSelection = async () => {
    if (!selectedProductId || !quantity || parseInt(quantity) <= 0) {
      toast({ title: "يرجى اختيار منتج وتحديد الكمية", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      // Deselect all
      await supabase
        .from("deal_product_results")
        .update({ selected: false })
        .eq("deal_id", dealId);

      // Select the chosen one
      await supabase
        .from("deal_product_results")
        .update({ selected: true })
        .eq("id", selectedProductId);

      // Update deal with phase transition
      await supabase
        .from("deals")
        .update({ 
          current_phase: "product_selected",
          estimated_amount: selectedProduct?.price ? selectedProduct.price * parseInt(quantity) : null,
        })
        .eq("id", dealId);

      setLocked(true);
      setShowConfirm(false);
      toast({ 
        title: "تم تأكيد اختيارك بنجاح ✅", 
        description: `المنتج: ${selectedProduct?.product_name} — الكمية: ${quantity} ${quantityUnit}. سيتم متابعة إجراءات الصفقة.` 
      });
      onProductSelected();
    } catch {
      toast({ title: "خطأ", description: "فشل في تأكيد الاختيار", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="mr-2 text-muted-foreground">جاري تحميل المنتجات...</span>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>لم يتم العثور على منتجات بعد</p>
        <p className="text-sm mt-1">جاري البحث... ستظهر النتائج هنا تلقائياً</p>
      </div>
    );
  }

  // Locked state — product already chosen
  if (locked && selectedProduct) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-primary">
          <Lock className="w-5 h-5" />
          <h3 className="font-heading text-lg font-semibold">تم تأكيد اختيارك</h3>
        </div>
        <Card className="border-primary ring-2 ring-primary/20">
          {selectedProduct.product_image_url && (
            <div className="aspect-video overflow-hidden rounded-t-lg">
              <img src={selectedProduct.product_image_url} alt={selectedProduct.product_name} className="w-full h-full object-cover" />
            </div>
          )}
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-base">{selectedProduct.product_name}</h4>
              <Badge className="bg-primary text-primary-foreground gap-1">
                <Check className="w-3 h-3" /> مؤكد
              </Badge>
            </div>
            {selectedProduct.price && (
              <p className="text-xl font-bold text-primary">
                {selectedProduct.price.toLocaleString()} {selectedProduct.currency}
              </p>
            )}
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-sm text-muted-foreground">جاري متابعة إجراءات الصفقة...</p>
              <p className="text-xs text-muted-foreground mt-1">سيتم إشعارك بأي تحديثات</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-heading text-lg font-semibold">المنتجات المتاحة</h3>
      <p className="text-sm text-muted-foreground">اختر المنتج المناسب ثم حدد الكمية للتأكيد</p>

      {/* Quantity & Unit Selection Bar */}
      <div className="bg-muted/50 rounded-xl p-4 space-y-3">
        <p className="text-sm font-medium">حدد الكمية المطلوبة:</p>
        <div className="flex flex-wrap items-center gap-3">
          <Input
            type="number"
            placeholder="الكمية"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            min={1}
            className="w-32"
            dir="ltr"
          />
          <Select value={quantityUnit} onValueChange={setQuantityUnit}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {quantityUnits.map((u) => (
                <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedProductId && quantity && parseInt(quantity) > 0 && (
            <Button onClick={() => setShowConfirm(true)} className="gap-2">
              <CheckCircle className="w-4 h-4" />
              تأكيد الاختيار
            </Button>
          )}
        </div>
        {selectedProductId && (
          <p className="text-xs text-muted-foreground">
            المنتج المختار: <span className="font-medium text-foreground">{selectedProduct?.product_name}</span>
          </p>
        )}
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {products.map((product) => {
          const isSelected = product.id === selectedProductId;
          return (
            <Card 
              key={product.id} 
              className={`cursor-pointer transition-all overflow-hidden ${
                isSelected 
                  ? "border-primary ring-2 ring-primary/20" 
                  : "hover:border-primary/50"
              }`}
              onClick={() => setSelectedProductId(product.id)}
            >
              {isSelected && <div className="h-1 bg-primary" />}
              {product.product_image_url && (
                <div className="aspect-video overflow-hidden relative">
                  <img src={product.product_image_url} alt={product.product_name} className="w-full h-full object-cover" />
                  {isSelected && (
                    <div className="absolute top-2 left-2 bg-primary text-primary-foreground rounded-full p-1.5">
                      <Check className="w-4 h-4" />
                    </div>
                  )}
                </div>
              )}
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <h4 className="font-medium text-base">{product.product_name}</h4>
                  {isSelected && (
                    <Badge variant="default" className="shrink-0 gap-1">
                      <ShoppingCart className="w-3 h-3" /> مختار
                    </Badge>
                  )}
                </div>

                {product.price && (
                  <p className="text-xl font-bold text-primary">
                    {product.price.toLocaleString()} {product.currency}
                  </p>
                )}

                {product.quality_rating && (
                  <div className="flex items-center gap-1 text-sm">
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    <span>{product.quality_rating}</span>
                  </div>
                )}

                {product.specifications && Object.keys(product.specifications).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(product.specifications).slice(0, 4).map(([key, val]) => (
                      <Badge key={key} variant="outline" className="text-xs">{key}: {String(val)}</Badge>
                    ))}
                  </div>
                )}

                {quantity && parseInt(quantity) > 0 && product.price && (
                  <div className="text-sm bg-muted/50 p-2 rounded-md text-center">
                    <span className="text-muted-foreground">الإجمالي التقديري: </span>
                    <span className="font-bold text-primary">
                      {(product.price * parseInt(quantity)).toLocaleString()} {product.currency}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>تأكيد اختيار المنتج</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <p className="text-sm"><span className="text-muted-foreground">المنتج:</span> <strong>{selectedProduct?.product_name}</strong></p>
              {selectedProduct?.price && (
                <p className="text-sm"><span className="text-muted-foreground">سعر الوحدة:</span> <strong>{selectedProduct.price.toLocaleString()} {selectedProduct.currency}</strong></p>
              )}
              <p className="text-sm"><span className="text-muted-foreground">الكمية:</span> <strong>{quantity} {quantityUnit}</strong></p>
              {selectedProduct?.price && quantity && (
                <p className="text-sm"><span className="text-muted-foreground">الإجمالي التقديري:</span> <strong className="text-primary">{(selectedProduct.price * parseInt(quantity)).toLocaleString()} {selectedProduct.currency}</strong></p>
              )}
            </div>
            <p className="text-xs text-muted-foreground text-center">بعد التأكيد لن تتمكن من تغيير الاختيار وسيتم متابعة إجراءات الصفقة</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={submitting}>إلغاء</Button>
            <Button onClick={handleConfirmSelection} disabled={submitting} className="gap-2">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              تأكيد نهائي
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductCatalog;
