import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, FileText, MapPin, Camera, Eye, CloudUpload } from "lucide-react";

const tasks = [
  {
    icon: FileText,
    title: "الاستلام المشفر للمواصفات",
    subtitle: "Digital Briefing",
    description: "يقوم النظام بتحميل \"المسطرة الرقمية\" على جهازك قبل التحرك، تتضمن صور العينة المرجعية المعتمدة (ألوان، أبعاد، تغليف) لتكون المرجع الوحيد للمطابقة.",
    status: "جاهز",
  },
  {
    icon: MapPin,
    title: "القفل الجغرافي",
    subtitle: "Geo-Fencing Check",
    description: "تفعيل بروتوكول الحضور المكاني. لن يعمل تطبيق الفحص إلا إذا تطابقت إحداثيات GPS لهاتفك مع موقع المصنع المثبت في العقد بدقة مترية.",
    status: "في انتظار مهمة",
  },
  {
    icon: Camera,
    title: "التوثيق المقيد",
    subtitle: "Restricted Capture Protocol",
    description: "تصوير البضاعة حصراً عبر كاميرا التطبيق المباشرة. النظام يمنعك نهائياً من رفع صور مخزنة سابقاً. كل صورة تُدمج بختم زمني وإحداثيات لا يمكن تعديلها.",
    status: "في انتظار مهمة",
  },
  {
    icon: Eye,
    title: "المطابقة البصرية وإطلاق التوكن",
    subtitle: "Visual Validation",
    description: "مطابقة المنتج الواقعي مع العينة المرجعية. في حال المطابقة التامة، اضغط \"اعتماد\" ليصدر النظام توكن الدفعة. في حال وجود عيب، ارفع الدليل فوراً.",
    status: "في انتظار مهمة",
  },
  {
    icon: CloudUpload,
    title: "العزل التام",
    subtitle: "No-Collusion Policy",
    description: "رفع التقرير مباشرة إلى السحابة الآمنة. بمجرد التقاط الصورة، يتم تشفيرها وإرسالها فوراً. لا تملك صلاحية التعديل أو الحذف بعد الإرسال.",
    status: "في انتظار مهمة",
  },
];

const InspectorDashboard = () => {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-8 h-8 text-primary" />
        <div>
          <h1 className="font-heading text-2xl font-bold">المفتش الميداني — الوكيل 06</h1>
          <p className="text-sm text-muted-foreground italic">
            "العين التي لا ترمش.. واليد المقيدة بالحقيقة"
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">مهام نشطة</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">0</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">مهام مكتملة</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">0</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">الحالة</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold text-primary">جاهز للمهام</p>
          </CardContent>
        </Card>
      </div>

      <h2 className="font-heading text-xl font-bold mb-4">بروتوكولات العمل</h2>
      <div className="space-y-4">
        {tasks.map((task, i) => (
          <Card key={i} className="hover:border-primary/30 transition-colors">
            <CardContent className="p-5 flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <task.icon className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold">{task.title}</h3>
                  <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                    {task.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-1 font-mono">{task.subtitle}</p>
                <p className="text-sm text-muted-foreground">{task.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default InspectorDashboard;
