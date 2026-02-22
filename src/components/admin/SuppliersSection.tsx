import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Factory, Camera, DollarSign, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface SupplierData {
  dealId: string;
  dealNumber: number;
  factoryName: string;
  factoryCountry: string;
  factoryEmail: string;
  factoryPhone: string;
  currentPhase: string;
  photos: { url: string; missionType: string; lat: number; lng: number; capturedAt: string }[];
  tokens: { type: string; amount: number; percentage: number; status: string; currency: string }[];
  escrow: { totalDeposited: number; totalReleased: number; balance: number; currency: string } | null;
}

const MISSION_LABELS: Record<string, string> = {
  initial: "فحص أولي",
  quality: "فحص جودة",
  port: "فحص ميناء",
};

const TOKEN_LABELS: Record<string, string> = {
  token_a: "توكن A — 30%",
  token_b: "توكن B — 50%",
  token_c: "توكن C — 20%",
};

const TOKEN_STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "معلّق", variant: "outline" },
  approved: { label: "مُعتمد", variant: "default" },
  rejected: { label: "مرفوض", variant: "destructive" },
};

const SuppliersSection = () => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["admin-suppliers"],
    queryFn: async () => {
      // Get deals with signed contracts (factory_approval or beyond)
      const { data: negotiations } = await supabase
        .from("deal_negotiations")
        .select("deal_id, factory_name, factory_country, factory_email, factory_phone")
        .eq("status", "accepted");

      if (!negotiations?.length) return [];

      const dealIds = [...new Set(negotiations.map((n) => n.deal_id))];

      const [dealsRes, photosRes, tokensRes, escrowRes] = await Promise.all([
        supabase.from("deals").select("id, deal_number, current_phase").in("id", dealIds),
        supabase
          .from("deal_inspection_photos")
          .select("deal_id, photo_url, latitude, longitude, captured_at, mission_id")
          .in("deal_id", dealIds),
        supabase
          .from("deal_tokens")
          .select("deal_id, token_type, amount, percentage, status, currency")
          .in("deal_id", dealIds),
        supabase
          .from("deal_escrow")
          .select("deal_id, total_deposited, total_released, balance, currency")
          .in("deal_id", dealIds),
      ]);

      // Get mission types for photos
      const missionIds = [...new Set((photosRes.data || []).map((p) => p.mission_id))];
      let missionsMap: Record<string, string> = {};
      if (missionIds.length) {
        const { data: missions } = await supabase
          .from("deal_inspection_missions")
          .select("id, mission_type")
          .in("id", missionIds);
        missionsMap = Object.fromEntries((missions || []).map((m) => [m.id, m.mission_type]));
      }

      const result: SupplierData[] = [];

      for (const dealId of dealIds) {
        const deal = dealsRes.data?.find((d) => d.id === dealId);
        const neg = negotiations.find((n) => n.deal_id === dealId);
        if (!deal || !neg) continue;

        result.push({
          dealId,
          dealNumber: deal.deal_number,
          factoryName: neg.factory_name,
          factoryCountry: neg.factory_country || "",
          factoryEmail: neg.factory_email || "",
          factoryPhone: neg.factory_phone || "",
          currentPhase: deal.current_phase || "",
          photos: (photosRes.data || [])
            .filter((p) => p.deal_id === dealId)
            .map((p) => ({
              url: p.photo_url,
              missionType: missionsMap[p.mission_id] || "initial",
              lat: p.latitude,
              lng: p.longitude,
              capturedAt: p.captured_at,
            })),
          tokens: (tokensRes.data || [])
            .filter((t) => t.deal_id === dealId)
            .map((t) => ({
              type: t.token_type,
              amount: Number(t.amount),
              percentage: Number(t.percentage),
              status: t.status,
              currency: t.currency,
            })),
          escrow: (() => {
            const e = escrowRes.data?.find((e) => e.deal_id === dealId);
            return e
              ? {
                  totalDeposited: Number(e.total_deposited),
                  totalReleased: Number(e.total_released),
                  balance: Number(e.balance),
                  currency: e.currency,
                }
              : null;
          })(),
        });
      }

      return result;
    },
  });

  if (isLoading) {
    return (
      <div className="mt-8">
        <h2 className="font-heading text-xl font-bold mb-4 flex items-center gap-2">
          <Factory className="w-5 h-5 text-primary" />
          الموردون
        </h2>
        <p className="text-muted-foreground text-sm">جاري التحميل...</p>
      </div>
    );
  }

  if (!suppliers.length) {
    return (
      <div className="mt-8">
        <h2 className="font-heading text-xl font-bold mb-4 flex items-center gap-2">
          <Factory className="w-5 h-5 text-primary" />
          الموردون
        </h2>
        <p className="text-muted-foreground text-sm">لا يوجد موردون حتى الآن</p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <h2 className="font-heading text-xl font-bold mb-4 flex items-center gap-2">
        <Factory className="w-5 h-5 text-primary" />
        الموردون ({suppliers.length})
      </h2>

      <div className="grid gap-4">
        {suppliers.map((s) => {
          const isExpanded = expandedId === s.dealId;
          return (
            <Card key={s.dealId} className="overflow-hidden">
              <CardHeader
                className="cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : s.dealId)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Factory className="w-6 h-6 text-primary" />
                    <div>
                      <CardTitle className="text-base">{s.factoryName}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {s.factoryCountry && `${s.factoryCountry} · `}صفقة #{s.dealNumber}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {s.tokens.length} توكن
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {s.photos.length} صورة
                    </Badge>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="border-t pt-4 space-y-6">
                  {/* بيانات المصنع */}
                  <div>
                    <h4 className="text-sm font-semibold mb-2">بيانات المصنع</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                      {s.factoryEmail && (
                        <div>
                          <span className="text-muted-foreground">البريد: </span>
                          <span dir="ltr">{s.factoryEmail}</span>
                        </div>
                      )}
                      {s.factoryPhone && (
                        <div>
                          <span className="text-muted-foreground">الهاتف: </span>
                          <span dir="ltr">{s.factoryPhone}</span>
                        </div>
                      )}
                      {s.factoryCountry && (
                        <div>
                          <span className="text-muted-foreground">البلد: </span>
                          <span>{s.factoryCountry}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* التوكنات المالية */}
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                      <DollarSign className="w-4 h-4 text-primary" />
                      التوكنات المالية
                    </h4>
                    {s.tokens.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {s.tokens.map((t, i) => (
                          <div key={i} className="border rounded-lg p-3 text-sm">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium">{TOKEN_LABELS[t.type] || t.type}</span>
                              <Badge variant={TOKEN_STATUS[t.status]?.variant || "outline"}>
                                {TOKEN_STATUS[t.status]?.label || t.status}
                              </Badge>
                            </div>
                            <p className="text-lg font-bold text-primary">
                              {t.amount.toLocaleString()} {t.currency}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">لم تُصدر أي توكنات بعد</p>
                    )}

                    {/* رصيد الخزينة */}
                    {s.escrow && (
                      <div className="mt-3 border rounded-lg p-3 bg-muted/20">
                        <h5 className="text-xs font-semibold text-muted-foreground mb-2">رصيد الخزينة (Escrow)</h5>
                        <div className="grid grid-cols-3 gap-2 text-sm text-center">
                          <div>
                            <p className="text-muted-foreground text-xs">المودع</p>
                            <p className="font-bold">{s.escrow.totalDeposited.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">المصروف</p>
                            <p className="font-bold text-destructive">{s.escrow.totalReleased.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">المتبقي</p>
                            <p className="font-bold text-primary">{s.escrow.balance.toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* صور المفتش */}
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                      <Camera className="w-4 h-4 text-primary" />
                      صور المفتش الميداني ({s.photos.length})
                    </h4>
                    {s.photos.length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                        {s.photos.map((p, i) => (
                          <div key={i} className="relative group">
                            <img
                              src={p.url}
                              alt={`صورة فحص ${i + 1}`}
                              className="w-full h-24 object-cover rounded-lg border"
                              loading="lazy"
                            />
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] p-1 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity">
                              <span>{MISSION_LABELS[p.missionType] || p.missionType}</span>
                              <br />
                              <span dir="ltr">
                                {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">لا توجد صور بعد</p>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default SuppliersSection;
