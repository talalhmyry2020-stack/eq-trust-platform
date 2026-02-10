import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Check, Package, Star, Loader2 } from "lucide-react";

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

const ProductCatalog = ({ dealId, onProductSelected }: ProductCatalogProps) => {
  const { toast } = useToast();
  const [products, setProducts] = useState<ProductResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);

  const fetchProducts = async () => {
    const { data } = await supabase
      .from("deal_product_results")
      .select("*")
      .eq("deal_id", dealId)
      .order("created_at");
    setProducts((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchProducts(); }, [dealId]);

  const selectProduct = async (productId: string) => {
    setSelecting(productId);
    try {
      // أولاً نلغي أي اختيار سابق
      await supabase
        .from("deal_product_results")
        .update({ selected: false })
        .eq("deal_id", dealId);
      
      // ثم نختار المنتج الجديد
      await supabase
        .from("deal_product_results")
        .update({ selected: true })
        .eq("id", productId);

      toast({ title: "تم الاختيار", description: "تم اختيار المنتج بنجاح" });
      fetchProducts();
      onProductSelected();
    } catch (err) {
      toast({ title: "خطأ", description: "فشل اختيار المنتج", variant: "destructive" });
    } finally {
      setSelecting(null);
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

  return (
    <div className="space-y-4">
      <h3 className="font-heading text-lg font-semibold">المنتجات المتاحة</h3>
      <p className="text-sm text-muted-foreground">اختر المنتج المناسب لك من النتائج التالية</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {products.map((product) => (
          <Card key={product.id} className={`transition-all ${product.selected ? "border-primary ring-2 ring-primary/20" : "hover:border-primary/50"}`}>
            {product.product_image_url && (
              <div className="aspect-video overflow-hidden rounded-t-lg">
                <img 
                  src={product.product_image_url} 
                  alt={product.product_name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <h4 className="font-medium text-base">{product.product_name}</h4>
                {product.selected && (
                  <Badge variant="default" className="shrink-0">
                    <Check className="w-3 h-3 ml-1" /> مختار
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
                <div className="text-sm space-y-1">
                  <p className="text-muted-foreground font-medium">المواصفات:</p>
                  {Object.entries(product.specifications).map(([key, val]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-muted-foreground">{key}:</span>
                      <span className="font-medium">{String(val)}</span>
                    </div>
                  ))}
                </div>
              )}

              {!product.selected && (
                <Button 
                  className="w-full mt-2" 
                  onClick={() => selectProduct(product.id)}
                  disabled={selecting === product.id}
                >
                  {selecting === product.id ? (
                    <><Loader2 className="w-4 h-4 animate-spin ml-2" /> جاري الاختيار...</>
                  ) : (
                    "اختيار هذا المنتج"
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ProductCatalog;
