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
    color: "text-indigo-400",
    bg: "bg-indigo-600/15 border-indigo-500/30",
    align: "right",
  },
  customer: {
    label: "Customer",
    icon: UserRound,
    color: "text-emerald-400",
    bg: "bg-white/[0.03] border-white/[0.08]",
    align: "left",
  },
  supervisor: {
    label: "Supervisor",
    icon: ShieldCheck,
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
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
    <div className="flex flex-col h-full rounded-2xl border border-white/[0.06] bg-[#020617]/95 backdrop-blur-3xl overflow-hidden shadow-2xl relative">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />
      
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.08] bg-white/[0.01]">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
             <MessageSquare className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white tracking-widest uppercase flex items-center gap-2">
              Operational Transcript
              <Activity className="h-3 w-3 text-emerald-500 animate-pulse" />
            </h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Live Dual-Channel Link</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setChannel("all")}
            className={cn(
              "rounded-lg border px-2 py-1 text-[10px] font-bold uppercase tracking-wide transition",
              channel === "all"
                ? "border-indigo-400/70 bg-indigo-500/20 text-indigo-200"
                : "border-white/10 bg-white/5 text-slate-400 hover:border-white/20"
            )}
          >
            All ({transcript.length})
          </button>
          <button
            type="button"
            onClick={() => setChannel("customer")}
            className={cn(
              "rounded-lg border px-2 py-1 text-[10px] font-bold uppercase tracking-wide transition",
              channel === "customer"
                ? "border-emerald-400/70 bg-emerald-500/20 text-emerald-200"
                : "border-white/10 bg-white/5 text-slate-400 hover:border-white/20"
            )}
          >
            Customer ({channelCounts.customer})
          </button>
          <button
            type="button"
            onClick={() => setChannel("agent")}
            className={cn(
              "rounded-lg border px-2 py-1 text-[10px] font-bold uppercase tracking-wide transition",
              channel === "agent"
                ? "border-indigo-400/70 bg-indigo-500/20 text-indigo-200"
                : "border-white/10 bg-white/5 text-slate-400 hover:border-white/20"
            )}
          >
            Agent ({channelCounts.agent})
          </button>
        </div>
      </div>

      {/* Transcript Area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-white/10"
      >
        <AnimatePresence initial={false}>
          {visibleTranscript.map((line, idx) => {
            const config = speakerConfig[line.speaker] || speakerConfig.customer;
            const isAgent = config.align === "right";

            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={cn(
                  "flex flex-col group transition-all",
                  isAgent ? "items-end" : "items-start"
                )}
              >
                <div className={cn(
                  "flex items-center gap-2 mb-2 px-1",
                  isAgent ? "flex-row-reverse" : "flex-row"
                )}>
                   <span className={cn("text-[10px] font-black uppercase tracking-widest", config.color)}>
                     {config.label}
                   </span>
                   <span className="text-[9px] text-slate-600 font-bold font-mono">
                     {line.timestamp ? new Date(line.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Live"}
                   </span>
                </div>

                <div className={cn(
                  "max-w-[85%] px-5 py-4 rounded-3xl border backdrop-blur-xl shadow-xl transition-all",
                  config.bg,
                  isAgent ? "rounded-tr-none" : "rounded-tl-none"
                )}>
                  <p className="text-[14px] leading-relaxed text-white/90 font-medium tracking-tight">
                    {line.text}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        
        {visibleTranscript.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center opacity-30 space-y-4">
            <div className="p-4 rounded-full bg-slate-500/10 border border-slate-500/20">
               <Headphones className="h-8 w-8 text-slate-500" />
            </div>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em]">Waiting for voice activity</p>
          </div>
        )}
      </div>
    </div>
  );
}
