import { motion } from "framer-motion";
import { Monitor, Scale, Eye } from "lucide-react";

const cards = [
  {
    icon: Monitor,
    title: "منصة ذكية",
    subtitle: "رقمية بالكامل",
    text: "لا ورق، لا تأخير، لا مجال للخطأ البشري",
  },
  {
    icon: Scale,
    title: "قرارات مبنية على بيانات",
    subtitle: "حوكمة آلية",
    text: "نظام يحكم ويوثق ويحفظ الحقوق تلقائياً",
  },
  {
    icon: Eye,
    title: "رؤية واضحة",
    subtitle: "شفافة",
    text: "كل خطوة موثقة، كل قرار قابل للتدقيق",
  },
];

const EQAbout = () => {
  return (
    <section id="about" className="py-28 md:py-32 bg-secondary">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="font-body text-primary text-sm tracking-wider mb-4 block">
            EQ ليست مجرد وسيط
          </span>
          <h2 className="font-heading font-bold text-3xl md:text-5xl text-foreground mb-6">
            نحن الحلقة الذكية في التجارة
          </h2>
          <p className="font-body text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
            EQ ليست شركة نقل تقليدية، ولا وسيطاً يعتمد على العلاقات الشخصية.
            نحن منصة رقمية متقدمة تجمع بين الحوكمة الآلية والتوثيق الدقيق،
            لنضمن حقوق جميع الأطراف بشفافية تامة.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {cards.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
              className="group bg-card border border-primary/10 rounded-2xl p-8 hover:-translate-y-2 hover:shadow-gold transition-all duration-300"
            >
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                <card.icon className="text-primary" size={28} />
              </div>
              <span className="font-body text-primary text-xs tracking-wider mb-2 block">
                {card.subtitle}
              </span>
              <h3 className="font-heading font-bold text-xl text-foreground mb-3">
                {card.title}
              </h3>
              <p className="font-body text-muted-foreground leading-relaxed">
                {card.text}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default EQAbout;
