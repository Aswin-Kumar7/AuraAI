"use client";

import { Database, BookOpen, ExternalLink } from "lucide-react";
import { useCallStore } from "@/store/callStore";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

function pct(score: number | null) {
  if (typeof score !== "number") return 0;
  return Math.round(Math.min(1, Math.max(0, score)) * 100);
}export function KnowledgeRetrievalPanel() {
  const policySuggestion = useCallStore((s) => s.policySuggestion);
  const knowledgeSnippet = useCallStore((s) => s.knowledgeSnippet);
  const knowledgeCandidates = useCallStore((s) => s.knowledgeCandidates) || [];
  const policyMatchScore = useCallStore((s) => s.policyMatchScore);

  const mainPolicy = policySuggestion || knowledgeSnippet;
  const matchPct = pct(policyMatchScore);
  const scoreColor =
    matchPct >= 75 ? "text-emerald-600" : matchPct >= 50 ? "text-amber-600" : typeof policyMatchScore === "number" ? "text-red-600" : "text-slate-400";

  return (
    <div className="mt-1 pb-4">
      {/* Section header */}
      <div className="flex items-center justify-between py-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Database className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Knowledge
          </span>
        </div>
        <span className={cn("text-[10px] font-mono font-bold", scoreColor)}>
          {typeof policyMatchScore === "number" ? `${matchPct}% match` : "Pinecone"}
        </span>
      </div>

      <div className="py-3 space-y-3">
        {/* Policy suggestion — plain text with icon */}
        {mainPolicy ? (
          <div className="flex items-start gap-1.5">
            <BookOpen className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
            <p className="text-[11.5px] text-slate-600 leading-relaxed">{mainPolicy}</p>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <ExternalLink className="h-3 w-3 text-slate-300" />
            <p className="text-[11px] text-slate-400">Policy appears when customer issue is detected</p>
          </div>
        )}

        {/* Retrieved chunks — clean list */}
        {knowledgeCandidates.length > 0 && (
          <div className="divide-y divide-slate-100">
            {knowledgeCandidates.map((item, idx) => (
              <motion.div
                key={`${idx}-${item.slice(0, 12)}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.06, duration: 0.2 }}
                className="py-2 flex items-start gap-2 hover:bg-slate-50/50 -mx-1 px-1 rounded transition-colors"
              >
                <span className="text-[9px] font-bold text-slate-300 mt-0.5 shrink-0">#{idx + 1}</span>
                <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">{item}</p>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
