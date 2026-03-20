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

  const switchMode = async (next: Mode) => {
    const normalizedMode = next.toLowerCase() as "whisper" | "alert" | "auto";
    const previousMode =
      activeMode === "whisper" || activeMode === "alert" || activeMode === "auto"
        ? activeMode
        : null;

    setActiveMode(normalizedMode);
    updateAnalysis({ activeMode: normalizedMode });

    if (!callId) {
      return;
    }

    try {
      const response = await fetch(`/api/calls/${callId}/mode`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: normalizedMode }),
      });

      if (!response.ok) {
        throw new Error(`Failed to persist mode (${response.status})`);
      }
    } catch (error) {
      console.error("[CopilotPanel] Mode persistence failed:", error);

      if (previousMode) {
        setActiveMode(previousMode);
        updateAnalysis({ activeMode: previousMode });
      }
    }
  };

  const isWhisper = mode === "Whisper";
  const isAlert = mode === "Alert";
  const isAuto = mode === "Auto";

  return (
    <div className="flex flex-col h-full rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-600" />
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Copilot Engine
            </span>
          </div>
        </div>

        {/* Mode Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-slate-100">
          {MODES.map((m) => {
            const Icon = m.icon;
            const isActive = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => switchMode(m.id)}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-1 py-1.5 rounded-lg transition-all duration-200",
                  isActive
                    ? "bg-white text-slate-800 shadow-sm border border-slate-200"
                    : "text-slate-400 hover:text-slate-600"
                )}
              >
                <div className="flex items-center gap-1.5">
                  <Icon className={cn("h-3 w-3", isActive ? "text-indigo-600" : "")} />
                  <span className="text-[11px] font-semibold uppercase tracking-wider">{m.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        
        {isAuto ? (
          <div className="flex flex-col items-center justify-center mt-8 text-center px-6 pb-6">
            <div className="h-10 w-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center mb-3">
              <Cpu className="h-4 w-4 text-slate-400 animate-pulse" />
            </div>
            <h4 className="text-sm font-semibold text-slate-600 mb-1.5">Auto Mode Active</h4>
            <p className="text-xs text-slate-400 leading-relaxed max-w-[200px]">
              AI monitors silently and generates your ACW summary when the call ends.
            </p>
          </div>
        ) : (
          <>
            {/* Alert Banner */}
            {(isAlert || isWhisper) && (
              <div className="px-4 pt-3">
                <AlertBanner forceShow={isAlert} />
              </div>
            )}
            {/* Knowledge Card */}
            {isWhisper && (
              <div className="px-4 pt-2">
                <KnowledgeCard />
              </div>
            )}

            {/* Suggestions list */}
            {(isWhisper || (!isAlert && !isAuto)) && (
              <div className="mt-2">
                <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Suggestions</p>
                  {suggestions && suggestions.length > 0 && (
                    <span className="text-[9px] text-indigo-500 font-semibold">{Math.min(suggestions.length, 3)} ranked</span>
                  )}
                </div>
                <AnimatePresence mode="popLayout">
                  {suggestions && suggestions.length > 0 ? (
                    suggestions.slice(0, 3).map((s: SuggestionItem, idx: number) => (
                      <motion.div
                        key={`${s.text}-${idx}`}
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.2, delay: idx * 0.06 }}
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
                      className="flex flex-col items-center justify-center py-8 text-center px-4"
                    >
                      <Sparkles className="h-5 w-5 text-slate-200 mb-2" />
                      <p className="text-xs text-slate-400 max-w-[180px]">
                        AI suggestions surface as the conversation progresses
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
