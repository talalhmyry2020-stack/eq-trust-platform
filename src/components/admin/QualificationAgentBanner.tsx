import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bot, CheckCircle, XCircle, Loader2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";

interface AgentState {
  status: "idle" | "checking" | "processing" | "done" | "error";
  currentDealNumber: number | null;
  currentDealTitle: string | null;
  totalPending: number;
  lastResult: {
    dealNumber: number;
    approved: boolean;
    reason?: string;
  } | null;
  processedCount: number;
}

const QualificationAgentBanner = ({ onDealProcessed }: { onDealProcessed?: () => void }) => {
  const [agent, setAgent] = useState<AgentState>({
    status: "idle",
    currentDealNumber: null,
    currentDealTitle: null,
    totalPending: 0,
    lastResult: null,
    processedCount: 0,
  });
  const [enabled, setEnabled] = useState(false);
  const processingRef = useRef(false);
  const mountedRef = useRef(true);

  // Check if agent is enabled and count pending deals
  const checkState = useCallback(async () => {
    const [settingRes, dealsRes] = await Promise.all([
      supabase.from("system_settings").select("value").eq("key", "qualification_agent_enabled").maybeSingle(),
      supabase.from("deals").select("id, deal_number, title", { count: "exact" }).eq("status", "pending_review").eq("current_phase", "verification").order("created_at", { ascending: true }),
    ]);

    const isEnabled = (settingRes.data?.value as any)?.enabled === true;
    setEnabled(isEnabled);

    if (!mountedRef.current) return;

    const pendingCount = dealsRes.count || 0;
    setAgent(prev => ({ ...prev, totalPending: pendingCount }));

    return { isEnabled, pendingDeals: dealsRes.data || [], pendingCount };
  }, []);

  // Process deals one by one
  const processDeals = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;

    try {
      const state = await checkState();
      if (!state?.isEnabled || state.pendingCount === 0) {
        setAgent(prev => ({ ...prev, status: "idle" }));
        processingRef.current = false;
        return;
      }

      let processedTotal = 0;

      // Process one deal at a time
      for (const deal of state.pendingDeals) {
        if (!mountedRef.current) break;

        // Re-check if still pending (might have been processed)
        const { data: freshDeal } = await supabase
          .from("deals")
          .select("status, current_phase")
          .eq("id", deal.id)
          .maybeSingle();

        if (freshDeal?.status !== "pending_review") continue;

        setAgent(prev => ({
          ...prev,
          status: "processing",
          currentDealNumber: deal.deal_number,
          currentDealTitle: deal.title,
          totalPending: state.pendingCount - processedTotal,
        }));

        // Call qualify-deals (it processes the oldest first)
        try {
          const { data, error } = await supabase.functions.invoke("qualify-deals");

          if (!mountedRef.current) break;

          if (data?.results?.[0]) {
            const result = data.results[0];
            setAgent(prev => ({
              ...prev,
              lastResult: {
                dealNumber: result.deal_number,
                approved: result.status === "approved",
                reason: result.reason,
              },
              processedCount: prev.processedCount + 1,
            }));
            processedTotal++;
            onDealProcessed?.();

            // Show result for 2 seconds before moving to next
            await new Promise(r => setTimeout(r, 2000));
          } else {
            break;
          }
        } catch (err) {
          console.error("Agent error:", err);
          setAgent(prev => ({ ...prev, status: "error" }));
          break;
        }
      }

      if (mountedRef.current) {
        setAgent(prev => ({
          ...prev,
          status: processedTotal > 0 ? "done" : "idle",
          currentDealNumber: null,
          currentDealTitle: null,
        }));

        // Reset done status after 5 seconds
        if (processedTotal > 0) {
          setTimeout(() => {
            if (mountedRef.current) {
              setAgent(prev => ({ ...prev, status: "idle", processedCount: 0, lastResult: null }));
            }
          }, 5000);
        }
      }
    } finally {
      processingRef.current = false;
    }
  }, [checkState, onDealProcessed]);

  useEffect(() => {
    mountedRef.current = true;
    checkState();

    // Auto-start processing on mount if there are pending deals
    const timer = setTimeout(() => processDeals(), 1500);

    // Poll every 30s for new pending deals
    const interval = setInterval(() => {
      if (!processingRef.current) {
        processDeals();
      }
    }, 30000);

    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [checkState, processDeals]);

  // Don't render if disabled and idle
  if (!enabled && agent.status === "idle") return null;
  if (agent.status === "idle" && agent.totalPending === 0 && !agent.lastResult) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="mb-4 rounded-lg border bg-card p-3 shadow-sm"
      >
        <div className="flex items-center gap-3" dir="rtl">
          <div className="relative">
            <Bot className="w-6 h-6 text-primary" />
            {agent.status === "processing" && (
              <motion.div
                className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-500"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              />
            )}
          </div>

          <div className="flex-1 min-w-0">
            {agent.status === "processing" && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">وكيل التأهيل يراجع</span>
                <Badge variant="outline" className="font-mono">
                  الصفقة #{agent.currentDealNumber}
                </Badge>
                {agent.currentDealTitle && (
                  <span className="text-muted-foreground text-xs truncate max-w-[200px]">
                    ({agent.currentDealTitle})
                  </span>
                )}
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                {agent.totalPending > 1 && (
                  <span className="text-xs text-muted-foreground">
                    • {agent.totalPending - 1} صفقة أخرى في الانتظار
                  </span>
                )}
              </div>
            )}

            {agent.status === "done" && (
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm text-green-700">
                  تم الانتهاء من مراجعة {agent.processedCount} صفقة
                </span>
              </div>
            )}

            {agent.status === "idle" && agent.totalPending > 0 && enabled && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  وكيل التأهيل جاهز — {agent.totalPending} صفقة في الانتظار
                </span>
              </div>
            )}

            {agent.status === "error" && (
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-destructive" />
                <span className="text-sm text-destructive">حدث خطأ أثناء المعالجة</span>
              </div>
            )}
          </div>

          {/* Last result indicator */}
          <AnimatePresence mode="wait">
            {agent.lastResult && agent.status === "processing" && (
              <motion.div
                key={agent.lastResult.dealNumber}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-center gap-1 text-xs"
              >
                {agent.lastResult.approved ? (
                  <>
                    <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                    <span className="text-green-700">#{agent.lastResult.dealNumber} مقبولة</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5 text-destructive" />
                    <span className="text-destructive">#{agent.lastResult.dealNumber} مرفوضة</span>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default QualificationAgentBanner;
