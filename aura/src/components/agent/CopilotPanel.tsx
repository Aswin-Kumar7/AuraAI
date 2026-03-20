"use client";

import { useCallStore } from "@/store/callStore";
import { SuggestionCard } from "./SuggestionCard";
import { AlertBanner } from "./AlertBanner";
import { KnowledgeCard } from "./KnowledgeCard";

import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, AlertTriangle, Cpu, Sparkles } from "lucide-react";

const MODES = [
  { id: "Whisper" as const, icon: Eye, label: "Whisper", desc: "Silent hints" },
  { id: "Alert" as const, icon: AlertTriangle, label: "Alert", desc: "Warnings only" },
  { id: "Auto" as const, icon: Cpu, label: "Auto", desc: "ACW only" },
];

type Mode = (typeof MODES)[number]["id"];
type SuggestionItem = { text?: string; tone?: string; rank?: number };

export function CopilotPanel() {
  const callId = useCallStore((s) => s.callId);
  const suggestions = useCallStore((s) => s.suggestions);
  const activeMode = useCallStore((s) => s.activeMode);
  const updateAnalysis = useCallStore((s) => s.updateAnalysis);
  const setActiveMode = useCallStore((s) => s.setActiveMode);

  const mode: Mode = activeMode === "alert" ? "Alert" : activeMode === "auto" ? "Auto" : "Whisper";

  const switchMode = (next: Mode) => {
    setActiveMode(next.toLowerCase() as "whisper" | "alert" | "auto");
    updateAnalysis({ activeMode: next.toLowerCase() as "whisper" | "alert" | "auto" });
  };

  const isWhisper = mode === "Whisper";
  const isAlert = mode === "Alert";
  const isAuto = mode === "Auto";

  return (
    <div className="flex flex-col h-full rounded-2xl border border-white/[0.06] bg-[#0a0e1a]/90 backdrop-blur-md overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/[0.08] bg-white/[0.02]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-400" />
            <span className="text-xs font-bold text-white tracking-widest uppercase">
              Copilot Engine
            </span>
          </div>
        </div>

        {/* Mode Tabs */}
        <div className="flex gap-1 p-0.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          {MODES.map((m) => {
            const Icon = m.icon;
            const isActive = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => switchMode(m.id)}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-1.5 py-2 rounded-lg transition-all duration-200",
                  isActive
                    ? "bg-indigo-500/15 text-indigo-400 shadow-inner border border-indigo-500/20"
                    : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]"
                )}
              >
                <div className="flex items-center gap-1.5">
                  <Icon className="h-3 w-3" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">{m.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin scrollbar-thumb-white/10">
        
        {isAuto ? (
          <div className="h-full flex flex-col items-center justify-center opacity-80 mt-10 text-center px-4">
            <div className="h-12 w-12 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 mb-4 animate-pulse">
              <Cpu className="h-5 w-5 text-indigo-400" />
            </div>
            <h4 className="text-sm font-semibold text-white/90 mb-2">Auto Mode Active</h4>
            <p className="text-xs text-slate-400 leading-relaxed max-w-[220px]">
              Live suggestions are paused. The AI is silently monitoring to generate your After-Call Work (ACW) summary and tags when the call ends.
            </p>
          </div>
        ) : (
          <>
            {/* Alert Banner / Knowledge Card */}
            {(isAlert || isWhisper) && <AlertBanner forceShow={isAlert} />}
            {isWhisper && <KnowledgeCard />}

            {/* Suggestions */}
            {(isWhisper || (!isAlert && !isAuto)) && (
              <AnimatePresence mode="popLayout">
                {suggestions && suggestions.length > 0 ? (
                  suggestions.slice(0, 3).map((s: SuggestionItem, idx: number) => (
                    <motion.div
                      key={`${s.text}-${idx}`}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.3, delay: idx * 0.1 }}
                    >
                      <SuggestionCard
                        callId={callId}
                        suggestion={{
                          text: s.text || "",
                          tone: s.tone || "",
                          rank: s.rank || idx + 1,
                        }}
                        dimmed={false}
                      />
                    </motion.div>
                  ))
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center py-10 text-center"
                  >
                    <div className="h-10 w-10 rounded-2xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-center mb-3">
                      <Sparkles className="h-4 w-4 text-slate-600" />
                    </div>
                    <p className="text-xs font-medium text-slate-500 max-w-[200px]">
                      AI suggestions will surface as the conversation progresses
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </>
        )}
      </div>
    </div>
  );
}
