import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, User, Lock } from "lucide-react";
import { toast } from "sonner";

const InspectorSettings = () => {
  const { user } = useAuth();
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const updateName = async () => {
    if (!fullName.trim()) {
      toast.error("الاسم مطلوب");
      return;
    }
    setSavingName(true);
    const { error } = await supabase.auth.updateUser({ data: { full_name: fullName.trim() } });
    if (error) {
      toast.error("حدث خطأ أثناء تحديث الاسم");
    } else {
      await supabase.from("profiles").update({ full_name: fullName.trim() }).eq("user_id", user!.id);
      toast.success("تم تحديث الاسم بنجاح");
    }
    setSavingName(false);
  };

  const updatePassword = async () => {
    if (newPassword.length < 8) {
      toast.error("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("كلمتا المرور غير متطابقتين");
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast.error("حدث خطأ أثناء تحديث كلمة المرور");
    } else {
      toast.success("تم تحديث كلمة المرور بنجاح");
      setNewPassword("");
      setConfirmPassword("");
    }
    setSavingPassword(false);
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-7 h-7 text-primary" />
        <h1 className="font-heading text-2xl font-bold">الإعدادات</h1>
      </div>

      <div className="space-y-6 max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="w-5 h-5" />
              تغيير الاسم
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>الاسم الكامل</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={100} />
            </div>
            <Button onClick={updateName} disabled={savingName}>
              {savingName ? "جارٍ الحفظ..." : "حفظ الاسم"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lock className="w-5 h-5" />
              تغيير كلمة المرور
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>كلمة المرور الجديدة</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} />
            </div>
            <div>
              <Label>تأكيد كلمة المرور</Label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} />
            </div>
            <Button onClick={updatePassword} disabled={savingPassword}>
              {savingPassword ? "جارٍ الحفظ..." : "تحديث كلمة المرور"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default InspectorSettings;
