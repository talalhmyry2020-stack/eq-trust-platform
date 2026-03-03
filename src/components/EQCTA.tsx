import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft } from "lucide-react";

const EQCTA = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <section id="cta" className="py-36 md:py-44 relative overflow-hidden bg-background">
      {/* Mesh background */}
      <div className="absolute inset-0 bg-mesh pointer-events-none" />

      {/* Decorative circles */}
      <div className="absolute top-10 right-10 w-64 h-64 rounded-full bg-[hsl(var(--ein-teal)/0.06)] blur-3xl" />
      <div className="absolute bottom-10 left-10 w-80 h-80 rounded-full bg-[hsl(var(--ein-purple)/0.06)] blur-3xl" />

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
          انضم إلى منصة EI N اليوم، واكتشف كيف تُبنى الثقة رقمياً
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          {user ? (
            <p className="font-heading font-bold text-primary text-xl">
              أنت مسجّل بالفعل ✨
            </p>
          ) : (
            <>
              <button
                onClick={() => navigate("/auth")}
                className="bg-brand-gradient text-primary-foreground font-heading font-bold text-lg md:text-xl px-12 py-5 rounded-2xl hover:scale-105 hover:shadow-brand-lg transition-all duration-300 inline-flex items-center gap-2"
              >
                أنشئ حسابك مجاناً
                <ArrowLeft size={20} />
              </button>
              <p className="font-body text-muted-foreground text-sm mt-5">
                لا يحتاج بطاقة ائتمان • إعداد خلال 5 دقائق
              </p>
            </>
          )}
        </motion.div>
      </div>
    </section>
  );
};

export default EQCTA;