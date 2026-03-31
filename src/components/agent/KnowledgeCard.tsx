"use client";

import { BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { useCallStore } from "@/store/callStore";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export function KnowledgeCard() {
  const knowledgeSnippet = useCallStore((s) => s.knowledgeSnippet);
  const policySuggestion = useCallStore((s) => s.policySuggestion);
  const inferredNeed = useCallStore((s) => s.inferredNeed);
  const intent = useCallStore((s) => s.intent);
  const [expanded, setExpanded] = useState(false);

  const displaySnippet = policySuggestion || knowledgeSnippet;

  if (!displaySnippet && !inferredNeed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="space-y-2"
      >
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-between w-full"
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600">
            <div className="h-6 w-6 rounded-lg bg-indigo-100 flex items-center justify-center">
              <BookOpen className="h-3 w-3" />
            </div>
            Policy Insight
          </div>
          <div className="p-1 rounded-md hover:bg-white/5 transition-colors">
            {expanded ? (
              <ChevronUp className="h-3 w-3 text-slate-500" />
            ) : (
              <ChevronDown className="h-3 w-3 text-slate-500" />
            )}
          </div>
        </button>

        {intent && (
          <p className="text-[10px] uppercase tracking-wide text-indigo-500">
            Intent: {intent.replace(/_/g, " ")}
          </p>
        )}

        {inferredNeed && (
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Customer likely needs: {inferredNeed}
          </p>
        )}

        {displaySnippet && (
          <p
            className={cn(
              "text-[12px] leading-relaxed text-slate-700 transition-all duration-200",
              expanded ? "" : "line-clamp-2"
            )}
          >
            {displaySnippet}
          </p>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
