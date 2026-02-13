import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

const BriefingPage = () => {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <FileText className="w-7 h-7 text-primary" />
        <h1 className="font-heading text-2xl font-bold">المسطرة الرقمية — Digital Briefing</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>المواصفات المشفرة</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            سيتم تحميل المسطرة الرقمية تلقائياً عند إسناد مهمة فحص لك. تتضمن صور العينة المرجعية المعتمدة (ألوان، أبعاد، تغليف).
          </p>
          <div className="mt-6 p-8 border-2 border-dashed border-muted rounded-xl text-center text-muted-foreground">
            لا توجد مهام فحص مسندة حالياً
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BriefingPage;
