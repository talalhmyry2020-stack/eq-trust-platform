import { motion, useScroll, useTransform } from "framer-motion";
import { FileText, CheckCircle, UserPlus, Scale, Archive } from "lucide-react";
import { useRef } from "react";

const steps = [
  { icon: FileText, title: "إنشاء الطلب", text: "حدد تفاصيل المعاملة والأطراف والشروط", num: "01", color: "ein-teal" },
  { icon: CheckCircle, title: "التحقق الذكي", text: "نتحقق من البيانات وننظم الالتزامات", num: "02", color: "ein-purple" },
  { icon: UserPlus, title: "تعيين الوكيل", text: "نختار الوكيل المناسب وننسق التواصل", num: "03", color: "ein-coral" },
  { icon: Scale, title: "القرار المبني على بيانات", text: "مراجعة شاملة وقرار عادل", num: "04", color: "ein-teal" },
  { icon: Archive, title: "إغلاق ذكي", text: "أرشفة رقمية آمنة وسجل كامل للرجوع إليه", num: "05", color: "ein-purple" },
];

const EQProcess = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const lineWidth = useTransform(scrollYProgress, [0.1, 0.7], ["0%", "100%"]);

  return (
    <section
      id="process"
      ref={sectionRef}
      className="py-28 md:py-32 bg-background relative"
    >
      <div className="absolute inset-0 bg-mesh pointer-events-none" />

      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <span className="font-body text-primary text-sm tracking-wider mb-4 block font-bold">
            رحلة طلبك في EI N
          </span>
          <h2 className="font-heading font-bold text-3xl md:text-5xl text-foreground mb-6">
            خمس خطوات، تجربة واحدة سلسة
          </h2>
          <p className="font-body text-muted-foreground text-lg max-w-2xl mx-auto">
            من إنشاء الطلب إلى الأرشفة الرقمية، كل مرحلة مصممة للشفافية والسرعة
          </p>
        </motion.div>

        {/* Desktop Timeline */}
        <div className="hidden lg:block relative">
          <div className="absolute top-16 right-0 left-0 h-0.5 bg-border">
            <motion.div
              className="h-full bg-brand-gradient origin-right rounded-full"
              style={{ width: lineWidth }}
            />
          </div>

          <div className="grid grid-cols-5 gap-4 relative">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: i % 2 === 0 ? -30 : 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className={`flex flex-col items-center text-center ${i % 2 === 0 ? "" : "mt-24"}`}
              >
                <div className="w-12 h-12 rounded-full bg-card border-2 border-primary flex items-center justify-center mb-4 relative z-10 shadow-sm">
                  <span className="font-mono font-bold text-primary text-sm">{step.num}</span>
                </div>
                <div className={`w-12 h-12 rounded-2xl bg-[hsl(var(--${step.color})/0.1)] flex items-center justify-center mb-3`}>
                  <step.icon className={`text-[hsl(var(--${step.color}))]`} size={22} />
                </div>
                <h3 className="font-heading font-bold text-foreground text-base mb-2">
                  {step.title}
                </h3>
                <p className="font-body text-muted-foreground text-sm leading-relaxed">
                  {step.text}
                </p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Mobile vertical timeline */}
        <div className="lg:hidden space-y-8">
          {steps.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="flex gap-5 items-start"
            >
              <div className="flex flex-col items-center shrink-0">
                <div className="w-10 h-10 rounded-full bg-card border-2 border-primary flex items-center justify-center shadow-sm">
                  <span className="font-mono font-bold text-primary text-xs">{step.num}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className="w-0.5 h-12 bg-border mt-2" />
                )}
              </div>
              <div>
                <div className={`w-10 h-10 rounded-xl bg-[hsl(var(--${step.color})/0.1)] flex items-center justify-center mb-2`}>
                  <step.icon className={`text-[hsl(var(--${step.color}))]`} size={20} />
                </div>
                <h3 className="font-heading font-bold text-foreground mb-1">{step.title}</h3>
                <p className="font-body text-muted-foreground text-sm">{step.text}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default EQProcess;