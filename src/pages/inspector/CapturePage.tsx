import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera } from "lucide-react";

const CapturePage = () => {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Camera className="w-7 h-7 text-primary" />
        <h1 className="font-heading text-2xl font-bold">التوثيق المقيد — Restricted Capture</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>بروتوكول التصوير الآمن</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            تصوير البضاعة حصراً عبر كاميرا التطبيق المباشرة. النظام يمنع رفع صور مخزنة سابقاً. كل صورة تُدمج بختم زمني وإحداثيات لا يمكن تعديلها.
          </p>
          <div className="mt-6 p-8 border-2 border-dashed border-muted rounded-xl text-center text-muted-foreground">
            لا توجد مهام تصوير حالياً
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CapturePage;
