import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Save, Lock, CheckCircle, XCircle } from "lucide-react";

const ClientAccount = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [emailConfirmed, setEmailConfirmed] = useState(false);

  useEffect(() => {
    if (!user) return;
    setEmailConfirmed(!!user.email_confirmed_at);
    supabase.from("profiles").select("full_name").eq("user_id", user.id).single().then(({ data }) => {
      if (data) setFullName(data.full_name);
    });
  }, [user]);

  const handleSaveName = async () => {
    if (!user || !fullName.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: fullName.trim() }).eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast({ title: "خطأ", description: "فشل تحديث الاسم", variant: "destructive" });
    } else {
      toast({ title: "تم التحديث", description: "تم حفظ الاسم بنجاح" });
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      toast({ title: "خطأ", description: "كلمة المرور يجب أن تكون 8 أحرف على الأقل", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "خطأ", description: "كلمتا المرور غير متطابقتين", variant: "destructive" });
      return;
    }
    setSavingPw(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPw(false);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "تم التحديث", description: "تم تغيير كلمة المرور بنجاح" });
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="font-heading text-2xl font-bold mb-6">حسابي</h1>

      <div className="space-y-6">
        {/* Email & Verification */}
        <Card>
          <CardHeader><CardTitle className="font-heading text-lg">البريد الإلكتروني</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-between">
            <span className="font-mono text-sm">{user?.email}</span>
            <Badge variant={emailConfirmed ? "default" : "destructive"} className="gap-1">
              {emailConfirmed ? <><CheckCircle className="w-3 h-3" /> مفعّل</> : <><XCircle className="w-3 h-3" /> غير مفعّل</>}
            </Badge>
          </CardContent>
        </Card>

        {/* Name */}
        <Card>
          <CardHeader><CardTitle className="font-heading text-lg">الاسم الكامل</CardTitle></CardHeader>
          <CardContent className="flex gap-3">
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="الاسم الكامل" className="flex-1" />
            <Button onClick={handleSaveName} disabled={saving}>
              <Save className="w-4 h-4 ml-2" />
              {saving ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </CardContent>
        </Card>

        {/* Password */}
        <Card>
          <CardHeader><CardTitle className="font-heading text-lg flex items-center gap-2"><Lock className="w-5 h-5" /> تغيير كلمة المرور</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="كلمة المرور الجديدة (8 أحرف على الأقل)" />
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="تأكيد كلمة المرور" />
            <Button onClick={handleChangePassword} disabled={savingPw} className="w-full">
              {savingPw ? "جاري التحديث..." : "تحديث كلمة المرور"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ClientAccount;
