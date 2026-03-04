import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Loader2, Users, ShieldCheck, Truck, Eye, Star, Copy, LogIn, Rocket, Timer } from "lucide-react";

const DEMO_ACCOUNTS = [
  {
    role: "مدير النظام",
    email: "demo-admin@eq-platform.test",
    password: "DemoAdmin2024!",
    icon: ShieldCheck,
    color: "bg-red-500/10 text-red-600 border-red-200",
    badgeColor: "destructive" as const,
    description: "يرى كل الصفقات، يدير المستخدمين، يعتمد الإيداعات، يصرف التوكنات",
    loginPath: "/admin",
  },
  {
    role: "عميل",
    email: "demo-client@eq-platform.test",
    password: "DemoClient2024!",
    icon: Users,
    color: "bg-blue-500/10 text-blue-600 border-blue-200",
    badgeColor: "default" as const,
    description: "ينشئ صفقات، يتابع التفاوض والعقود، يراقب الشحنات",
    loginPath: "/client",
  },
  {
    role: "مفتش ميداني",
    email: "demo-inspector@eq-platform.test",
    password: "DemoInspector2024!",
    icon: Eye,
    color: "bg-amber-500/10 text-amber-600 border-amber-200",
    badgeColor: "secondary" as const,
    description: "يستلم مهام الفحص، يوثق الصور، يرفع التقارير",
    loginPath: "/inspector",
  },
  {
    role: "موظف لوجستيك",
    email: "demo-logistics@eq-platform.test",
    password: "DemoLogistics2024!",
    icon: Truck,
    color: "bg-green-500/10 text-green-600 border-green-200",
    badgeColor: "outline" as const,
    description: "يوثق الحاويات والشحن، يرفع تقارير الميناء",
    loginPath: "/logistics",
  },
  {
    role: "وكيل جودة",
    email: "demo-quality@eq-platform.test",
    password: "DemoQuality2024!",
    icon: Star,
    color: "bg-purple-500/10 text-purple-600 border-purple-200",
    badgeColor: "secondary" as const,
    description: "يفحص المنتجات ويطابقها مع العينة المرجعية",
    loginPath: "/quality",
  },
];

const DemoPage = () => {
  const [seeding, setSeeding] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [seedingSovereignty, setSeedingSovereignty] = useState(false);
  const [loggingIn, setLoggingIn] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const { data, error } = await supabase.functions.invoke("seed-demo");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSeeded(true);
      toast.success("تم إنشاء جميع الحسابات التجريبية بنجاح!");
    } catch (err: any) {
      toast.error("خطأ: " + (err.message || "فشل إنشاء الحسابات"));
    } finally {
      setSeeding(false);
    }
  };

  const handleSeedSovereignty = async () => {
    setSeedingSovereignty(true);
    try {
      const { data, error } = await supabase.functions.invoke("seed-sovereignty-deal");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`✅ تم إنشاء صفقة #${data.deal_number} في مرحلة العداد السيادي!`);
    } catch (err: any) {
      toast.error("خطأ: " + (err.message || "فشل إنشاء الصفقة"));
    } finally {
      setSeedingSovereignty(false);
    }
  };

  const handleLogin = async (email: string, password: string, path: string) => {
    setLoggingIn(email);
    try {
      // Sign out first
      await supabase.auth.signOut();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("تم تسجيل الدخول!");
      navigate(path);
    } catch (err: any) {
      toast.error("خطأ في الدخول: " + err.message);
    } finally {
      setLoggingIn(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("تم النسخ!");
  };

  return (
    <div className="min-h-screen bg-background bg-mesh" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-l from-primary/10 via-background to-accent/10 border-b border-border/50">
        <div className="max-w-5xl mx-auto px-6 py-12 text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Rocket className="w-4 h-4" />
            وضع التجربة
          </div>
          <h1 className="text-4xl font-heading font-bold text-foreground mb-4">
            جرّب المنصة مع فريقك
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            أنشئ حسابات تجريبية لكل دور (مدير، عميل، مفتش، لوجستيك، جودة) وادخل كل شخص من جهازه ليرى لوحته الخاصة ويتابع سير العمل الكامل.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Seed Button */}
        {!seeded && (
          <div className="text-center mb-10">
            <Button
              size="lg"
              onClick={handleSeed}
              disabled={seeding}
              className="gap-2 text-lg px-8 py-6"
            >
              {seeding ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Rocket className="w-5 h-5" />
              )}
              {seeding ? "جاري إنشاء الحسابات..." : "🚀 إنشاء جميع الحسابات التجريبية"}
            </Button>
            <p className="text-muted-foreground text-sm mt-3">
              سيتم إنشاء 5 حسابات: مدير + عميل + مفتش + لوجستيك + جودة
            </p>
          </div>
        )}

        {seeded && (
          <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-xl p-4 mb-8 text-center space-y-3">
            <p className="text-green-700 dark:text-green-400 font-medium">
              ✅ الحسابات جاهزة! شارك بيانات الدخول مع أصدقائك أو ادخل مباشرة من أي حساب
            </p>
            <Button
              onClick={handleSeedSovereignty}
              disabled={seedingSovereignty}
              variant="outline"
              className="gap-2 border-red-300 text-red-600 hover:bg-red-50"
            >
              {seedingSovereignty ? <Loader2 className="w-4 h-4 animate-spin" /> : <Timer className="w-4 h-4" />}
              {seedingSovereignty ? "جاري الإنشاء..." : "⏱️ إنشاء صفقة في مرحلة العداد السيادي"}
            </Button>
          </div>
        )}

        {/* Accounts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {DEMO_ACCOUNTS.map((acc) => {
            const Icon = acc.icon;
            return (
              <Card key={acc.email} className={`border-2 ${acc.color} transition-all hover:shadow-lg`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-background flex items-center justify-center shadow-sm">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{acc.role}</CardTitle>
                      <Badge variant={acc.badgeColor} className="text-xs mt-1">تجريبي</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{acc.description}</p>
                  
                  <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">البريد:</span>
                      <div className="flex items-center gap-1">
                        <code className="text-xs bg-background px-2 py-0.5 rounded">{acc.email}</code>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(acc.email)}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">كلمة المرور:</span>
                      <div className="flex items-center gap-1">
                        <code className="text-xs bg-background px-2 py-0.5 rounded">{acc.password}</code>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(acc.password)}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <Button
                    className="w-full gap-2"
                    variant="outline"
                    disabled={!seeded || loggingIn !== null}
                    onClick={() => handleLogin(acc.email, acc.password, acc.loginPath)}
                  >
                    {loggingIn === acc.email ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <LogIn className="w-4 h-4" />
                    )}
                    دخول كـ {acc.role}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Instructions */}
        <div className="mt-10 bg-muted/30 rounded-xl p-6 border">
          <h3 className="font-heading font-bold text-lg mb-4">📋 كيف تجرب مع فريقك؟</h3>
          <ol className="space-y-3 text-sm text-muted-foreground list-decimal list-inside">
            <li>اضغط <strong>"إنشاء الحسابات"</strong> أعلاه</li>
            <li>أرسل رابط المنصة وبيانات الدخول لكل صديق حسب دوره</li>
            <li><strong>العميل</strong> يدخل وينشئ صفقة جديدة ببيانات تجريبية</li>
            <li><strong>المدير</strong> يشاهد الصفقة ويشغّل وكلاء AI (بحث، تفاوض، عقد)</li>
            <li><strong>المفتش</strong> واللوجستيك والجودة يستلمون مهامهم تلقائياً</li>
            <li>تابعوا سير العمل الكامل من كل لوحة! 🎉</li>
          </ol>
        </div>

        <div className="text-center mt-8 mb-12">
          <Button variant="ghost" onClick={() => navigate("/")} className="text-muted-foreground">
            ← العودة للصفحة الرئيسية
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DemoPage;
