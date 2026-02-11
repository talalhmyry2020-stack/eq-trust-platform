import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings } from "lucide-react";

const SettingsPage = () => {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-primary" />
          <h1 className="font-heading text-2xl font-bold">الإعدادات</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">⚙️ إعدادات النظام</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            لا توجد إعدادات مُفعّلة حالياً. سيتم إضافة الإعدادات خطوة بخطوة.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;
