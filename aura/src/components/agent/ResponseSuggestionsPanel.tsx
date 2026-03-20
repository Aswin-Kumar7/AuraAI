"use client";

import { MessageSquareText, Sparkles, Copy, Check } from "lucide-react";
import { useCallStore } from "@/store/callStore";
import { useState } from "react";
import { cn } from "@/lib/utils";

const TONE_COLORS: Record<string, string> = {
  apologetic: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  empathetic: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  calm: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  helpful: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  professional: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  confident: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  neutral: "bg-slate-600/20 text-slate-400 border-slate-600/30",
};

export function ResponseSuggestionsPanel() {
  const suggestions = useCallStore((s) => s.suggestions) || [];
  const visible = suggestions.slice(0, 3);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const copyText = (text: string, idx: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    }).catch(() => {});
  };

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0a0e1a]/90 backdrop-blur-md overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="px-4 py-3 bg-white/[0.02] border-b border-white/[0.08] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <MessageSquareText className="h-3.5 w-3.5 text-indigo-400" />
          </div>
          <span className="text-[11px] font-bold text-white tracking-widest uppercase">
            Response Suggestions
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {visible.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-[9px] font-bold text-slate-400 uppercase tracking-wide">
              {visible.length} Ranked
            </span>
          )}
        </div>
      </div>

      <div className="p-3 space-y-2">
        {visible.length > 0 ? (
          visible.map((item, idx) => {
            const likelihood =
              typeof item.resolutionLikelihood === "number"
                ? Math.round(Math.min(1, Math.max(0, item.resolutionLikelihood)) * 100)
                : null;
            const toneClass = TONE_COLORS[item.tone?.toLowerCase() || "neutral"] || TONE_COLORS.neutral;
            const isCopied = copiedIdx === idx;

            return (
              <div
                key={`${item.text}-${idx}`}
                className={cn(
                  "group rounded-xl border p-3 space-y-2 transition-all",
                  idx === 0
                    ? "border-white/[0.10] bg-white/[0.04]"
                    : "border-white/[0.05] bg-white/[0.02]"
                )}
              >
                {/* Card top row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn(
                      "text-[10px] font-bold rounded-lg px-2 py-0.5 border",
                      idx === 0
                        ? "bg-indigo-500/15 border-indigo-500/25 text-indigo-300"
                        : "bg-white/[0.04] border-white/[0.06] text-slate-400"
                    )}>
                      #{item.rank || idx + 1} Best
                    </span>
                    <span className={cn(
                      "text-[10px] font-semibold rounded-md px-1.5 py-0.5 border capitalize",
                      toneClass
                    )}>
                      {item.tone || "neutral"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {likelihood !== null && (
                      <div className="flex items-center gap-1">
                        <div className="h-1 w-10 rounded-full bg-white/[0.06] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{ width: `${likelihood}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono font-bold text-emerald-400">{likelihood}%</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => copyText(item.text, idx)}
                      className="h-6 w-6 rounded-md flex items-center justify-center bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-colors opacity-0 group-hover:opacity-100"
                      title="Copy to clipboard"
                    >
                      {isCopied ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Copy className="h-3 w-3 text-slate-400" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Suggestion text */}
                <p className="text-[12px] text-white/90 leading-relaxed">{item.text}</p>
              </div>
            );
          })
        ) : (
          <div className="h-28 flex flex-col items-center justify-center gap-3 rounded-xl border border-white/[0.04] bg-white/[0.02]">
            <div className="h-8 w-8 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-slate-500" />
            </div>
            <div className="text-center">
              <p className="text-[12px] font-medium text-slate-500">No suggestions yet</p>
              <p className="text-[10px] text-slate-600 mt-0.5">AI-ranked responses appear when customer intent is detected</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
