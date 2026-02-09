import { motion } from "framer-motion";
import { Eye, FileCheck, Settings, ShieldCheck } from "lucide-react";

const values = [
  {
    num: "01",
    title: "شفافية تامة",
    text: "لا خفايا، لا غموض. كل بيانة، كل قرار، كل خطوة موثقة ومرئية",
    icon: Eye,
    accentClass: "bg-eq-blue/10 group-hover:shadow-[0_8px_30px_hsl(217_91%_53%/0.15)]",
  },
  {
    num: "02",
    title: "توثيق دقيق",
    text: "سجل رقمي كامل لا يُمحى، يحفظ حقوقك ويمنع النزاعات",
    icon: FileCheck,
    accentClass: "bg-primary/10 group-hover:shadow-gold",
  },
  {
    num: "03",
    title: "حوكمة رقمية",
    text: "نظام آلي يحكم ويوزع ويضمن العدالة دون تدخل بشري",
    icon: Settings,
    accentClass: "bg-eq-green/10 group-hover:shadow-[0_8px_30px_hsl(142_72%_38%/0.15)]",
  },
  {
    num: "04",
    title: "مخاطر أقل",
    text: "نحدد المخاطر مبكراً ونضع ضمانات تحمي جميع الأطراف",
    icon: ShieldCheck,
    accentClass: "bg-eq-red/10 group-hover:shadow-[0_8px_30px_hsl(0_84%_50%/0.15)]",
  },
];

const EQValues = () => {
  return (
    <section id="values" className="py-28 md:py-32 bg-background bg-grid-pattern relative">
      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="font-body text-primary text-sm tracking-wider mb-4 block">
            ما نؤمن به
          </span>
          <h2 className="font-heading font-bold text-3xl md:text-5xl text-foreground">
            قيمنا، أساس ثقتك بنا
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {values.map((v, i) => (
            <motion.div
              key={v.num}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className={`group bg-card border border-primary/10 rounded-2xl p-8 hover:scale-[1.02] transition-all duration-300 ${v.accentClass}`}
            >
              <div className="flex items-start justify-between mb-6">
                <span className="font-mono text-4xl font-bold text-gradient-gold opacity-30">
                  {v.num}
                </span>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <v.icon className="text-primary" size={24} />
                </div>
              </div>
              <h3 className="font-heading font-bold text-xl text-foreground mb-3">
                {v.title}
              </h3>
              <p className="font-body text-muted-foreground leading-relaxed">
                {v.text}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default EQValues;
