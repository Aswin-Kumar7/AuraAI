"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCallStore } from "@/store/callStore";
import { cn } from "@/lib/utils";
import { Headphones, UserRound, ShieldCheck, Activity, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const speakerConfig: Record<
  string,
  { label: string; icon: typeof Headphones; color: string; bg: string; align: "left" | "right" }
> = {
  agent: {
    label: "You (Agent)",
    icon: Headphones,
    color: "text-indigo-600",
    bg: "bg-indigo-600 text-white shadow-sm",
    align: "right",
  },
  customer: {
    label: "Customer",
    icon: UserRound,
    color: "text-slate-500",
    bg: "bg-slate-100 text-slate-800",
    align: "left",
  },
  supervisor: {
    label: "Supervisor",
    icon: ShieldCheck,
    color: "text-amber-600",
    bg: "bg-amber-50 border border-amber-200 text-amber-900",
    align: "left",
  },
};

export function LiveTranscript() {
  const transcript = useCallStore((s) => s.transcript);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [channel, setChannel] = useState<"all" | "agent" | "customer">("all");

  const channelCounts = useMemo(() => {
    let agent = 0;
    let customer = 0;
    for (const line of transcript) {
      if (line.speaker === "agent") {
        agent += 1;
      } else if (line.speaker === "customer") {
        customer += 1;
      }
    }
    return { agent, customer };
  }, [transcript]);

  const visibleTranscript = useMemo(() => {
    if (channel === "all") {
      return transcript;
    }
    return transcript.filter((line) => line.speaker === channel);
  }, [transcript, channel]);

  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [visibleTranscript.length]);

  return (
    <div className="flex flex-col h-full rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2.5">
          <MessageSquare className="h-4 w-4 text-indigo-500" />
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            Transcript
            <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-500">
              <Activity className="h-2.5 w-2.5" /> Live
            </span>
          </h3>
        </div>
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-slate-100">
          <button
            type="button"
            onClick={() => setChannel("all")}
            className={cn(
              "rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all",
              channel === "all"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-400 hover:text-slate-600"
            )}
          >
            All ({transcript.length})
          </button>
          <button
            type="button"
            onClick={() => setChannel("customer")}
            className={cn(
              "rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all",
              channel === "customer"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-400 hover:text-slate-600"
            )}
          >
            Customer ({channelCounts.customer})
          </button>
          <button
            type="button"
            onClick={() => setChannel("agent")}
            className={cn(
              "rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all",
              channel === "agent"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-400 hover:text-slate-600"
            )}
          >
            Agent ({channelCounts.agent})
          </button>
        </div>
      </div>

      {/* Transcript Area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin"
      >
        <AnimatePresence initial={false}>
          {visibleTranscript.map((line, idx) => {
            const config = speakerConfig[line.speaker] || speakerConfig.customer;
            const isAgent = config.align === "right";

            return (
              <motion.div
                key={idx}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  "flex flex-col gap-1",
                  isAgent ? "items-end" : "items-start"
                )}
              >
                <div className={cn(
                  "flex items-center gap-1.5 px-1",
                  isAgent ? "flex-row-reverse" : "flex-row"
                )}>
                   <span className={cn("text-[10px] font-semibold uppercase tracking-wide", config.color)}>
                     {config.label}
                   </span>
                   <span className="text-[9px] text-slate-400 font-mono">
                     {line.timestamp ? new Date(line.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Live"}
                   </span>
                </div>

                <div className={cn(
                  "max-w-[85%] px-4 py-3 rounded-2xl transition-all",
                  config.bg,
                  isAgent ? "rounded-tr-none" : "rounded-tl-none"
                )}>
                  <p className="text-[13.5px] leading-relaxed font-medium">
                    {line.text}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        
        {visibleTranscript.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center space-y-3 py-16">
            <div className="p-4 rounded-full bg-slate-100 border border-slate-200">
               <Headphones className="h-7 w-7 text-slate-300" />
            </div>
            <p className="text-[11px] text-slate-400 font-medium uppercase tracking-widest">Waiting for voice activity</p>
          </div>
        )}
      </div>
    </div>
  );
}
