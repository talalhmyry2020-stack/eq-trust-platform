import { useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Loader2, X } from "lucide-react";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface VerificationDialogProps {
  open: boolean;
  onClose: () => void;
  email: string;
}

const VerificationDialog = ({ open, onClose, email }: VerificationDialogProps) => {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  if (!open) return null;

  const handleVerify = async () => {
    if (code.length !== 6) {
      toast({ title: "خطأ", description: "يرجى إدخال رمز التحقق المكون من 6 أرقام", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-code", {
        body: { email, code },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || "فشل التحقق");
      }

      toast({ title: "تم التحقق بنجاح! ✅", description: "يمكنك الآن تسجيل الدخول" });
      setCode("");
      onClose();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-secondary border border-primary/10 rounded-2xl p-8 max-w-sm w-full mx-4 text-center"
        dir="rtl"
      >
        <button
          onClick={() => { setCode(""); onClose(); }}
          className="absolute top-3 left-3 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
        >
          <X size={16} />
        </button>

        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.1 }}
          className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4"
        >
          <ShieldCheck className="text-primary" size={32} />
        </motion.div>

        <h2 className="font-heading font-bold text-xl text-foreground mb-2">
          أدخل رمز التحقق
        </h2>
        <p className="font-body text-muted-foreground text-sm mb-6">
          تم إرسال رمز مكون من 6 أرقام إلى{" "}
          <span className="text-primary font-bold">{email}</span>
        </p>

        <div className="flex justify-center mb-6" dir="ltr">
          <InputOTP maxLength={6} value={code} onChange={setCode}>
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>

        <button
          onClick={handleVerify}
          disabled={loading || code.length !== 6}
          className="w-full bg-primary text-primary-foreground font-heading font-bold py-3 rounded-xl hover:shadow-gold transition-all duration-300 disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="animate-spin" size={20} /> : "تأكيد الرمز"}
        </button>
      </motion.div>
    </div>
  );
};

export default VerificationDialog;
