import { Card, CardContent } from "@/components/ui/card";
import { Package, CheckCircle, Clock, AlertTriangle } from "lucide-react";

interface Props {
  totalActive: number;
  totalCompleted: number;
  totalReports: number;
  totalPhotos: number;
}

const LogisticsStats = ({ totalActive, totalCompleted, totalReports, totalPhotos }: Props) => {
  const stats = [
    { label: "شحنات نشطة", value: totalActive, icon: Package, color: "text-yellow-500" },
    { label: "شحنات مكتملة", value: totalCompleted, icon: CheckCircle, color: "text-green-500" },
    { label: "تقارير مقدمة", value: totalReports, icon: Clock, color: "text-blue-500" },
    { label: "صور موثقة", value: totalPhotos, icon: AlertTriangle, color: "text-purple-500" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {stats.map((s) => (
        <Card key={s.label}>
          <CardContent className="p-4 flex items-center gap-3">
            <s.icon className={`w-8 h-8 ${s.color}`} />
            <div>
              <p className="text-2xl font-bold font-heading">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default LogisticsStats;
