import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CloudUpload } from "lucide-react";

const ReportsPage = () => {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <CloudUpload className="w-7 h-7 text-primary" />
        <h1 className="font-heading text-2xl font-bold">التقارير — Reports</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>التقارير المرفوعة</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            بمجرد التقاط الصورة، يتم تشفيرها وإرسالها للسحابة الآمنة فوراً. لا تملك صلاحية التعديل أو الحذف بعد الإرسال.
          </p>
          <div className="mt-6 p-8 border-2 border-dashed border-muted rounded-xl text-center text-muted-foreground">
            لا توجد تقارير مرفوعة
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsPage;
