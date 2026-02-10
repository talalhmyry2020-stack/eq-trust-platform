import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, ArrowRight, Loader2, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import VerificationDialog from "@/components/VerificationDialog";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState("");
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
          if (error.message.includes("Invalid login credentials")) {
            throw new Error("البريد الإلكتروني أو كلمة المرور غير صحيحة");
          }
          if (error.message.includes("Email not confirmed")) {
            throw new Error("يرجى تأكيد بريدك الإلكتروني أولاً قبل تسجيل الدخول");
          }
          throw new Error(error.message);
        }
        toast({ title: "تم تسجيل الدخول بنجاح", description: "مرحباً بعودتك!" });

        // Check role and redirect accordingly
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", signInData.user.id);

        const userRoles = (roles || []).map((r) => r.role);
        if (userRoles.includes("admin")) {
          navigate("/admin");
        } else {
          navigate("/client");
        }
      } else {
        const { data: signUpData, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName.trim() },
          },
        });
        if (error) {
          if (error.message.includes("already registered")) {
            throw new Error("هذا البريد الإلكتروني مسجل بالفعل");
          }
          throw new Error(error.message);
        }
        toast({
          title: "تم إنشاء الحساب بنجاح! 🎉",
          description: "تم إرسال رسالة تأكيد إلى بريدك الإلكتروني. يرجى التحقق منها لتفعيل حسابك.",
        });

        // Send webhook to n8n
        try {
          await supabase.functions.invoke("send-verification", {
            body: { email: email.trim(), full_name: fullName.trim(), password, user_id: signUpData?.user?.id },
          });
        } catch (webhookErr) {
          console.error("Webhook error:", webhookErr);
        }

        setVerifiedEmail(email.trim());
        setShowVerification(true);
        setIsLogin(true);
        setPassword("");
        setConfirmPassword("");
        setFullName("");
      }
    } catch (err: any) {
      toast({
        title: "خطأ",
        description: err.message,
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
          {/* Full Name - signup only */}
          {!isLogin && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="relative"
            >
              <User
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                size={18}
              />
              <input
                type="text"
                required={!isLogin}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="الاسم الكامل"
                maxLength={100}
                className="w-full bg-secondary border border-primary/10 rounded-xl py-4 pr-12 pl-4 font-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 transition-colors"
              />
            </motion.div>
          )}

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
              maxLength={255}
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
              placeholder="كلمة المرور (8 أحرف على الأقل)"
              minLength={8}
              className="w-full bg-secondary border border-primary/10 rounded-xl py-4 pr-12 pl-4 font-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 transition-colors"
            />
          </div>

          {/* Confirm Password - signup only */}
          {!isLogin && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="relative"
            >
              <Lock
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                size={18}
              />
              <input
                type="password"
                required={!isLogin}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="تأكيد كلمة المرور"
                minLength={8}
                className="w-full bg-secondary border border-primary/10 rounded-xl py-4 pr-12 pl-4 font-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 transition-colors"
              />
            </motion.div>
          )}

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

        {/* Info text for signup */}
        {!isLogin && (
          <p className="text-center mt-4 font-body text-muted-foreground text-xs">
            سيتم إرسال رسالة تأكيد إلى بريدك الإلكتروني لتفعيل حسابك
          </p>
        )}

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
      <VerificationDialog
        open={showVerification}
        onClose={() => setShowVerification(false)}
        email={verifiedEmail}
      />
    </div>
  );
};

export default Auth;
