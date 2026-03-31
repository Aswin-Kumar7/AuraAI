"use client";

import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

interface SuggestionCardProps {
  callId: string | null;
  suggestion: {
    text: string;
    tone?: string;
    rank: number;
  };
  dimmed?: boolean;
}

export function SuggestionCard({ callId, suggestion, dimmed }: SuggestionCardProps) {
  const { toast } = useToast();
  const [used, setUsed] = useState(false);
  const [copying, setCopying] = useState(false);

  const isTop = suggestion.rank === 1;

  const handleUse = async () => {
    if (!callId || used) return;

    try {
      await navigator.clipboard.writeText(suggestion.text);
      setCopying(true);
      setTimeout(() => setCopying(false), 1500);
    } catch {
      // clipboard may not be available
    }

    try {
      const res = await fetch("/api/audit/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callId,
          suggestionText: suggestion.text,
          suggestionRank: suggestion.rank,
          agentUsed: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record action");
      setUsed(true);
      toast({ title: "✓ Suggestion used", description: "Copied to clipboard & logged." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div
      className={cn(
        "relative group flex flex-col gap-1.5 px-4 py-3 border-b border-slate-100 last:border-0 transition-colors",
        dimmed ? "opacity-40" : "hover:bg-slate-50/70",
        used && "bg-emerald-50/30"
      )}
    >
      {/* Left accent bar for best suggestion */}
      {isTop && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-10 bg-indigo-500 rounded-r-full" />
      )}

      {/* Metadata row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {isTop ? (
            <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
              Best
            </span>
          ) : (
            <span className="text-[9px] font-bold text-slate-300">#{suggestion.rank}</span>
          )}
          {suggestion.tone && (
            <span className="text-[10px] text-slate-400 capitalize">{suggestion.tone}</span>
          )}
        </div>
        <button
          type="button"
          onClick={handleUse}
          disabled={!callId || used}
          className={cn(
            "flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-all",
            "opacity-0 group-hover:opacity-100",
            used
              ? "bg-emerald-50 text-emerald-600 border border-emerald-200 !opacity-100"
              : "bg-indigo-600 text-white hover:bg-indigo-700",
            (!callId || dimmed) && "opacity-40 pointer-events-none"
          )}
        >
          {used ? (
            <><Check className="h-2.5 w-2.5" /> Used</>
          ) : copying ? (
            <><Check className="h-2.5 w-2.5" /> Copied!</>
          ) : (
            <><Copy className="h-2.5 w-2.5" /> Use</>
          )}
        </button>
      </div>

      {/* Suggestion text */}
      <p className="text-[12.5px] leading-relaxed text-slate-600">{suggestion.text}</p>
    </div>
  );
}
