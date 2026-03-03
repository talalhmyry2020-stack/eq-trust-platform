import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Vault, Upload, CheckCircle, XCircle, Clock, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "قيد المراجعة", variant: "secondary" },
  approved: { label: "تمت الموافقة", variant: "default" },
  rejected: { label: "مرفوض", variant: "destructive" },
};

const ClientTreasuryPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [receiptNumber, setReceiptNumber] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // جلب الصفقات التي تحتاج إيداع (العقد موقع بالكامل)
  const { data: dealsNeedingDeposit = [] } = useQuery({
    queryKey: ["deals-needing-deposit", user?.id],
    queryFn: async () => {
      const { data: contracts } = await supabase
        .from("deal_contracts")
        .select("deal_id, total_amount, currency, status, platform_fee_percentage")
        .eq("status", "signed");

      if (!contracts?.length) return [];

      const dealIds = contracts.map((c) => c.deal_id);
      const { data: deals } = await supabase
        .from("deals")
        .select("id, title, deal_number, client_id")
        .eq("client_id", user!.id)
        .in("id", dealIds);

      return (deals || []).map((d) => {
        const contract = contracts.find((c) => c.deal_id === d.id);
        const productAmount = contract?.total_amount || 0;
        const feePercent = contract?.platform_fee_percentage || 7;
        const feeAmount = productAmount * feePercent / 100;
        const grandTotal = productAmount + feeAmount;
        return {
          ...d,
          product_amount: productAmount,
          fee_percentage: feePercent,
          fee_amount: feeAmount,
          grand_total: grandTotal,
          currency: contract?.currency,
        };
      });
    },
    enabled: !!user,
  });

  // جلب الإيداعات السابقة
  const { data: deposits = [] } = useQuery({
    queryKey: ["my-deposits", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("deal_deposits")
        .select("*, deals(title, deal_number)")
        .eq("client_id", user!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const submitDeposit = useMutation({
    mutationFn: async () => {
      if (!selectedDealId || !receiptFile || !receiptNumber) throw new Error("Missing fields");
      setUploading(true);

      const deal = dealsNeedingDeposit.find((d) => d.id === selectedDealId);
      if (!deal) throw new Error("Deal not found");

      // رفع صورة السند
      const filePath = `${user!.id}/${selectedDealId}/${Date.now()}_${receiptFile.name}`;
      const { error: uploadErr } = await supabase.storage
        .from("deposit-receipts")
        .upload(filePath, receiptFile);
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from("deposit-receipts")
        .getPublicUrl(filePath);

      // إنشاء سجل الإيداع
      const { error } = await supabase.from("deal_deposits").insert({
        deal_id: selectedDealId,
        client_id: user!.id,
        amount: deal.grand_total || 0,
        currency: deal.currency || "USD",
        receipt_image_url: urlData.publicUrl,
        receipt_number: receiptNumber,
      });
      if (error) throw error;

      // تحديث مرحلة الصفقة
      await supabase.from("deals").update({ current_phase: "deposit_pending" }).eq("id", selectedDealId);
    },
    onSuccess: () => {
      toast({ title: "تم إرسال سند الإيداع بنجاح", description: "سيتم مراجعته من قبل الإدارة المالية" });
      setSelectedDealId(null);
      setReceiptNumber("");
      setReceiptFile(null);
      setUploading(false);
      queryClient.invalidateQueries({ queryKey: ["my-deposits"] });
      queryClient.invalidateQueries({ queryKey: ["deals-needing-deposit"] });
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
      setUploading(false);
    },
  });

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Vault className="w-7 h-7 text-primary" />
        <h1 className="font-heading text-2xl font-bold">الخزينة</h1>
      </div>

      {/* صفقات تحتاج إيداع */}
      {dealsNeedingDeposit.length > 0 && (
        <Card className="mb-6 border-amber-500/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              صفقات بانتظار الإيداع
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dealsNeedingDeposit.map((deal) => (
              <div key={deal.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 border rounded-lg bg-muted/30">
                <div className="space-y-1 min-w-0">
                  <p className="font-medium text-sm md:text-base">صفقة #{deal.deal_number} — {deal.title}</p>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    💰 قيمة الصفقة: {deal.product_amount?.toLocaleString()} {deal.currency}
                  </p>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    📊 عمولة المنصة ({deal.fee_percentage}%): {deal.fee_amount?.toLocaleString()} {deal.currency}
                  </p>
                  <p className="text-xs md:text-sm font-bold text-primary">
                    💵 الإجمالي المطلوب: {deal.grand_total?.toLocaleString()} {deal.currency}
                  </p>
                </div>
                <Button onClick={() => setSelectedDealId(deal.id)} size="sm" className="self-start md:self-center shrink-0">
                  <Upload className="w-4 h-4 ml-2" />
                  إيداع
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* نموذج الإيداع */}
      {selectedDealId && (
        <Card className="mb-6 border-primary/30">
          <CardHeader>
            <CardTitle className="text-lg">رفع سند الإيداع</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>رقم السند / المرجع البنكي</Label>
              <Input
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                placeholder="أدخل رقم السند البنكي..."
                className="mt-1"
              />
            </div>
            <div>
              <Label>صورة سند الإيداع</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                className="mt-1"
              />
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => submitDeposit.mutate()}
                disabled={!receiptNumber || !receiptFile || uploading}
              >
                {uploading ? "جاري الرفع..." : "تأكيد الإيداع"}
              </Button>
              <Button variant="outline" onClick={() => setSelectedDealId(null)}>إلغاء</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* سجل الإيداعات */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">سجل الإيداعات</CardTitle>
        </CardHeader>
        <CardContent>
          {deposits.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">لا توجد إيداعات حالياً</p>
          ) : (
            <div className="space-y-3">
              {deposits.map((dep: any) => {
                const st = statusMap[dep.status] || statusMap.pending;
                return (
                  <div key={dep.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 border rounded-lg">
                    <div className="space-y-1 min-w-0">
                      <p className="font-medium text-sm">
                        صفقة #{dep.deals?.deal_number} — {dep.deals?.title}
                      </p>
                      <p className="text-xs text-muted-foreground">رقم السند: {dep.receipt_number}</p>
                      <p className="text-sm font-semibold">{dep.amount?.toLocaleString()} {dep.currency}</p>
                      {dep.status === "rejected" && dep.rejection_reason && (
                        <p className="text-xs text-destructive">سبب الرفض: {dep.rejection_reason}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 self-start md:self-center shrink-0">
                      {dep.receipt_image_url && (
                        <Button variant="ghost" size="icon" onClick={() => setPreviewUrl(dep.receipt_image_url)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      )}
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* معاينة صورة السند */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>صورة سند الإيداع</DialogTitle>
          </DialogHeader>
          {previewUrl && <img src={previewUrl} alt="سند الإيداع" className="w-full rounded-lg" />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientTreasuryPage;
