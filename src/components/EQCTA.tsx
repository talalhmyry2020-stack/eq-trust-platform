import { motion } from "framer-motion";

const EQCTA = () => {
  return (
    <section
      id="cta"
      className="py-36 md:py-44 relative overflow-hidden"
      style={{
        background: "linear-gradient(180deg, hsl(0 0% 6%) 0%, hsl(0 0% 4%) 100%)",
      }}
    >
      {/* Radial gold glow */}
      <div className="absolute inset-0 bg-radial-gold pointer-events-none" />

      <div className="container mx-auto px-6 relative z-10 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="font-heading font-bold text-3xl md:text-5xl lg:text-6xl text-foreground mb-6"
        >
          جاهز لتجربة الوساطة الذكية؟
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="font-body text-muted-foreground text-lg md:text-xl mb-10 max-w-lg mx-auto"
        >
          انضم إلى منصة EQ اليوم، واكتشف كيف تُبنى الثقة رقمياً
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <button className="bg-primary text-primary-foreground font-heading font-bold text-lg md:text-xl px-12 py-5 rounded-xl hover:scale-105 hover:shadow-gold-lg transition-all duration-300">
            ابدأ أول طلب مجاناً
          </button>
          <p className="font-body text-muted-foreground text-sm mt-5">
            لا يحتاج بطاقة ائتمان • إعداد خلال 5 دقائق
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default EQCTA;
