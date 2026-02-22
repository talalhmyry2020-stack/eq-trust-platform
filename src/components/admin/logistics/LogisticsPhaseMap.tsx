import { Badge } from "@/components/ui/badge";
import { Package, Truck, Anchor, Ship, MapPin } from "lucide-react";

export const SHIPPING_PHASES = [
  { key: "loading_goods", label: "📦 قيد التحميل", icon: Package, color: "text-yellow-500", next: "leaving_factory" },
  { key: "leaving_factory", label: "🚛 مغادرة المصنع", icon: Truck, color: "text-orange-500", next: "at_source_port" },
  { key: "at_source_port", label: "⚓ ميناء التصدير", icon: Anchor, color: "text-blue-500", next: "in_transit" },
  { key: "in_transit", label: "🚢 في البحر", icon: Ship, color: "text-cyan-500", next: "at_destination_port" },
  { key: "at_destination_port", label: "🏁 ميناء الوجهة", icon: MapPin, color: "text-green-500", next: null },
];

export const PHASE_CHECKLIST: Record<string, { id: string; label: string; required: boolean }[]> = {
  loading_goods: [
    { id: "container_photo", label: "📸 تصوير رقم الحاوية", required: true },
    { id: "seal_photo", label: "📸 تصوير الختم الملاحي (Seal)", required: true },
    { id: "goods_photo", label: "📸 صور البضاعة داخل الحاوية", required: true },
    { id: "container_number", label: "✏️ كتابة رقم الحاوية", required: true },
    { id: "seal_number", label: "✏️ كتابة رقم الختم", required: true },
    { id: "report", label: "📋 كتابة تقرير التحميل", required: true },
  ],
  leaving_factory: [
    { id: "truck_photo", label: "📸 تصوير الشاحنة مع اللوحة", required: true },
    { id: "bol_photo", label: "📸 تصوير بوليصة الشحن (BOL)", required: true },
    { id: "bol_number", label: "✏️ كتابة رقم بوليصة الشحن", required: true },
    { id: "report", label: "📋 كتابة تقرير المغادرة", required: true },
  ],
  at_source_port: [
    { id: "port_photo", label: "📸 تصوير الحاوية في الميناء", required: true },
    { id: "tracking_url", label: "🔗 إدخال رابط التتبع", required: true },
    { id: "ship_photo", label: "📸 تصوير السفينة", required: false },
    { id: "report", label: "📋 كتابة تقرير ميناء التصدير", required: true },
  ],
  in_transit: [
    { id: "tracking_confirmed", label: "✅ تأكيد تحديث رابط التتبع", required: true },
    { id: "report", label: "📋 كتابة تقرير الشحن البحري", required: true },
  ],
  at_destination_port: [
    { id: "arrival_photo", label: "📸 تصوير وصول الحاوية", required: false },
    { id: "report", label: "📋 كتابة تقرير الوصول", required: true },
  ],
};

interface Props {
  phaseCounts: Record<string, number>;
}

const LogisticsPhaseMap = ({ phaseCounts }: Props) => {
  return (
    <div className="flex items-center justify-between mb-6 p-3 rounded-lg border bg-card overflow-x-auto">
      {SHIPPING_PHASES.map((phase, i) => {
        const count = phaseCounts[phase.key] || 0;
        const Icon = phase.icon;
        return (
          <div key={phase.key} className="flex items-center gap-1">
            <div className="flex flex-col items-center text-center min-w-[80px]">
              <Icon className={`w-5 h-5 ${phase.color}`} />
              <span className="text-xs mt-1">{phase.label.replace(/^.+\s/, "")}</span>
              <Badge variant="secondary" className="text-xs mt-1">{count}</Badge>
            </div>
            {i < SHIPPING_PHASES.length - 1 && <span className="text-muted-foreground mx-1">→</span>}
          </div>
        );
      })}
    </div>
  );
};

export default LogisticsPhaseMap;
