import { motion } from "framer-motion";
import { ChevronDown, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const FloatingShape = ({ className, delay = 0 }: { className: string; delay?: number }) => (
  <motion.div
    className={`absolute rounded-full blur-3xl opacity-30 ${className}`}
    animate={{
      y: [0, -30, 10, 0],
      x: [0, 15, -10, 0],
      scale: [1, 1.1, 0.95, 1],
    }}
    transition={{ duration: 8, repeat: Infinity, delay, ease: "easeInOut" }}
  />
);

const EQHero = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background"
    >
      {/* Animated blobs */}
      <FloatingShape className="w-[500px] h-[500px] bg-[hsl(var(--ein-teal)/0.15)] -top-20 -right-20" delay={0} />
      <FloatingShape className="w-[400px] h-[400px] bg-[hsl(var(--ein-purple)/0.12)] bottom-10 -left-20" delay={2} />
      <FloatingShape className="w-[300px] h-[300px] bg-[hsl(var(--ein-coral)/0.1)] top-1/3 left-1/3" delay={4} />

      {/* Dot pattern */}
      <div className="absolute inset-0 bg-dots opacity-40" />

      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="inline-flex items-center gap-2 bg-card border border-border rounded-full px-5 py-2 mb-8 shadow-sm"
        >
          <span className="w-2 h-2 rounded-full bg-[hsl(var(--ein-teal))] animate-pulse" />
          <span className="font-body text-muted-foreground text-sm">منصة الوساطة التجارية الذكية</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="font-heading font-extrabold text-4xl sm:text-5xl md:text-7xl leading-tight mb-6"
        >
          <span className="text-foreground">الوساطة التجارية</span>
          <br />
          <span className="text-gradient-brand">بثقة رقمية مطلقة</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="font-body text-muted-foreground text-lg md:text-xl max-w-xl mx-auto mb-10 leading-relaxed"
        >
          منصة EI تحول العمليات المعقدة إلى تجربة سلسة وشفافة.
          <br />
          الثقة تُبنى بالحوكمة والتوثيق والبيانات الدقيقة.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          {user ? (
            <button className="bg-brand-gradient text-primary-foreground font-heading font-bold text-lg px-10 py-4 rounded-2xl shadow-brand hover:shadow-brand-lg hover:-translate-y-1 transition-all duration-300">
              مرحباً بك في EI 🎉
            </button>
          ) : (
            <>
              <button
                onClick={() => navigate("/auth")}
                className="bg-brand-gradient text-primary-foreground font-heading font-bold text-lg px-10 py-4 rounded-2xl shadow-brand hover:shadow-brand-lg hover:-translate-y-1 transition-all duration-300 flex items-center gap-2"
              >
                إنشاء حساب جديد
                <ArrowLeft size={20} />
              </button>
              <button
                onClick={() => navigate("/auth")}
                className="border-2 border-border text-foreground font-heading font-bold text-lg px-10 py-4 rounded-2xl hover:bg-secondary hover:border-primary/30 transition-all duration-300"
              >
                تسجيل الدخول
              </button>
            </>
          )}
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <span className="font-body text-muted-foreground text-sm">اكتشف المزيد</span>
        <ChevronDown className="text-primary animate-bounce-slow" size={24} />
      </motion.div>
    </section>
  );
};

export default EQHero;