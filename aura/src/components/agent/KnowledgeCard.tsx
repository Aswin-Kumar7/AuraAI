"use client";

import { BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { useCallStore } from "@/store/callStore";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export function KnowledgeCard() {
  const knowledgeSnippet = useCallStore((s) => s.knowledgeSnippet);
  const [expanded, setExpanded] = useState(false);

  if (!knowledgeSnippet) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="rounded-xl border border-indigo-500/15 bg-indigo-500/[0.05] p-3 space-y-2"
      >
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-between w-full"
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400">
            <div className="h-6 w-6 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              <BookOpen className="h-3 w-3" />
            </div>
            KB Insight
          </div>
          <div className="p-1 rounded-md hover:bg-white/5 transition-colors">
            {expanded ? (
              <ChevronUp className="h-3 w-3 text-slate-500" />
            ) : (
              <ChevronDown className="h-3 w-3 text-slate-500" />
            )}
          </div>
        </button>

        <p
          className={cn(
            "text-[12px] leading-relaxed text-white/70 transition-all duration-200",
            expanded ? "" : "line-clamp-2"
          )}
        >
          {knowledgeSnippet}
        </p>
      </motion.div>
    </AnimatePresence>
  );
}
