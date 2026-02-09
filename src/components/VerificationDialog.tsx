import { motion } from "framer-motion";
import { MailCheck, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface VerificationDialogProps {
  open: boolean;
  onClose: () => void;
  email: string;
}

const VerificationDialog = ({ open, onClose, email }: VerificationDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-secondary border-primary/10 max-w-sm text-center" dir="rtl">
        <DialogHeader className="items-center gap-2">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.1 }}
            className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto"
          >
            <MailCheck className="text-primary" size={32} />
          </motion.div>
          <DialogTitle className="font-heading text-xl text-foreground">
            تحقق من بريدك الإلكتروني
          </DialogTitle>
          <DialogDescription className="font-body text-muted-foreground text-sm leading-relaxed">
            تم إرسال رسالة تأكيد إلى{" "}
            <span className="text-primary font-bold">{email}</span>
            <br />
            يرجى فتح بريدك الإلكتروني والضغط على رابط التأكيد لتفعيل حسابك.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-primary/5 rounded-xl p-4 mt-2">
          <p className="font-body text-muted-foreground text-xs leading-relaxed">
            💡 إذا لم تجد الرسالة، تحقق من مجلد البريد العشوائي (Spam)
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-primary text-primary-foreground font-heading font-bold py-3 rounded-xl hover:shadow-gold transition-all duration-300 mt-2"
        >
          فهمت، سأتحقق من بريدي
        </button>
      </DialogContent>
    </Dialog>
  );
};

export default VerificationDialog;
