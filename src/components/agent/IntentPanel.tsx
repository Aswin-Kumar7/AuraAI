"use client";

import { useMemo } from "react";
import { BrainCircuit, Target, Lightbulb } from "lucide-react";
import { useCallStore } from "@/store/callStore";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

function scoreColor(score: number | null) {
  if (score === null) return "text-slate-400";
  if (score >= 0.75) return "text-emerald-600";
  if (score >= 0.5) return "text-amber-600";
  return "text-red-600";
}

function scoreBadge(score: number | null) {
  if (score === null) return "bg-slate-50 border-slate-200 text-slate-500";
  if (score >= 0.75) return "bg-emerald-50 border-emerald-200 text-emerald-700";
  if (score >= 0.5) return "bg-amber-50 border-amber-200 text-amber-700";
  return "bg-red-50 border-red-200 text-red-700";
}

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
};

export function IntentPanel() {
  const intent = useCallStore((s) => s.intent);
  const intentConfidence = useCallStore((s) => s.intentConfidence);
  const inferredNeed = useCallStore((s) => s.inferredNeed);
  const policyMatchScore = useCallStore((s) => s.policyMatchScore);
  const customerDisposition = useCallStore((s) => s.customerDisposition);
  const intentTrend = useCallStore((s) => s.intentTrend) || [];

  const trendPoints = useMemo(() => intentTrend.slice(-10), [intentTrend]);
  const confidencePct = Math.round((intentConfidence ?? 0) * 100);
  const policyPct = Math.round((policyMatchScore ?? 0) * 100);
  const hasLiveData = intent !== null;

  const dispositionEmoji: Record<string, string> = {
    satisfied: "😊",
    neutral: "😐",
    angry: "😠",
    needs_change: "🔄",
  };

  return (
    <div className="mt-3">
      {/* Section header */}
      <div className="flex items-center justify-between py-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <BrainCircuit className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Intent Detection
          </span>
        </div>
        {hasLiveData && (
          <span className={cn(
            "text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize",
            scoreBadge(intentConfidence)
          )}>
            {intent?.replace(/_/g, " ")}
          </span>
        )}
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="py-3 space-y-3"
      >
        {/* Disposition */}
        {customerDisposition && (
          <motion.div variants={itemVariants} className="flex items-center gap-2">
            <span className="text-base leading-none">{dispositionEmoji[customerDisposition] || "😐"}</span>
            <span className="text-[12px] text-slate-600 capitalize">{customerDisposition.replace(/_/g, " ")}</span>
          </motion.div>
        )}

        {/* Confidence bar */}
        <motion.div variants={itemVariants} className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Confidence</span>
            <span className={cn("font-mono font-bold text-[11px]", scoreColor(intentConfidence))}>
              {intentConfidence === null ? "—" : `${confidencePct}%`}
            </span>
          </div>
          <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
              initial={{ width: 0 }}
              animate={{ width: `${intentConfidence === null ? 0 : confidencePct}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
        </motion.div>

        {/* Policy match bar */}
        <motion.div variants={itemVariants} className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1 text-slate-400">
              <Target className="h-3 w-3" /> Policy Match
            </span>
            <span className={cn("font-mono font-bold text-[11px]", scoreColor(policyMatchScore))}>
              {policyMatchScore === null ? "—" : `${policyPct}%`}
            </span>
          </div>
          <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
              initial={{ width: 0 }}
              animate={{ width: `${policyMatchScore === null ? 0 : policyPct}%` }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
            />
          </div>
        </motion.div>

        {/* Inferred need — plain text */}
        <motion.div variants={itemVariants} className="flex items-start gap-1.5">
          <Lightbulb className="h-3.5 w-3.5 text-slate-300 mt-0.5 shrink-0" />
          <p className="text-[11.5px] leading-relaxed text-slate-500">
            {inferredNeed || "Customer intent will appear during a live call"}
          </p>
        </motion.div>

        {/* Trend sparkline */}
        {trendPoints.length > 0 && (
          <motion.div variants={itemVariants} className="pt-1">
            <div className="flex items-end gap-0.5 h-7">
              {trendPoints.map((point, idx) => {
                const conf = Math.round((point.confidence || 0) * 100);
                const match = Math.round((point.policyMatchScore || 0) * 100);
                return (
                  <div key={`${point.timestamp}-${idx}`} className="flex-1 flex items-end gap-[1px]">
                    <div className="w-1/2 rounded-t-sm bg-indigo-200" style={{ height: `${Math.max(2, Math.round(conf * 0.25))}px` }} />
                    <div className="w-1/2 rounded-t-sm bg-emerald-200" style={{ height: `${Math.max(2, Math.round(match * 0.25))}px` }} />
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
