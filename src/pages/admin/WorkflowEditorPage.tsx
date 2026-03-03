import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import {
  Workflow, UserPlus, FileCheck, Search, Factory, Handshake, FileText, DollarSign,
  Camera, CheckCircle, Truck, Ship, Anchor, Timer, ArrowDown, Edit, Plus, Trash2,
  Save, X, GripVertical, TestTube, ShieldCheck, Package, Eye, Bot, User
} from "lucide-react";

interface WorkflowStep {
  id: string;
  phase: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  actor: "client" | "admin" | "system" | "inspector" | "quality" | "logistics";
  automated: boolean;
  tokenRelated?: string;
  editable: boolean;
}

const ICON_MAP: Record<string, any> = {
  UserPlus, FileCheck, Search, Factory, Handshake, FileText, DollarSign,
  Camera, CheckCircle, Truck, Ship, Anchor, Timer, Package, ShieldCheck,
  TestTube, Bot, User, Eye, Edit, Workflow
};

const ACTOR_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  client: { label: "العميل", color: "bg-blue-500/10 text-blue-700 border-blue-500/30", icon: User },
  admin: { label: "المدير", color: "bg-purple-500/10 text-purple-700 border-purple-500/30", icon: ShieldCheck },
  system: { label: "النظام (آلي)", color: "bg-green-500/10 text-green-700 border-green-500/30", icon: Bot },
  inspector: { label: "المفتش الميداني", color: "bg-orange-500/10 text-orange-700 border-orange-500/30", icon: Camera },
  quality: { label: "وكيل الجودة", color: "bg-cyan-500/10 text-cyan-700 border-cyan-500/30", icon: CheckCircle },
  logistics: { label: "اللوجستيك", color: "bg-indigo-500/10 text-indigo-700 border-indigo-500/30", icon: Truck },
};

const DEFAULT_STEPS: WorkflowStep[] = [
  {
    id: "1", phase: "registration", label: "تسجيل العميل والتحقق",
    description: "العميل يسجل حسابه ويتم تأكيد البريد الإلكتروني تلقائياً. يتم إنشاء ملف تعريف في قاعدة البيانات مع دور 'عميل'.",
    icon: "UserPlus", color: "text-blue-500", actor: "client", automated: true, editable: true
  },
  {
    id: "2", phase: "deal_creation", label: "إنشاء الصفقة",
    description: "العميل يملأ نموذج الصفقة: نوع المنتج، الوصف، بلد الاستيراد، المستندات (الهوية، السجل التجاري). الحالات تعرض بالعربية.",
    icon: "FileText", color: "text-blue-600", actor: "client", automated: false, editable: true
  },
  {
    id: "3", phase: "verification", label: "التأهيل الآلي (وكيل التأهيل)",
    description: "وكيل التأهيل الذكي يفحص المستندات عبر OCR ويتحقق من صحة البيانات. المدير لديه صلاحية تجاوز يدوي في حال رفض الوكيل.",
    icon: "FileCheck", color: "text-yellow-600", actor: "system", automated: true, editable: true
  },
  {
    id: "4", phase: "product_search", label: "البحث الآلي عن المنتجات",
    description: "وكيل البحث (Tavily + Gemini) يبحث في الإنترنت عن أفضل المصانع والموردين حسب نوع المنتج والمواصفات المطلوبة.",
    icon: "Search", color: "text-green-500", actor: "system", automated: true, editable: true
  },
  {
    id: "5", phase: "product_selection", label: "الاختيار الآلي لأفضل 3-5 مصانع",
    description: "الذكاء الاصطناعي (Gemini) يحلل النتائج ويختار أفضل 3-5 مصانع بناءً على: توفر بيانات الاتصال، تقييم الجودة، الشهادات، السعر.",
    icon: "Factory", color: "text-green-600", actor: "system", automated: true, editable: true
  },
  {
    id: "6", phase: "negotiation", label: "التفاوض مع المصانع (المرحلة 1)",
    description: "وكيل التفاوض يرسل رسائل للمصانع المختارة عبر البريد الإلكتروني يطلب عروض أسعار. يتم تسجيل الردود وتحديث حالة كل مصنع.",
    icon: "Handshake", color: "text-orange-500", actor: "system", automated: true, editable: true
  },
  {
    id: "7", phase: "client_selection", label: "العميل يختار العروض",
    description: "العميل يراجع العروض (بدون كشف هوية المصانع) ويختار عرضين بحد أقصى مع تحديد الكمية ووحدة القياس. تنتقل الصفقة للتفاوض النهائي.",
    icon: "Eye", color: "text-blue-500", actor: "client", automated: false, editable: true
  },
  {
    id: "8", phase: "negotiation_phase2", label: "التفاوض النهائي (المرحلة 2 و 3)",
    description: "التفاوض النهائي على السعر والكمية المحددة. يتم إرسال العرض النهائي للمصنع للموافقة. عند موافقة المصنع تنتقل لمرحلة العقد.",
    icon: "Handshake", color: "text-orange-600", actor: "system", automated: true, editable: true
  },
  {
    id: "9", phase: "contract_drafting", label: "صياغة العقد الآلية",
    description: "الذكاء الاصطناعي يصيغ العقد تلقائياً بناءً على تفاصيل الصفقة. يتضمن شروط الدفع (30%+50%+20%)، نوع الشحن، العمولة، وميثاق السيادة.",
    icon: "FileText", color: "text-purple-500", actor: "system", automated: true, editable: true
  },
  {
    id: "10", phase: "contract_approval", label: "الموافقة الثلاثية على العقد",
    description: "العقد يمر بموافقة ثلاثية: 1) العميل يراجع ويوقع بـ OTP، 2) المدير يعتمد، 3) المصنع يوافق. العميل يمكنه الاعتراض وإعادة التعديل.",
    icon: "CheckCircle", color: "text-purple-600", actor: "client", automated: false, editable: true
  },
  {
    id: "11", phase: "deposit", label: "الإيداع المالي",
    description: "العميل يرفع سند الإيداع البنكي (LC أو تحويل) مع صورة واضحة. يعرض النظام تفصيل: مبلغ المنتج + عمولة المنصة = الإجمالي المطلوب.",
    icon: "DollarSign", color: "text-green-500", actor: "client", automated: false, editable: true
  },
  {
    id: "12", phase: "deposit_approval", label: "اعتماد الإيداع",
    description: "وكيل المالية يراجع السند ويطابقه. المدير يعتمد الإيداع نهائياً. يتم تغذية حساب الضمان (Escrow) بالمبلغ المودع.",
    icon: "ShieldCheck", color: "text-green-600", actor: "admin", automated: false, editable: true
  },
  {
    id: "13", phase: "auto_inspector_assign", label: "تعيين المفتش الميداني آلياً",
    description: "فور اعتماد الإيداع، النظام يعين المفتش الميداني آلياً حسب بلد المصنع. يتم تحديد الموقع الجغرافي (Geocoding) وإنشاء المهمة تلقائياً.",
    icon: "Camera", color: "text-orange-500", actor: "system", automated: true, editable: true
  },
  {
    id: "14", phase: "token_a", label: "صرف التوكن A (30%)",
    description: "المدير يصرف التوكن A يدوياً بنسبة 30% من صافي مبلغ العقد لبدء الإنتاج. يتم خصم المبلغ من حساب الضمان وتحويله للمصنع.",
    icon: "DollarSign", color: "text-yellow-500", actor: "admin", automated: false, tokenRelated: "token_a", editable: true
  },
  {
    id: "15", phase: "factory_production", label: "المصنع يعمل على الإنتاج",
    description: "المصنع يبدأ الإنتاج بعد استلام التوكن A. النظام يراقب رسائل المصنع ويكشف تلقائياً إشارات اكتمال الإنتاج عبر الذكاء الاصطناعي.",
    icon: "Factory", color: "text-orange-500", actor: "system", automated: true, editable: true
  },
  {
    id: "16", phase: "quality_inspection", label: "فحص الجودة",
    description: "النظام يكلف وكيل الجودة آلياً (حسب بلد المصنع) فور اكتمال التصنيع. المفتش يفحص المنتج ويرفع تقرير مفصل مع صور.",
    icon: "CheckCircle", color: "text-cyan-500", actor: "quality", automated: true, editable: true
  },
  {
    id: "17", phase: "logistics_source", label: "تعيين موظف لوجستيك (بلد المصنع)",
    description: "النظام يعين موظف لوجستيك آلياً في بلد المصنع. يتولى توثيق: تحميل البضاعة، مغادرة المصنع، الوصول لميناء التصدير.",
    icon: "Truck", color: "text-indigo-500", actor: "system", automated: true, editable: true
  },
  {
    id: "18", phase: "token_b", label: "صرف التوكن B (50%) — آلي",
    description: "يُصرف التوكن B آلياً (50% من صافي العقد) عند وصول البضاعة لميناء التصدير وتوثيق بوليصة الشحن (BOL) من موظف اللوجستيك.",
    icon: "DollarSign", color: "text-green-500", actor: "system", automated: true, tokenRelated: "token_b", editable: true
  },
  {
    id: "19", phase: "shipping", label: "الشحن البحري",
    description: "البضاعة في البحر. يتم تتبع الشحنة عبر رابط التتبع المرفق. المراحل: تحميل → مغادرة المصنع → ميناء التصدير → في البحر → ميناء الوجهة.",
    icon: "Ship", color: "text-blue-600", actor: "logistics", automated: false, editable: true
  },
  {
    id: "20", phase: "destination_logistics", label: "تعيين موظف لوجستيك (بلد المقصد)",
    description: "النظام يعين موظف لوجستيك آلياً في بلد المقصد. يتولى فحص الوصول وتأكيد سلامة البضاعة في ميناء الوجهة.",
    icon: "Anchor", color: "text-cyan-600", actor: "system", automated: true, editable: true
  },
  {
    id: "21", phase: "sovereignty_timer", label: "العداد السيادي (168 ساعة)",
    description: "يبدأ العداد فور تأكيد موظف اللوجستيك سلامة البضاعة. 168 ساعة (7 أيام) مهلة للعميل للاعتراض. إيقاف العداد عند رفع اعتراض.",
    icon: "Timer", color: "text-red-500", actor: "system", automated: true, editable: true
  },
  {
    id: "22", phase: "token_c", label: "صرف التوكن C (20%) — آلي + إغلاق",
    description: "بعد انقضاء 168 ساعة بدون اعتراض: يتم استقطاع عمولة المنصة (3%/5%/7%) → صرف التوكن C (20%) للمورد → تصفير الضمان → إغلاق الصفقة.",
    icon: "CheckCircle", color: "text-green-700", actor: "system", automated: true, tokenRelated: "token_c", editable: true
  },
];

const WorkflowEditorPage = () => {
  const [steps, setSteps] = useState<WorkflowStep[]>(DEFAULT_STEPS);
  const [editingStep, setEditingStep] = useState<WorkflowStep | null>(null);
  const [addDialog, setAddDialog] = useState<{ afterId: string } | null>(null);
  const [newStep, setNewStep] = useState<Partial<WorkflowStep>>({
    label: "", description: "", icon: "Workflow", color: "text-primary",
    actor: "system", automated: false, phase: "", editable: true
  });
  const [hasChanges, setHasChanges] = useState(false);

  const updateStep = useCallback((id: string, updates: Partial<WorkflowStep>) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    setHasChanges(true);
  }, []);

  const deleteStep = useCallback((id: string) => {
    setSteps(prev => prev.filter(s => s.id !== id));
    setHasChanges(true);
    toast({ title: "تم حذف المرحلة" });
  }, []);

  const addStepAfter = useCallback((afterId: string) => {
    if (!newStep.label || !newStep.phase) {
      toast({ title: "يرجى ملء الحقول المطلوبة", variant: "destructive" });
      return;
    }
    const newId = `custom_${Date.now()}`;
    const step: WorkflowStep = {
      id: newId,
      phase: newStep.phase!,
      label: newStep.label!,
      description: newStep.description || "",
      icon: newStep.icon || "Workflow",
      color: newStep.color || "text-primary",
      actor: (newStep.actor as any) || "system",
      automated: newStep.automated || false,
      editable: true,
    };
    setSteps(prev => {
      const idx = prev.findIndex(s => s.id === afterId);
      const arr = [...prev];
      arr.splice(idx + 1, 0, step);
      return arr;
    });
    setAddDialog(null);
    setNewStep({ label: "", description: "", icon: "Workflow", color: "text-primary", actor: "system", automated: false, phase: "", editable: true });
    setHasChanges(true);
    toast({ title: "✅ تمت إضافة المرحلة الجديدة" });
  }, [newStep]);

  const moveStep = useCallback((id: string, direction: "up" | "down") => {
    setSteps(prev => {
      const idx = prev.findIndex(s => s.id === id);
      if ((direction === "up" && idx === 0) || (direction === "down" && idx === prev.length - 1)) return prev;
      const arr = [...prev];
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      [arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]];
      return arr;
    });
    setHasChanges(true);
  }, []);

  const saveWorkflow = () => {
    // Could persist to system_settings in DB
    toast({ title: "✅ تم حفظ سير العمل بنجاح" });
    setHasChanges(false);
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Workflow className="w-7 h-7 text-primary" />
          <div>
            <h1 className="font-heading text-2xl font-bold">محرر سير العمل الكامل</h1>
            <p className="text-sm text-muted-foreground">من تسجيل العميل إلى صرف آخر توكن — {steps.length} مرحلة</p>
          </div>
        </div>
        {hasChanges && (
          <Button onClick={saveWorkflow} className="gap-2">
            <Save className="w-4 h-4" />
            حفظ التعديلات
          </Button>
        )}
      </div>

      {/* Legend */}
      <Card className="mb-6">
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap gap-3">
            {Object.entries(ACTOR_LABELS).map(([key, val]) => {
              const Icon = val.icon;
              return (
                <Badge key={key} variant="outline" className={`${val.color} border text-xs gap-1`}>
                  <Icon className="w-3 h-3" />
                  {val.label}
                </Badge>
              );
            })}
            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 border-yellow-500/30 text-xs gap-1">
              <DollarSign className="w-3 h-3" />
              توكن مالي
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Workflow Steps */}
      <div className="space-y-0">
        {steps.map((step, idx) => {
          const StepIcon = ICON_MAP[step.icon] || Workflow;
          const actorInfo = ACTOR_LABELS[step.actor];
          const ActorIcon = actorInfo?.icon || User;
          const isEditing = editingStep?.id === step.id;

          return (
            <div key={step.id}>
              {/* Step Card */}
              <Card className={`relative transition-all hover:shadow-md ${step.tokenRelated ? "border-yellow-500/40 bg-yellow-500/5" : ""} ${isEditing ? "ring-2 ring-primary" : ""}`}>
                <CardContent className="py-4 px-5">
                  <div className="flex gap-4">
                    {/* Step Number & Icon */}
                    <div className="flex flex-col items-center gap-1 min-w-[48px]">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${step.automated ? "bg-green-500/10" : "bg-muted"}`}>
                        <StepIcon className={`w-5 h-5 ${step.color}`} />
                      </div>
                      <span className="text-xs font-mono text-muted-foreground">{idx + 1}</span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        /* Edit Mode */
                        <div className="space-y-3">
                          <Input
                            value={editingStep.label}
                            onChange={e => setEditingStep({ ...editingStep, label: e.target.value })}
                            className="font-bold"
                            placeholder="اسم المرحلة"
                          />
                          <Textarea
                            value={editingStep.description}
                            onChange={e => setEditingStep({ ...editingStep, description: e.target.value })}
                            rows={3}
                            placeholder="وصف المرحلة"
                          />
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">المسؤول</label>
                              <Select value={editingStep.actor} onValueChange={v => setEditingStep({ ...editingStep, actor: v as any })}>
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(ACTOR_LABELS).map(([k, v]) => (
                                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">الأيقونة</label>
                              <Select value={editingStep.icon} onValueChange={v => setEditingStep({ ...editingStep, icon: v })}>
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.keys(ICON_MAP).map(k => (
                                    <SelectItem key={k} value={k}>{k}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">معرف المرحلة</label>
                              <Input
                                value={editingStep.phase}
                                onChange={e => setEditingStep({ ...editingStep, phase: e.target.value })}
                                className="h-8 text-xs font-mono"
                              />
                            </div>
                            <div className="flex items-end gap-2">
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={editingStep.automated}
                                  onCheckedChange={v => setEditingStep({ ...editingStep, automated: v })}
                                />
                                <span className="text-xs">آلي</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 justify-end">
                            <Button size="sm" variant="outline" onClick={() => setEditingStep(null)}>
                              <X className="w-3 h-3 ml-1" /> إلغاء
                            </Button>
                            <Button size="sm" onClick={() => {
                              updateStep(step.id, editingStep);
                              setEditingStep(null);
                            }}>
                              <Save className="w-3 h-3 ml-1" /> حفظ
                            </Button>
                          </div>
                        </div>
                      ) : (
                        /* View Mode */
                        <>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-bold text-sm leading-tight">{step.label}</h3>
                              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{step.description}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingStep({ ...step })}>
                                <Edit className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => moveStep(step.id, "up")} disabled={idx === 0}>
                                <ArrowDown className="w-3.5 h-3.5 rotate-180" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => moveStep(step.id, "down")} disabled={idx === steps.length - 1}>
                                <ArrowDown className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteStep(step.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className={`${actorInfo?.color} border text-[10px] gap-1`}>
                              <ActorIcon className="w-2.5 h-2.5" />
                              {actorInfo?.label}
                            </Badge>
                            {step.automated && (
                              <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/30 text-[10px] gap-1">
                                <Bot className="w-2.5 h-2.5" />
                                آلي
                              </Badge>
                            )}
                            {step.tokenRelated && (
                              <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 border-yellow-500/30 text-[10px] gap-1">
                                <DollarSign className="w-2.5 h-2.5" />
                                {step.tokenRelated === "token_a" ? "30%" : step.tokenRelated === "token_b" ? "50%" : "20%"}
                              </Badge>
                            )}
                            <span className="text-[10px] font-mono text-muted-foreground">{step.phase}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Add Button Between Steps */}
              <div className="flex items-center justify-center py-1">
                <div className="flex-1 border-t border-dashed border-muted-foreground/20" />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[10px] text-muted-foreground hover:text-primary mx-2"
                  onClick={() => setAddDialog({ afterId: step.id })}
                >
                  <Plus className="w-3 h-3 ml-1" />
                  إضافة مرحلة
                </Button>
                <div className="flex-1 border-t border-dashed border-muted-foreground/20" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Step Dialog */}
      <Dialog open={!!addDialog} onOpenChange={() => setAddDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>إضافة مرحلة جديدة</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">اسم المرحلة *</label>
              <Input value={newStep.label} onChange={e => setNewStep({ ...newStep, label: e.target.value })} placeholder="مثال: فحص إضافي" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">معرف المرحلة (phase) *</label>
              <Input value={newStep.phase} onChange={e => setNewStep({ ...newStep, phase: e.target.value })} placeholder="مثال: extra_inspection" className="font-mono" dir="ltr" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">الوصف</label>
              <Textarea value={newStep.description} onChange={e => setNewStep({ ...newStep, description: e.target.value })} rows={3} placeholder="وصف تفصيلي للمرحلة..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">المسؤول</label>
                <Select value={newStep.actor} onValueChange={v => setNewStep({ ...newStep, actor: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACTOR_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">الأيقونة</label>
                <Select value={newStep.icon} onValueChange={v => setNewStep({ ...newStep, icon: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(ICON_MAP).map(k => (
                      <SelectItem key={k} value={k}>{k}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={newStep.automated} onCheckedChange={v => setNewStep({ ...newStep, automated: v })} />
              <span className="text-sm">مرحلة آلية (بدون تدخل بشري)</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialog(null)}>إلغاء</Button>
            <Button onClick={() => addDialog && addStepAfter(addDialog.afterId)}>
              <Plus className="w-4 h-4 ml-2" />
              إضافة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkflowEditorPage;
