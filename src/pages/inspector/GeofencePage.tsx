import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin } from "lucide-react";

const GeofencePage = () => {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <MapPin className="w-7 h-7 text-primary" />
        <h1 className="font-heading text-2xl font-bold">القفل الجغرافي — Geo-Fencing</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>بروتوكول الحضور المكاني</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            لن يعمل تطبيق الفحص إلا إذا تطابقت إحداثيات GPS لهاتفك مع موقع المصنع المثبت في العقد بدقة مترية.
          </p>
          <div className="mt-6 p-8 border-2 border-dashed border-muted rounded-xl text-center text-muted-foreground">
            لا توجد مواقع فحص مسندة حالياً
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GeofencePage;
