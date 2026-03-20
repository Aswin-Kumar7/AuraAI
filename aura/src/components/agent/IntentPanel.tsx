"use client";

import { useMemo } from "react";
import { BrainCircuit, Target, TrendingUp, Lightbulb } from "lucide-react";
import { useCallStore } from "@/store/callStore";
import { cn } from "@/lib/utils";

function scoreColor(score: number | null) {
  if (score === null) return "text-slate-400";
  if (score >= 0.75) return "text-emerald-400";
  if (score >= 0.5) return "text-amber-400";
  return "text-red-400";
}

function scoreBg(score: number | null) {
  if (score === null) return "bg-slate-500/20 border-slate-500/30";
  if (score >= 0.75) return "bg-emerald-500/15 border-emerald-500/30";
  if (score >= 0.5) return "bg-amber-500/15 border-amber-500/30";
  return "bg-red-500/15 border-red-500/30";
}

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
    <div className="rounded-2xl border border-white/[0.06] bg-[#0a0e1a]/90 backdrop-blur-md overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white/[0.02] border-b border-white/[0.08]">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <BrainCircuit className="h-3.5 w-3.5 text-indigo-400" />
          </div>
          <span className="text-[11px] font-bold text-white tracking-widest uppercase">
            Intent Detection
          </span>
        </div>
        <div className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold capitalize",
          hasLiveData ? scoreBg(intentConfidence) : "bg-white/[0.04] border-white/[0.06]"
        )}>
          <span className={hasLiveData ? scoreColor(intentConfidence) : "text-slate-500"}>
            {intent ? intent.replace(/_/g, " ") : "Waiting For Call…"}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Disposition badge */}
        {customerDisposition && (
          <div className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-xl border text-[12px] font-medium",
            customerDisposition === "angry" ? "bg-red-500/10 border-red-500/20 text-red-400" :
            customerDisposition === "satisfied" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
            customerDisposition === "needs_change" ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
            "bg-white/[0.04] border-white/[0.06] text-slate-400"
          )}>
            <span>{dispositionEmoji[customerDisposition] || "😐"}</span>
            <span className="capitalize">{customerDisposition.replace(/_/g, " ")}</span>
          </div>
        )}

        {/* Confidence bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-medium">Intent Confidence</span>
            <span className={cn("font-mono font-bold text-[12px]", scoreColor(intentConfidence))}>
              {intentConfidence === null ? "—" : `${confidencePct}%`}
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/[0.04] border border-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-400 transition-all duration-700"
              style={{ width: `${intentConfidence === null ? 0 : confidencePct}%` }}
            />
          </div>
        </div>

        {/* Policy match bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1 text-slate-400 font-medium">
              <Target className="h-3 w-3" /> Policy Match
            </span>
            <span className={cn("font-mono font-bold text-[12px]", scoreColor(policyMatchScore))}>
              {policyMatchScore === null ? "—" : `${policyPct}%`}
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/[0.04] border border-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-700"
              style={{ width: `${policyMatchScore === null ? 0 : policyPct}%` }}
            />
          </div>
        </div>

        {/* Inferred need */}
        {inferredNeed ? (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <Lightbulb className="h-3.5 w-3.5 text-indigo-400 mt-0.5 shrink-0" />
            <p className="text-[12px] text-slate-200 leading-relaxed">{inferredNeed}</p>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
            <Lightbulb className="h-3.5 w-3.5 text-slate-600" />
            <p className="text-[12px] text-slate-600">Customer intent will appear here during a live call</p>
          </div>
        )}

        {/* Trend chart */}
        <div className="pt-1">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="h-3 w-3 text-slate-500" />
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
              Confidence Trend
            </p>
            <div className="ml-auto flex items-center gap-2 text-[9px] text-slate-600">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-indigo-500 inline-block"/>intent</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500 inline-block"/>policy</span>
            </div>
          </div>
          {trendPoints.length > 0 ? (
            <div className="h-12 flex items-end gap-0.5 px-1">
              {trendPoints.map((point, idx) => {
                const conf = Math.round((point.confidence || 0) * 100);
                const match = Math.round((point.policyMatchScore || 0) * 100);
                return (
                  <div
                    key={`${point.timestamp}-${idx}`}
                    className="flex-1 flex items-end gap-[1px]"
                    title={`${point.intent}: confidence ${conf}%, policy ${match}%`}
                  >
                    <div className="w-1/2 rounded-t-sm bg-indigo-500/70" style={{ height: `${Math.max(4, Math.round(conf * 0.46))}px` }} />
                    <div className="w-1/2 rounded-t-sm bg-emerald-500/70" style={{ height: `${Math.max(4, Math.round(match * 0.46))}px` }} />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-12 flex items-center justify-center rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <p className="text-[10px] text-slate-600">Trend populates during a live call</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
