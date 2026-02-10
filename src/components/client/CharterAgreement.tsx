import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, Scale, Timer, FileCheck } from "lucide-react";

interface CharterAgreementProps {
  onAgree: () => void;
  onCancel: () => void;
}

const articles = [
  {
    id: "identity",
    title: "المادة (1): شرط الهوية وصحة البيانات",
    body: "يقرّ العميل بصحة ودقة جميع البيانات والمستندات المقدمة عبر المنصة. وأي تعارض أو تضليل يكتشفه النظام تقنيًا يترتب عليه تعليق الملف تلقائيًا حتى تصحيح البيانات، دون الحاجة لإشعار بشري.",
    effect: "محاولة رفع بيانات غير متطابقة ⟶ تعليق الملف آليًا.",
    label: "أقر بصحة بياناتي وأفهم أن أي تعارض تقني سيؤدي لتعليق ملفي آلياً.",
    icon: Scale,
  },
  {
    id: "sovereignty",
    title: "المادة (2): شرط السيادة الإجرائية للنظام",
    body: "يوافق العميل على أن إدارة الوقت، الانتقال بين المراحل، التجميد، الإغلاق، أو الاستمرار تتم آليًا داخل نطاق منصة EI ووفق بروتوكولاتها التشغيلية المعلنة، دون تدخل بشري مباشر.",
    effect: "لا توجد آلية طلب استثناء؛ جميع الأزرار والمسارات محكومة بالكود.",
    label: "أوافق على خضوع إجراءاتي لسلطة الكود البرمجي وأقر بعدم وجود استثناءات بشرية.",
    icon: Scale,
  },
  {
    id: "evidence",
    title: "المادة (3): شرط حجية الأدلة الرقمية",
    body: 'يقرّ العميل بأن الأدلة الرقمية المعتمدة داخل المنصة (السجلات الزمنية، الصور، الفيديوهات، والتقارير النظامية) تُعد المرجع الفني الأول عند النزاع. ولا يُعتد بأي ادعاءات أو تفاهمات غير موثقة داخل النظام.',
    effect: 'زر "فتح نزاع" لا يُفعّل دون إرفاق أدلة رقمية.',
    label: "أقر بأن الأدلة الرقمية الموثقة في النظام هي المرجع الوحيد والملزم عند النزاع.",
    icon: FileCheck,
  },
  {
    id: "timing",
    title: "المادة (4): شرط الالتزام الزمني ومسارات الحسم",
    body: "يقرّ العميل بأن النوافذ الزمنية المحددة لكل مرحلة تُعد جزءًا جوهريًا من منطق النظام. ويُعد الصمت حتى انتهاء المهلة تفعيلًا تلقائيًا للمسار البرمجي المقرر مسبقاً (إغلاق، تجميد، أو انتقال)، بما يتوافق مع طبيعة المرحلة القائمة.",
    effect: "انتهاء العداد ⟶ تنفيذ المسار المحدد لتلك المرحلة (إغلاق الصفقة أو الانتقال للمرحلة التالية).",
    label: "أوافق على أن انقضاء العداد السيادي هو تفعيل تلقائي للمسار المقرر برمجياً.",
    icon: Timer,
    timerNote: '"حالة النظام: العداد السيادي (168:00:00) ⟶ الصمت = تنفيذ المسار آلياً."\n⏳ قانون الوقت | العداد السيادي.',
  },
  {
    id: "dispute",
    title: "المادة (5): شرط مسار النزاع الداخلي",
    body: 'يلتزم العميل باستنفاد مسارات النزاع الداخلية المعتمدة داخل منصة EI قبل أي تصعيد خارجي، مع الإقرار بأن مخرجات النظام تُستخدم كمرجع فني في أي إجراء لاحق. ويقر العميل بأن مخرجات التحكيم التقني للمنصة نهائية وغير قابلة للطعن قضائياً.',
    effect: "لا يُغلق الملف أو يُستكمل دون المرور بمسار النزاع عند تفعيله.",
    label: "ألتزم باستنفاد مسارات الحسم الداخلية للنظام قبل أي إجراء خارج المنصة.",
    icon: Scale,
  },
  {
    id: "liability",
    title: "المادة (6): حدود مسؤولية المنصة",
    body: "يقرّ العميل بأن منصة EI ليست بائعًا ولا مشتريًا ولا ضامنًا تجاريًا، ولا تظهر كطرف في أي صفقة أو نزاع. تنحصر مسؤوليتها في تنفيذ البروتوكولات التشغيلية وحفظ الأدلة وفق ما هو معلن داخل النظام.",
    effect: "عدم إظهار المنصة كطرف في أي واجهة نزاع أو صفقة.",
    label: "أقر بأن المنصة حاكم إجرائي فقط وليست طرفاً أو ضامناً في تعاملاتي التجارية.",
    icon: Scale,
  },
  {
    id: "documentation",
    title: "المادة (7): شرط التوثيق والشفافية",
    body: "يوافق العميل على تسجيل وتوثيق جميع مراحل الصفقة داخل المنصة لأغراض الحماية والحوكمة وإدارة المخاطر. ويُعد هذا التوثيق ملزمًا ضمن نطاق النظام.",
    effect: "مركز الأدلة للعرض فقط (Read-only) لضمان عدم التلاعب.",
    label: "أوافق على التوثيق الرقمي الكامل لجميع مراحلي وأقر بحجيته الملزمة.",
    icon: FileCheck,
  },
  {
    id: "signature",
    title: "المادة (8): القبول والتوقيع الإلكتروني",
    body: 'يُعد ضغط العميل على زر "أوافق وأوقّع إلكترونيًا" توقيعًا قانونيًا ملزمًا وغير قابل للإنكار داخل نطاق المنصة، ويترتب عليه تفعيل المسارات التشغيلية اللاحقة.',
    effect: "بدون توقيع ⟶ النظام مغلق. مع التوقيع ⟶ فتح جميع المسارات المصرح بها.",
    label: "أقر بأن توقيعي الإلكتروني هو موافقة نهائية تمنح النظام السيادة الكاملة لتنفيذ المسارات البرمجية وحفظ الحقوق آلياً.",
    icon: Shield,
  },
];

const CharterAgreement = ({ onAgree, onCancel }: CharterAgreementProps) => {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const allChecked = articles.every((a) => checked[a.id]);

  const toggle = (id: string) =>
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col" dir="rtl">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-5 text-center space-y-3">
        <div className="flex items-center justify-center gap-2">
          <Shield className="h-7 w-7 text-primary" />
          <h1 className="font-heading text-2xl font-bold text-foreground">
            🛡️ بوابة العهد
          </h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
          الشروط القانونية والتشغيلية لانضمام العميل إلى منصة EI
        </p>
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 max-w-2xl mx-auto">
          <p className="text-sm font-medium text-primary leading-relaxed">
            أنت الآن أمام ميثاق السيادة الرقمية. كل بند تقره هو التزام برمجي غير
            قابل للتراجع. النظام بانتظار توقيعك لفتح مسارات العبور.
          </p>
        </div>
      </div>

      {/* Preamble + Articles */}
      <ScrollArea className="flex-1">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
          {/* Preamble */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              <h2 className="font-heading text-lg font-bold text-foreground">
                الديباجة
              </h2>
            </div>
            <blockquote className="border-r-4 border-primary pr-4 text-sm text-muted-foreground italic leading-relaxed">
              "في EI، لا نبيع خدمات — بل نمنح سيادة تقنية. بتوقيعك على العهد
              وتفعيل العداد، تقر بأن القانون البرمجي للمنصة هو المرجع الإجرائي
              الوحيد لحفظ حقوقك."
            </blockquote>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="bg-accent/50 rounded-lg p-3">
                <span className="font-semibold text-foreground">حقك:</span>{" "}
                <span className="text-muted-foreground">
                  حماية أموالك وبضاعتك بنسبة 100% عبر حوكمة التوكنات.
                </span>
              </div>
              <div className="bg-accent/50 rounded-lg p-3">
                <span className="font-semibold text-foreground">واجبك:</span>{" "}
                <span className="text-muted-foreground">
                  الانضباط التام بالمواعيد، والاعتراف بتقارير الوكلاء كحقيقة
                  إجرائية مطلقة.
                </span>
              </div>
            </div>
          </div>

          {/* Articles */}
          {articles.map((article) => {
            const Icon = article.icon;
            return (
              <div
                key={article.id}
                className="bg-card border border-border rounded-xl p-5 space-y-4"
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5 text-primary shrink-0" />
                  <h3 className="font-heading text-base font-bold text-foreground">
                    {article.title}
                  </h3>
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed">
                  {article.body}
                </p>

                {article.timerNote && (
                  <div className="bg-accent/50 border border-accent rounded-lg p-3 flex items-start gap-2">
                    <Timer className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground whitespace-pre-line">
                      {article.timerNote}
                    </p>
                  </div>
                )}

                <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3">
                  <p className="text-xs text-destructive font-medium">
                    الأثر التشغيلي: {article.effect}
                  </p>
                </div>

                <label className="flex items-start gap-3 cursor-pointer bg-primary/5 border border-primary/20 rounded-lg p-3 hover:bg-primary/10 transition-colors">
                  <Checkbox
                    checked={!!checked[article.id]}
                    onCheckedChange={() => toggle(article.id)}
                    className="mt-0.5"
                  />
                  <span className="text-sm font-medium text-foreground leading-relaxed">
                    {article.label}
                  </span>
                </label>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t border-border bg-card px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3 justify-between">
          <Button variant="outline" onClick={onCancel}>
            إلغاء
          </Button>
          <Button
            onClick={onAgree}
            disabled={!allChecked}
            className="min-w-[200px]"
          >
            <Shield className="h-4 w-4 ml-2" />
            أوافق وأوقّع إلكترونيًا
          </Button>
        </div>
        {!allChecked && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            يجب الموافقة على جميع البنود ({Object.values(checked).filter(Boolean).length}/{articles.length})
          </p>
        )}
      </div>
    </div>
  );
};

export default CharterAgreement;
