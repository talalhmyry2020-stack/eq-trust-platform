import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast({ title: "تم تسجيل الدخول بنجاح" });
        navigate("/");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast({
          title: "تم إنشاء الحساب",
          description: "يرجى التحقق من بريدك الإلكتروني لتأكيد حسابك",
        });
      }
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{
        background: "linear-gradient(180deg, hsl(0 0% 4%) 0%, hsl(240 33% 11%) 100%)",
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <span className="font-heading font-bold text-primary-foreground text-xl">E</span>
            </div>
            <span className="font-heading font-bold text-foreground text-2xl">EQ Platform</span>
          </div>
          <p className="font-body text-muted-foreground">
            {isLogin ? "سجّل دخولك للمتابعة" : "أنشئ حسابك الآن"}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex bg-secondary rounded-xl p-1 mb-8">
          {[
            { key: true, label: "تسجيل الدخول" },
            { key: false, label: "إنشاء حساب" },
          ].map((tab) => (
            <button
              key={String(tab.key)}
              onClick={() => setIsLogin(tab.key)}
              className={`flex-1 py-3 rounded-lg font-heading font-bold text-sm transition-all duration-300 ${
                isLogin === tab.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="relative">
            <Mail
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={18}
            />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="البريد الإلكتروني"
              className="w-full bg-secondary border border-primary/10 rounded-xl py-4 pr-12 pl-4 font-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 transition-colors"
            />
          </div>

          <div className="relative">
            <Lock
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={18}
            />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="كلمة المرور"
              minLength={6}
              className="w-full bg-secondary border border-primary/10 rounded-xl py-4 pr-12 pl-4 font-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground font-heading font-bold text-lg py-4 rounded-xl hover:shadow-gold hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                {isLogin ? "تسجيل الدخول" : "إنشاء حساب"}
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Back link */}
        <div className="text-center mt-6">
          <button
            onClick={() => navigate("/")}
            className="font-body text-muted-foreground text-sm hover:text-primary transition-colors"
          >
            العودة للرئيسية
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
