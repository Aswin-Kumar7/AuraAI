"use client";

import { useEffect, useRef } from "react";
import { useCallStore } from "@/store/callStore";
import { cn } from "@/lib/utils";
import { Headphones, UserRound, ShieldCheck, Activity } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const speakerConfig: Record<
  string,
  { label: string; icon: typeof Headphones; color: string; bg: string }
> = {
  agent: {
    label: "Agent",
    icon: Headphones,
    color: "text-indigo-400",
    bg: "bg-indigo-500/10 border-indigo-500/20",
  },
  customer: {
    label: "Customer",
    icon: UserRound,
    color: "text-slate-300",
    bg: "bg-transparent border-transparent",
  },
  supervisor: {
    label: "Supervisor",
    icon: ShieldCheck,
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
};

export function LiveTranscript() {
  const transcript = useCallStore((s) => s.transcript);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [transcript.length]);

  return (
    <div className="flex flex-col h-full rounded-2xl border border-white/[0.06] bg-[#0a0e1a]/90 backdrop-blur-md overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08] bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </div>
          <span className="text-xs font-bold text-white tracking-widest uppercase">
            Live Stream
          </span>
        </div>
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06]">
          <Activity className="h-3 w-3 text-indigo-400" />
          <span className="text-[10px] text-slate-400 font-mono font-medium tracking-wider">
            {transcript.length} turns
          </span>
        </div>
      </div>

      {/* Transcript Scrolling Area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin scrollbar-thumb-white/10"
      >
        <AnimatePresence initial={false}>
          {transcript.map((line, idx) => {
            const config = speakerConfig[line.speaker] || speakerConfig.customer;
            const Icon = config.icon;

            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className={cn(
                  "flex items-start gap-4 p-3 rounded-xl border transition-colors",
                  config.bg
                )}
              >
                {/* Speaker Avatar Icon */}
                <div className="mt-0.5 shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-white/[0.04] border border-white/[0.08]">
                  <Icon className={cn("h-4 w-4", config.color)} />
                </div>

                {/* Dialog Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn("text-xs font-semibold uppercase tracking-wider", config.color)}>
                      {config.label}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {line.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[15px] leading-relaxed text-white/90 font-medium">
                    {line.text}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        
        {/* Empty state or typing indicator pulse */}
        {transcript.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center opacity-50">
            <Activity className="h-8 w-8 text-slate-500 mb-3" />
            <p className="text-sm text-slate-500 font-medium">Waiting for call stream to begin...</p>
          </div>
        )}
      </div>
    </div>
  );
}
