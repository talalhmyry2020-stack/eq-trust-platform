import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye } from "lucide-react";

const ValidatePage = () => {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Eye className="w-7 h-7 text-primary" />
        <h1 className="font-heading text-2xl font-bold">المطابقة البصرية — Visual Validation</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>مطابقة المنتج مع العينة المرجعية</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            قارن المنتج الواقعي مع العينة المرجعية. في حال المطابقة التامة، اضغط "اعتماد" ليصدر النظام توكن الدفعة. في حال وجود عيب، ارفع الدليل فوراً لتجميد الأموال ومنع الشحن.
          </p>
          <div className="mt-6 p-8 border-2 border-dashed border-muted rounded-xl text-center text-muted-foreground">
            لا توجد مهام مطابقة حالياً
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ValidatePage;
