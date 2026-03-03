import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, ArrowRight, Loader2, User, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const validateForm = (): string | null => {
    if (!email.trim() || !password.trim()) return "جميع الحقول إجبارية";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "صيغة البريد الإلكتروني غير صحيحة";
    if (password.length < 8) return "كلمة المرور يجب أن تكون 8 أحرف على الأقل";
    if (!isLogin) {
      if (!fullName.trim()) return "الاسم الكامل مطلوب";
      if (fullName.trim().length > 100) return "الاسم يجب أن يكون أقل من 100 حرف";
      if (password !== confirmPassword) return "كلمتا المرور غير متطابقتين";
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const error = validateForm();
    if (error) {
      toast({ title: "خطأ في المدخلات", description: error, variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      if (isLogin) {
        const { data: signInData, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) {
          if (error.message.includes("Invalid login credentials")) throw new Error("البريد الإلكتروني أو كلمة المرور غير صحيحة");
          if (error.message.includes("Email not confirmed")) throw new Error("يرجى تأكيد بريدك الإلكتروني أولاً قبل تسجيل الدخول");
          throw new Error(error.message);
        }
        toast({ title: "تم تسجيل الدخول بنجاح", description: "مرحباً بعودتك!" });
        const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", signInData.user.id);
        const userRoles = (roles || []).map((r) => r.role);
        if (userRoles.includes("admin")) {
          navigate("/admin");
        } else if (userRoles.includes("employee")) {
          const { data: empDetails } = await supabase.from("employee_details").select("job_code").eq("user_id", signInData.user.id).single();
          const jobCode = empDetails?.job_code || "";
          if (jobCode === "logistics" || jobCode === "agent_07") navigate("/logistics");
          else if (jobCode === "customs_agent") navigate("/admin/port-clearance");
          else if (jobCode === "quality_agent") navigate("/quality");
          else if (jobCode === "agent_06") navigate("/inspector");
          else navigate("/inspector");
        } else {
          navigate("/client");
        }
      } else {
        const { data: signUpData, error } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { data: { full_name: fullName.trim() } },
        });
        if (error) {
          if (error.message.includes("already registered")) throw new Error("هذا البريد الإلكتروني مسجل بالفعل");
          throw new Error(error.message);
        }
        if (signUpData?.user?.identities?.length === 0) throw new Error("هذا البريد الإلكتروني مسجل بالفعل");
        if (signUpData?.user?.id) {
          await supabase.from("profiles").update({ is_active: true }).eq("user_id", signUpData.user.id);
        }
        toast({ title: "تم إنشاء الحساب بنجاح! 🎉", description: "مرحباً بك في المنصة" });
        navigate("/client");
      }
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full bg-card border border-border rounded-2xl py-4 pr-12 pl-4 font-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all duration-300";

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-background relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute inset-0 bg-mesh" />
      <div className="absolute top-20 left-20 w-72 h-72 rounded-full bg-primary/5 blur-3xl animate-blob" />
      <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-accent/5 blur-3xl animate-blob" style={{ animationDelay: "2s" }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-ein-coral/3 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <motion.div 
          className="text-center mb-10"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-brand-gradient flex items-center justify-center shadow-brand">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="font-heading font-bold text-foreground text-3xl">EI</span>
          </div>
          <p className="font-body text-muted-foreground text-lg">
            {isLogin ? "سجّل دخولك للمتابعة" : "أنشئ حسابك الآن"}
          </p>
        </motion.div>

        {/* Card */}
        <motion.div 
          className="bg-card/80 backdrop-blur-xl rounded-3xl border border-border/50 p-8 shadow-brand-lg"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          {/* Tabs */}
          <div className="flex bg-muted rounded-2xl p-1.5 mb-8">
            {[
              { key: true, label: "تسجيل الدخول" },
              { key: false, label: "إنشاء حساب" },
            ].map((tab) => (
              <button
                key={String(tab.key)}
                onClick={() => setIsLogin(tab.key)}
                className={`flex-1 py-3 rounded-xl font-heading font-bold text-sm transition-all duration-300 ${
                  isLogin === tab.key
                    ? "bg-brand-gradient text-white shadow-brand"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="relative"
              >
                <User className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/50" size={18} />
                <input type="text" required={!isLogin} value={fullName} onChange={(e) => setFullName(e.target.value)}
                  placeholder="الاسم الكامل" maxLength={100} className={inputClass} />
              </motion.div>
            )}

            <div className="relative">
              <Mail className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/50" size={18} />
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="البريد الإلكتروني" maxLength={255} className={inputClass} />
            </div>

            <div className="relative">
              <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/50" size={18} />
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="كلمة المرور (8 أحرف على الأقل)" minLength={8} className={inputClass} />
            </div>

            {!isLogin && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="relative"
              >
                <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/50" size={18} />
                <input type="password" required={!isLogin} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="تأكيد كلمة المرور" minLength={8} className={inputClass} />
              </motion.div>
            )}

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full bg-brand-gradient text-white font-heading font-bold text-lg py-4 rounded-2xl shadow-brand hover:shadow-brand-lg transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-60 mt-6"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  {isLogin ? "تسجيل الدخول" : "إنشاء حساب"}
                  <ArrowRight size={18} />
                </>
              )}
            </motion.button>
          </form>
        </motion.div>

        {/* Back link */}
        <motion.div 
          className="text-center mt-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <button
            onClick={() => navigate("/")}
            className="font-body text-muted-foreground text-sm hover:text-primary transition-colors"
          >
            العودة للرئيسية
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Auth;

