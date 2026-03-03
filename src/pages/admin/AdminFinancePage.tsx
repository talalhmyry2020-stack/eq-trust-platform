import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DollarSign, CheckCircle, XCircle, Eye, Clock, Banknote, TrendingUp, Coins, Factory, TestTube, Play, MessageSquare, Send, Bot } from "lucide-react";
import { Input } from "@/components/ui/input";

const AdminFinancePage = () => {
  const queryClient = useQueryClient();
  const [reviewDeposit, setReviewDeposit] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [tokenReview, setTokenReview] = useState<any>(null);
  const [testMessage, setTestMessage] = useState("تم اكتمال الإنتاج والبضاعة جاهزة للشحن");
  const [selectedDealForMessage, setSelectedDealForMessage] = useState<string | null>(null);

  // جلب كل الإيداعات
  const { data: deposits = [] } = useQuery({
    queryKey: ["admin-deposits"],
    queryFn: async () => {
      const { data } = await supabase
        .from("deal_deposits")
        .select("*, deals(title, deal_number, client_full_name)")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // جلب التوكنات
  const { data: tokens = [] } = useQuery({
    queryKey: ["admin-tokens"],
    queryFn: async () => {
      const { data } = await supabase
        .from("deal_tokens")
        .select("*, deals(title, deal_number, client_full_name)")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // جلب الخزينة
  const { data: escrows = [] } = useQuery({
    queryKey: ["admin-escrows"],
    queryFn: async () => {
      const { data } = await supabase
        .from("deal_escrow")
        .select("*, deals(title, deal_number, client_full_name)")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // جلب رسائل الموردين
  const { data: supplierMessages = [], refetch: refetchMessages } = useQuery({
    queryKey: ["supplier-messages"],
    queryFn: async () => {
      const { data } = await supabase
        .from("supplier_messages")
        .select("*, deals(title, deal_number, client_full_name)")
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  // إرسال رسالة تجريبية من المورد
  const sendTestMessage = useMutation({
    mutationFn: async ({ dealId, message, factoryName }: { dealId: string; message: string; factoryName: string }) => {
      const { data, error } = await supabase.functions.invoke("process-supplier-message", {
        body: { deal_id: dealId, message, factory_name: factoryName, is_test: true },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (res) => {
      if (res?.is_completion_signal) {
        toast({ title: `✅ تم كشف إشارة اكتمال (ثقة: ${res.confidence}%)`, description: "تم تفعيل إجراء اكتمال الإنتاج تلقائياً" });
      } else {
        toast({ title: "📩 تم تسجيل الرسالة", description: "لم يُكتشف إشارة اكتمال في هذه الرسالة" });
      }
      refetchMessages();
      queryClient.invalidateQueries({ queryKey: ["admin-supplier-tokens"] });
      setSelectedDealForMessage(null);
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  // جلب الموردين مع بياناتهم المالية
  const { data: suppliers = [] } = useQuery({
    queryKey: ["admin-supplier-tokens"],
    queryFn: async () => {
      const { data: negotiations } = await supabase
        .from("deal_negotiations")
        .select("deal_id, factory_name, factory_country, factory_email, factory_phone")
        .eq("status", "accepted");
      if (!negotiations?.length) return [];

      const dealIds = [...new Set(negotiations.map(n => n.deal_id))];
      const [dealsRes, tokensRes, escrowRes] = await Promise.all([
        supabase.from("deals").select("id, deal_number, title, current_phase, estimated_amount").in("id", dealIds),
        supabase.from("deal_tokens").select("*").in("deal_id", dealIds).order("created_at"),
        supabase.from("deal_escrow").select("*").in("deal_id", dealIds),
      ]);

      return dealIds.map(dealId => {
        const deal = dealsRes.data?.find(d => d.id === dealId);
        const neg = negotiations.find(n => n.deal_id === dealId);
        const dealTokens = (tokensRes.data || []).filter(t => t.deal_id === dealId);
        const escrow = escrowRes.data?.find(e => e.deal_id === dealId);
        return {
          dealId,
          dealNumber: deal?.deal_number || 0,
          dealTitle: deal?.title || "",
          currentPhase: deal?.current_phase || "",
          factoryName: neg?.factory_name || "",
          factoryCountry: neg?.factory_country || "",
          tokens: dealTokens,
          escrow,
          canCreateTokenA: deal?.current_phase === "inspection_completed" && !dealTokens.some(t => t.token_type === "token_a"),
          canCreateTokenB: deal?.current_phase === "quality_approved" && !dealTokens.some(t => t.token_type === "token_b"),
        };
      }).filter(s => s.factoryName);
    },
  });

  const pendingDeposits = deposits.filter((d: any) => d.status === "pending");
  const approvedDeposits = deposits.filter((d: any) => d.status === "approved");
  const rejectedDeposits = deposits.filter((d: any) => d.status === "rejected");

  // موافقة/رفض إيداع
  const handleDepositAction = useMutation({
    mutationFn: async ({ id, action, reason }: { id: string; action: "approved" | "rejected"; reason?: string }) => {
      const updateData: any = { status: action, reviewed_at: new Date().toISOString() };
      if (action === "rejected" && reason) updateData.rejection_reason = reason;

      const { error } = await supabase.from("deal_deposits").update(updateData).eq("id", id);
      if (error) throw error;

      // إذا تمت الموافقة، حدّث الخزينة والمرحلة
      if (action === "approved") {
        const deposit = deposits.find((d: any) => d.id === id);
        if (deposit) {
          // تحديث أو إنشاء سجل الخزينة
          const { data: existing } = await supabase
            .from("deal_escrow")
            .select("*")
            .eq("deal_id", deposit.deal_id)
            .maybeSingle();

          if (existing) {
            await supabase.from("deal_escrow").update({
              total_deposited: existing.total_deposited + deposit.amount,
              balance: existing.balance + deposit.amount,
            }).eq("id", existing.id);
          } else {
            await supabase.from("deal_escrow").insert({
              deal_id: deposit.deal_id,
              total_deposited: deposit.amount,
              balance: deposit.amount,
              currency: deposit.currency,
            });
          }

          // تحديث مرحلة الصفقة مؤقتاً
          await supabase.from("deals").update({ current_phase: "deposit_approved" }).eq("id", deposit.deal_id);

          // إشعار العميل
          const { data: deal } = await supabase.from("deals").select("client_id, deal_number").eq("id", deposit.deal_id).single();
          if (deal?.client_id) {
            await supabase.from("notifications").insert({
              user_id: deal.client_id,
              title: "تمت الموافقة على الإيداع",
              message: `تمت الموافقة على إيداعك لصفقة #${deal.deal_number}. سيتم تعيين مفتش ميداني آلياً.`,
              type: "finance",
              entity_type: "deal",
              entity_id: deposit.deal_id,
            });
          }

          // تعيين المفتش الميداني آلياً
          try {
            await supabase.functions.invoke("process-post-inspection", {
              body: { deal_id: deposit.deal_id, action: "auto_assign_inspector" },
            });
          } catch (e) {
            console.error("Auto-assign inspector error:", e);
          }
        }
      }

      if (action === "rejected") {
        const deposit = deposits.find((d: any) => d.id === id);
        if (deposit) {
          await supabase.from("deals").update({ current_phase: "deposit_rejected" }).eq("id", deposit.deal_id);
          const { data: deal } = await supabase.from("deals").select("client_id, deal_number").eq("id", deposit.deal_id).single();
          if (deal?.client_id) {
            await supabase.from("notifications").insert({
              user_id: deal.client_id,
              title: "تم رفض الإيداع",
              message: `تم رفض إيداعك لصفقة #${deal.deal_number}. السبب: ${reason}`,
              type: "finance",
              entity_type: "deal",
              entity_id: deposit.deal_id,
            });
          }
        }
      }
    },
    onSuccess: () => {
      toast({ title: "تم تحديث حالة الإيداع" });
      setReviewDeposit(null);
      setRejectionReason("");
      queryClient.invalidateQueries({ queryKey: ["admin-deposits"] });
      queryClient.invalidateQueries({ queryKey: ["admin-escrows"] });
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  // موافقة/رفض توكن
  const handleTokenAction = useMutation({
    mutationFn: async ({ id, action, reason }: { id: string; action: "approved" | "rejected"; reason?: string }) => {
      const updateData: any = { status: action };
      if (action === "approved") {
        updateData.approved_at = new Date().toISOString();
        updateData.status = "released";
        updateData.released_at = new Date().toISOString();
      }
      if (action === "rejected" && reason) updateData.rejection_reason = reason;

      const { error } = await supabase.from("deal_tokens").update(updateData).eq("id", id);
      if (error) throw error;

      // خصم من الخزينة
      if (action === "approved") {
        const token = tokens.find((t: any) => t.id === id);
        if (token) {
          const { data: escrow } = await supabase
            .from("deal_escrow")
            .select("*")
            .eq("deal_id", token.deal_id)
            .single();

          if (escrow) {
            await supabase.from("deal_escrow").update({
              total_released: escrow.total_released + token.amount,
              balance: escrow.balance - token.amount,
            }).eq("id", escrow.id);
          }
        }
      }
    },
    onSuccess: () => {
      toast({ title: "تم تحديث التوكن" });
      setTokenReview(null);
      setRejectionReason("");
      queryClient.invalidateQueries({ queryKey: ["admin-tokens"] });
      queryClient.invalidateQueries({ queryKey: ["admin-escrows"] });
    },
  });

  const totalDeposited = escrows.reduce((s: number, e: any) => s + (e.total_deposited || 0), 0);
  const totalReleased = escrows.reduce((s: number, e: any) => s + (e.total_released || 0), 0);
  const totalBalance = escrows.reduce((s: number, e: any) => s + (e.balance || 0), 0);

  // صرف توكن تلقائي (تجريبي)
  const autoDisburse = useMutation({
    mutationFn: async ({ dealId, action }: { dealId: string; action: string }) => {
      const { data: res, error } = await supabase.functions.invoke("process-post-inspection", {
        body: { deal_id: dealId, action },
      });
      if (error) throw error;
      return res;
    },
    onSuccess: (res) => {
      toast({ title: "✅ " + (res?.message || "تم بنجاح") });
      queryClient.invalidateQueries({ queryKey: ["admin-tokens"] });
      queryClient.invalidateQueries({ queryKey: ["admin-escrows"] });
      queryClient.invalidateQueries({ queryKey: ["admin-supplier-tokens"] });
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const renderDepositCard = (dep: any) => (
    <div key={dep.id} className="flex items-center justify-between p-4 border rounded-lg">
      <div className="space-y-1">
        <p className="font-medium">صفقة #{dep.deals?.deal_number} — {dep.deals?.title}</p>
        <p className="text-sm text-muted-foreground">العميل: {dep.deals?.client_full_name}</p>
        <p className="text-sm">رقم السند: <span className="font-mono">{dep.receipt_number}</span></p>
        <p className="text-sm font-bold text-primary">{dep.amount?.toLocaleString()} {dep.currency}</p>
        {dep.rejection_reason && <p className="text-sm text-destructive">سبب الرفض: {dep.rejection_reason}</p>}
      </div>
      <div className="flex items-center gap-2">
        {dep.receipt_image_url && (
          <Button variant="ghost" size="icon" onClick={() => setPreviewUrl(dep.receipt_image_url)}>
            <Eye className="w-4 h-4" />
          </Button>
        )}
        {dep.status === "pending" && (
          <Button size="sm" onClick={() => setReviewDeposit(dep)}>مراجعة</Button>
        )}
        <Badge variant={dep.status === "approved" ? "default" : dep.status === "rejected" ? "destructive" : "secondary"}>
          {dep.status === "approved" ? "موافق" : dep.status === "rejected" ? "مرفوض" : "معلق"}
        </Badge>
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <DollarSign className="w-7 h-7 text-primary" />
        <h1 className="font-heading text-2xl font-bold">المالية</h1>
      </div>

      {/* ملخص مالي */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4 text-center">
            <Clock className="w-6 h-6 text-amber-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">{pendingDeposits.length}</p>
            <p className="text-sm text-muted-foreground">إيداعات معلقة</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Banknote className="w-6 h-6 text-green-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">{totalDeposited.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">إجمالي الإيداعات</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <TrendingUp className="w-6 h-6 text-blue-500 mx-auto mb-2" />
            <p className="text-2xl font-bold">{totalReleased.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">إجمالي المصروف</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Coins className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold">{totalBalance.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">الرصيد المتبقي</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="suppliers" dir="rtl">
        <TabsList className="flex-wrap">
          <TabsTrigger value="suppliers">الموردون ({suppliers.length})</TabsTrigger>
          <TabsTrigger value="messages">📩 رسائل الموردين ({supplierMessages.length})</TabsTrigger>
          <TabsTrigger value="pending">معلقة ({pendingDeposits.length})</TabsTrigger>
          <TabsTrigger value="approved">موافق عليها ({approvedDeposits.length})</TabsTrigger>
          <TabsTrigger value="rejected">مرفوضة ({rejectedDeposits.length})</TabsTrigger>
          <TabsTrigger value="tokens">التوكنات ({tokens.length})</TabsTrigger>
          <TabsTrigger value="escrow">الخزينة ({escrows.length})</TabsTrigger>
        </TabsList>

        {/* تبويب الموردون — صرف التوكنات */}
        <TabsContent value="suppliers" className="space-y-4 mt-4">
          {suppliers.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">لا يوجد موردون بعقود مفعّلة</p>
          ) : suppliers.map((s: any) => (
            <Card key={s.dealId}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Factory className="w-5 h-5 text-primary" />
                    <div>
                      <CardTitle className="text-base">{s.factoryName}</CardTitle>
                      <p className="text-xs text-muted-foreground">{s.factoryCountry} · صفقة #{s.dealNumber} — {s.dealTitle}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">{s.currentPhase}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* التوكنات الحالية */}
                {s.tokens.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {s.tokens.map((t: any) => (
                      <div key={t.id} className="border rounded-lg p-3 text-sm">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-medium">
                            {t.token_type === "token_a" ? "توكن A — 30%" : t.token_type === "token_b" ? "توكن B — 50%" : t.token_type === "token_c" ? "توكن C — 20%" : t.token_type}
                          </span>
                          <Badge variant={t.status === "released" || t.status === "approved" ? "default" : t.status === "rejected" ? "destructive" : "secondary"} className="text-xs">
                            {t.status === "released" ? "مصروف ✓" : t.status === "approved" ? "معتمد ✓" : t.status === "pending" ? "معلّق" : t.status}
                          </Badge>
                        </div>
                        <p className="text-lg font-bold text-primary">{Number(t.amount).toLocaleString()} {t.currency}</p>
                        {t.status === "pending" && (
                          <div className="flex gap-2 mt-2">
                            <Button size="sm" className="flex-1" onClick={() => setTokenReview(t)}>
                              <CheckCircle className="w-3 h-3 ml-1" />
                              رسمي: اعتماد
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* رصيد الخزينة */}
                {s.escrow && (
                  <div className="border rounded-lg p-3 bg-muted/20">
                    <div className="grid grid-cols-3 gap-2 text-sm text-center">
                      <div>
                        <p className="text-muted-foreground text-xs">المودع</p>
                        <p className="font-bold">{Number(s.escrow.total_deposited).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">المصروف للمورد</p>
                        <p className="font-bold text-destructive">{Number(s.escrow.total_released).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">المتبقي</p>
                        <p className="font-bold text-primary">{Number(s.escrow.balance).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* أزرار الصرف */}
                <div className="flex gap-2 flex-wrap">
                  {s.canCreateTokenA && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-yellow-500/50 text-yellow-600 hover:bg-yellow-500/10"
                        onClick={() => autoDisburse.mutate({ dealId: s.dealId, action: "test_auto_token_a" })}
                        disabled={autoDisburse.isPending}
                      >
                        <TestTube className="w-3 h-3 ml-1" />
                        🧪 تجريبي: صرف 30% للمورد
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => autoDisburse.mutate({ dealId: s.dealId, action: "create_token_a" })}
                        disabled={autoDisburse.isPending}
                      >
                        <Play className="w-3 h-3 ml-1" />
                        رسمي: إنشاء توكن A
                      </Button>
                    </>
                  )}
                  {s.canCreateTokenB && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-yellow-500/50 text-yellow-600 hover:bg-yellow-500/10"
                        onClick={() => autoDisburse.mutate({ dealId: s.dealId, action: "quality_approved" })}
                        disabled={autoDisburse.isPending}
                      >
                        <TestTube className="w-3 h-3 ml-1" />
                        🧪 تجريبي: صرف 50% للمورد
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* تبويب رسائل الموردين */}
        <TabsContent value="messages" className="space-y-4 mt-4">
          {/* إرسال رسالة تجريبية */}
          <Card className="border-dashed border-2 border-amber-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TestTube className="w-4 h-4 text-amber-500" />
                🧪 محاكاة رسالة مورد (تجريبي)
              </CardTitle>
              <p className="text-xs text-muted-foreground">اختر صفقة واكتب رسالة لمحاكاة ما يرسله المصنع. النظام سيحلل الرسالة تلقائياً.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* اختيار الصفقة */}
              <div className="flex flex-wrap gap-2">
                {suppliers.map((s: any) => (
                  <Button
                    key={s.dealId}
                    size="sm"
                    variant={selectedDealForMessage === s.dealId ? "default" : "outline"}
                    onClick={() => setSelectedDealForMessage(s.dealId)}
                  >
                    <Factory className="w-3 h-3 ml-1" />
                    #{s.dealNumber} — {s.factoryName}
                  </Button>
                ))}
              </div>

              {selectedDealForMessage && (
                <div className="flex gap-2">
                  <Input
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    placeholder="اكتب رسالة المورد..."
                    className="flex-1"
                    dir="rtl"
                  />
                  <Button
                    onClick={() => {
                      const supplier = suppliers.find((s: any) => s.dealId === selectedDealForMessage);
                      sendTestMessage.mutate({
                        dealId: selectedDealForMessage,
                        message: testMessage,
                        factoryName: supplier?.factoryName || "",
                      });
                    }}
                    disabled={sendTestMessage.isPending || !testMessage.trim()}
                  >
                    <Send className="w-4 h-4 ml-1" />
                    إرسال
                  </Button>
                </div>
              )}

              {/* أمثلة سريعة */}
              {selectedDealForMessage && (
                <div className="flex flex-wrap gap-1">
                  <span className="text-xs text-muted-foreground">أمثلة:</span>
                  {["تم اكتمال الإنتاج والبضاعة جاهزة للشحن", "production completed, ready to ship", "نحتاج مزيد من الوقت لإنهاء الطلبية", "الطلبية جاهزة للفحص"].map((ex) => (
                    <button
                      key={ex}
                      className="text-xs px-2 py-0.5 rounded-full border hover:bg-muted transition-colors"
                      onClick={() => setTestMessage(ex)}
                    >
                      {ex.substring(0, 30)}...
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* سجل الرسائل */}
          {supplierMessages.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">لا توجد رسائل من الموردين بعد</p>
          ) : supplierMessages.map((msg: any) => (
            <Card key={msg.id} className={msg.is_completion_signal ? "border-green-500/30 bg-green-500/5" : ""}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${msg.is_completion_signal ? "bg-green-500/20 text-green-600" : "bg-muted"}`}>
                      {msg.sender_type === "system" ? <Bot className="w-4 h-4" /> : <Factory className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{msg.factory_name || "مورد"}</span>
                        <span className="text-xs text-muted-foreground">· صفقة #{msg.deals?.deal_number}</span>
                        {msg.sender_type === "system" && <Badge variant="outline" className="text-[10px]">🧪 تجريبي</Badge>}
                      </div>
                      <p className="text-sm">{msg.message}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(msg.created_at).toLocaleString("ar-SA")}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {msg.is_completion_signal ? (
                      <>
                        <Badge variant="default" className="text-[10px]">✅ اكتمال مكتشف</Badge>
                        <span className="text-[10px] text-muted-foreground">ثقة: {msg.detection_confidence}%</span>
                      </>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">رسالة عادية</Badge>
                    )}
                    {msg.auto_action_taken && (
                      <Badge variant="outline" className="text-[10px] text-green-600">⚡ {msg.auto_action_taken}</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="pending" className="space-y-3 mt-4">
          {pendingDeposits.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">لا توجد إيداعات معلقة</p>
          ) : pendingDeposits.map(renderDepositCard)}
        </TabsContent>

        <TabsContent value="approved" className="space-y-3 mt-4">
          {approvedDeposits.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">لا توجد إيداعات موافق عليها</p>
          ) : approvedDeposits.map(renderDepositCard)}
        </TabsContent>

        <TabsContent value="rejected" className="space-y-3 mt-4">
          {rejectedDeposits.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">لا توجد إيداعات مرفوضة</p>
          ) : rejectedDeposits.map(renderDepositCard)}
        </TabsContent>

        <TabsContent value="tokens" className="space-y-3 mt-4">
          {tokens.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">لا توجد توكنات حالياً</p>
          ) : tokens.map((t: any) => (
            <div key={t.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <p className="font-medium">صفقة #{t.deals?.deal_number} — {t.token_type?.toUpperCase()}</p>
                <p className="text-sm text-muted-foreground">{t.percentage}% — {t.amount?.toLocaleString()} {t.currency}</p>
              </div>
              <div className="flex items-center gap-2">
                {t.status === "pending" && (
                  <Button size="sm" onClick={() => setTokenReview(t)}>مراجعة</Button>
                )}
                <Badge variant={t.status === "released" ? "default" : t.status === "rejected" ? "destructive" : "secondary"}>
                  {t.status === "released" ? "تم الصرف" : t.status === "rejected" ? "مرفوض" : t.status === "approved" ? "موافق" : "معلق"}
                </Badge>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="escrow" className="space-y-3 mt-4">
          {escrows.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">لا توجد خزائن نشطة</p>
          ) : escrows.map((e: any) => (
            <div key={e.id} className="p-4 border rounded-lg">
              <p className="font-medium mb-2">صفقة #{e.deals?.deal_number} — {e.deals?.title}</p>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-lg font-bold text-green-500">{e.total_deposited?.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">مودع</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-blue-500">{e.total_released?.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">مصروف</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-primary">{e.balance?.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">متبقي</p>
                </div>
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>

      {/* مراجعة إيداع */}
      <Dialog open={!!reviewDeposit} onOpenChange={() => { setReviewDeposit(null); setRejectionReason(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>مراجعة الإيداع</DialogTitle>
          </DialogHeader>
          {reviewDeposit && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <p>صفقة #{reviewDeposit.deals?.deal_number}</p>
                <p>المبلغ: <span className="font-bold">{reviewDeposit.amount?.toLocaleString()} {reviewDeposit.currency}</span></p>
                <p>رقم السند: <span className="font-mono">{reviewDeposit.receipt_number}</span></p>
              </div>
              {reviewDeposit.receipt_image_url && (
                <img src={reviewDeposit.receipt_image_url} alt="سند" className="w-full rounded-lg border" />
              )}
              <Textarea
                placeholder="سبب الرفض (اختياري)..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="destructive"
              onClick={() => handleDepositAction.mutate({ id: reviewDeposit.id, action: "rejected", reason: rejectionReason })}
              disabled={handleDepositAction.isPending}
            >
              <XCircle className="w-4 h-4 ml-2" />
              رفض
            </Button>
            <Button
              onClick={() => handleDepositAction.mutate({ id: reviewDeposit.id, action: "approved" })}
              disabled={handleDepositAction.isPending}
            >
              <CheckCircle className="w-4 h-4 ml-2" />
              موافقة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* مراجعة توكن */}
      <Dialog open={!!tokenReview} onOpenChange={() => { setTokenReview(null); setRejectionReason(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>مراجعة التوكن</DialogTitle>
          </DialogHeader>
          {tokenReview && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <p>صفقة #{tokenReview.deals?.deal_number}</p>
                <p>النوع: <span className="font-bold">{tokenReview.token_type?.toUpperCase()}</span></p>
                <p>المبلغ: <span className="font-bold">{tokenReview.amount?.toLocaleString()} {tokenReview.currency}</span></p>
                <p>النسبة: {tokenReview.percentage}%</p>
              </div>
              <Textarea
                placeholder="سبب الرفض (اختياري)..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="destructive"
              onClick={() => handleTokenAction.mutate({ id: tokenReview.id, action: "rejected", reason: rejectionReason })}
            >
              رفض
            </Button>
            <Button onClick={() => handleTokenAction.mutate({ id: tokenReview.id, action: "approved" })}>
              موافقة وصرف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* معاينة صورة */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>صورة السند</DialogTitle></DialogHeader>
          {previewUrl && <img src={previewUrl} alt="سند" className="w-full rounded-lg" />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminFinancePage;
