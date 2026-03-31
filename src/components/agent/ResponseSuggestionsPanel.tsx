"use client";

import { MessageSquareText, Sparkles, Copy, Check } from "lucide-react";
import { useCallStore } from "@/store/callStore";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const TONE_COLORS: Record<string, string> = {
  apologetic: "bg-rose-50 text-rose-600 border-rose-200",
  empathetic: "bg-violet-50 text-violet-600 border-violet-200",
  calm: "bg-blue-50 text-blue-600 border-blue-200",
  helpful: "bg-emerald-50 text-emerald-600 border-emerald-200",
  professional: "bg-slate-100 text-slate-600 border-slate-200",
  confident: "bg-amber-50 text-amber-600 border-amber-200",
  neutral: "bg-slate-100 text-slate-500 border-slate-200",
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
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center">
            <MessageSquareText className="h-3.5 w-3.5 text-indigo-600" />
          </div>
          <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
            Response Suggestions
          </span>
        </div>
        {visible.length > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-[9px] font-bold text-indigo-600 uppercase tracking-wide">
            {visible.length} Ranked
          </span>
        )}
      </div>

      <div className="p-3 space-y-2">
        <AnimatePresence mode="popLayout">
          {visible.length > 0 ? (
            visible.map((item, idx) => {
              const likelihood =
                typeof item.resolutionLikelihood === "number"
                  ? Math.round(Math.min(1, Math.max(0, item.resolutionLikelihood)) * 100)
                  : null;
              const toneClass = TONE_COLORS[item.tone?.toLowerCase() || "neutral"] || TONE_COLORS.neutral;
              const isCopied = copiedIdx === idx;

              return (
                <motion.div
                  key={`${item.text}-${idx}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.2, delay: idx * 0.06 }}
                  className={cn(
                    "group rounded-xl border p-3 space-y-2 transition-all hover:shadow-sm",
                    idx === 0
                      ? "border-indigo-200 bg-indigo-50/50"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  )}
                >
                  {/* Card top row */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn(
                        "text-[10px] font-bold rounded-md px-2 py-0.5 border",
                        idx === 0
                          ? "bg-indigo-600 border-indigo-600 text-white"
                          : "bg-slate-100 border-slate-200 text-slate-500"
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
                        <div className="flex items-center gap-1.5">
                          <div className="h-1 w-10 rounded-full bg-slate-200 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${likelihood}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono font-bold text-emerald-600">{likelihood}%</span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => copyText(item.text, idx)}
                        className="h-6 w-6 rounded-md flex items-center justify-center bg-white border border-slate-200 hover:bg-slate-50 transition-colors opacity-0 group-hover:opacity-100"
                        title="Copy to clipboard"
                      >
                        {isCopied ? (
                          <Check className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <Copy className="h-3 w-3 text-slate-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Suggestion text */}
                  <p className="text-[12.5px] text-slate-700 leading-relaxed">{item.text}</p>
                </motion.div>
              );
            })
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-24 flex flex-col items-center justify-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50"
            >
              <div className="h-8 w-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                <Sparkles className="h-4 w-4 text-slate-300" />
              </div>
              <div className="text-center">
                <p className="text-[12px] font-medium text-slate-400">No suggestions yet</p>
                <p className="text-[10px] text-slate-300 mt-0.5">AI-ranked responses appear when intent is detected</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
