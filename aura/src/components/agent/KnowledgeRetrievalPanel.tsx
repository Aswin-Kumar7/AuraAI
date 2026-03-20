"use client";

import { Database, FileSearch, BookOpen, ExternalLink } from "lucide-react";
import { useCallStore } from "@/store/callStore";
import { cn } from "@/lib/utils";

function pct(score: number | null) {
  if (typeof score !== "number") return 0;
  return Math.round(Math.min(1, Math.max(0, score)) * 100);
}

export function KnowledgeRetrievalPanel() {
  const policySuggestion = useCallStore((s) => s.policySuggestion);
  const knowledgeSnippet = useCallStore((s) => s.knowledgeSnippet);
  const knowledgeCandidates = useCallStore((s) => s.knowledgeCandidates) || [];
  const policyMatchScore = useCallStore((s) => s.policyMatchScore);

  const mainPolicy = policySuggestion || knowledgeSnippet;
  const matchPct = pct(policyMatchScore);
  const scoreColor =
    matchPct >= 75 ? "text-emerald-400" : matchPct >= 50 ? "text-amber-400" : typeof policyMatchScore === "number" ? "text-red-400" : "text-slate-500";
  const scoreBg =
    matchPct >= 75 ? "from-emerald-500" : matchPct >= 50 ? "from-amber-500" : "from-cyan-500";

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0a0e1a]/90 backdrop-blur-md overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="px-4 py-3 bg-white/[0.02] border-b border-white/[0.08] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Database className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <span className="text-[11px] font-bold text-white tracking-widest uppercase">
            Knowledge Retrieval
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06]">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">Pinecone</span>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Policy match score */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-medium">Policy Match Score</span>
            <span className={cn("font-mono font-bold text-[13px]", scoreColor)}>
              {typeof policyMatchScore === "number" ? `${matchPct}%` : "—"}
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/[0.04] border border-white/[0.06] overflow-hidden">
            <div
              className={cn("h-full rounded-full bg-gradient-to-r to-teal-400 transition-all duration-700", scoreBg)}
              style={{ width: `${matchPct}%` }}
            />
          </div>
        </div>

        {/* Policy suggestion */}
        {mainPolicy ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 space-y-1">
            <div className="flex items-center gap-1.5">
              <BookOpen className="h-3 w-3 text-emerald-400" />
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Suggested Policy / Step</p>
            </div>
            <p className="text-[12px] text-white/90 leading-relaxed">{mainPolicy}</p>
          </div>
        ) : (
          <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-3 flex items-center gap-2">
            <BookOpen className="h-3.5 w-3.5 text-slate-600" />
            <p className="text-[12px] text-slate-600">Policy suggestion appears once customer issue is detected</p>
          </div>
        )}

        {/* Retrieved chunks */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <FileSearch className="h-3 w-3 text-slate-500" />
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Top Retrieved Chunks</p>
          </div>
          {knowledgeCandidates.length > 0 ? (
            <div className="space-y-1.5">
              {knowledgeCandidates.map((item, idx) => (
                <div
                  key={`${idx}-${item.slice(0, 12)}`}
                  className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-2.5 flex items-start gap-2"
                >
                  <span className="text-[9px] font-bold text-slate-500 mt-0.5 shrink-0">#{idx + 1}</span>
                  <p className="text-[11px] text-slate-300 leading-relaxed line-clamp-2">{item}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-2.5 flex items-center gap-2">
              <ExternalLink className="h-3 w-3 text-slate-600" />
              <p className="text-[11px] text-slate-600">Vector chunks retrieved from Pinecone appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
