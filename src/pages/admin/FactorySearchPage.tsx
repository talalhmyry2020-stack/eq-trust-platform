import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, Building2, Mail, Phone, Globe, MapPin, Package } from "lucide-react";
import { toast } from "sonner";

interface Factory {
  name: string;
  address: string;
  email: string;
  phone: string;
  website: string;
  country: string;
  products: string;
  notes: string;
}

const FactorySearchPage = () => {
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [loading, setLoading] = useState(false);
  const [factories, setFactories] = useState<Factory[]>([]);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) {
      toast.error("أدخل كلمة البحث");
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const { data, error } = await supabase.functions.invoke("search-factories", {
        body: { query: query.trim(), country: country.trim() || undefined },
      });
      if (error) throw error;
      if (data?.success) {
        setFactories(data.factories || []);
        if (data.factories?.length === 0) {
          toast.info("لم يتم العثور على نتائج");
        } else {
          toast.success(`تم العثور على ${data.factories.length} مصنع/مورد`);
        }
      } else {
        throw new Error(data?.error || "فشل البحث");
      }
    } catch (err: any) {
      console.error("Search error:", err);
      toast.error(err.message || "خطأ في البحث");
      setFactories([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl font-bold">🔍 بحث المصانع والموردين</h1>
      </div>

      {/* Search form */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Label className="mb-2 block">المنتج أو الصناعة</Label>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="مثال: ملابس قطنية، أجهزة إلكترونية، مواد غذائية..."
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <div className="w-full sm:w-48">
              <Label className="mb-2 block">البلد (اختياري)</Label>
              <Input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="مثال: الصين، تركيا..."
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleSearch} disabled={loading} className="w-full sm:w-auto">
                {loading ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Search className="w-4 h-4 ml-2" />}
                بحث
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {loading && (
        <div className="text-center py-16">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">جارٍ البحث عن المصانع والموردين...</p>
        </div>
      )}

      {!loading && searched && factories.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          لم يتم العثور على نتائج. جرّب كلمات بحث مختلفة.
        </div>
      )}

      {!loading && factories.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {factories.map((factory, idx) => (
            <Card key={idx} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  {factory.name}
                  {factory.country && (
                    <Badge variant="secondary" className="mr-auto text-xs">{factory.country}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {factory.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <span>{factory.address}</span>
                  </div>
                )}
                {factory.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                    <a href={`mailto:${factory.email}`} className="text-primary hover:underline">{factory.email}</a>
                  </div>
                )}
                {factory.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                    <a href={`tel:${factory.phone}`} className="hover:underline">{factory.phone}</a>
                  </div>
                )}
                {factory.website && (
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                    <a href={factory.website.startsWith("http") ? factory.website : `https://${factory.website}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">{factory.website}</a>
                  </div>
                )}
                {factory.products && (
                  <div className="flex items-start gap-2">
                    <Package className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">{factory.products}</span>
                  </div>
                )}
                {factory.notes && (
                  <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">{factory.notes}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default FactorySearchPage;
