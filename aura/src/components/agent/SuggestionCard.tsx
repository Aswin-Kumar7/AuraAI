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

const rankStyles: Record<number, { bg: string; text: string; label: string }> = {
  1: { bg: "from-amber-500/20 to-yellow-500/20", text: "text-amber-400", label: "Best" },
  2: { bg: "from-slate-400/15 to-slate-500/15", text: "text-slate-400", label: "#2" },
  3: { bg: "from-orange-800/15 to-amber-800/15", text: "text-orange-400/70", label: "#3" },
};

const toneEmoji: Record<string, string> = {
  empathetic: "💚",
  firm: "🔵",
  informational: "⚪",
  apologetic: "🙏",
  reassuring: "🤝",
  professional: "💼",
};

export function SuggestionCard({ callId, suggestion, dimmed }: SuggestionCardProps) {
  const { toast } = useToast();
  const [used, setUsed] = useState(false);
  const [copying, setCopying] = useState(false);

  const rank = rankStyles[suggestion.rank] || rankStyles[3];

  const handleUse = async () => {
    if (!callId || used) return;

    // Copy to clipboard
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
        "rounded-xl border bg-white/[0.03] p-3 space-y-2 transition-all duration-200 group",
        dimmed
          ? "opacity-50 border-white/[0.04]"
          : "border-white/[0.08] hover:border-indigo-500/20 hover:bg-white/[0.05]",
        used && "border-emerald-500/20 bg-emerald-500/[0.04]"
      )}
    >
      {/* Top row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-gradient-to-r",
              rank.bg,
              rank.text
            )}
          >
            {rank.label}
          </span>
          {suggestion.tone && (
            <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
              {toneEmoji[suggestion.tone.toLowerCase()] || "💬"}{" "}
              <span className="capitalize">{suggestion.tone}</span>
            </span>
          )}
        </div>
        {used && (
          <span className="text-[9px] text-emerald-400 font-semibold flex items-center gap-0.5">
            <Check className="h-2.5 w-2.5" /> Used
          </span>
        )}
      </div>

      {/* Text */}
      <p className="text-[12.5px] leading-relaxed text-white/80">{suggestion.text}</p>

      {/* Action */}
      <button
        type="button"
        onClick={handleUse}
        disabled={!callId || used}
        className={cn(
          "w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200",
          used
            ? "bg-emerald-500/10 text-emerald-400 cursor-default"
            : "bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25 active:scale-[0.98]",
          (!callId || dimmed) && "opacity-40 pointer-events-none"
        )}
      >
        {used ? (
          <>
            <Check className="h-3 w-3" /> Used
          </>
        ) : copying ? (
          <>
            <Check className="h-3 w-3" /> Copied!
          </>
        ) : (
          <>
            <Copy className="h-3 w-3" /> Use This
          </>
        )}
      </button>
    </div>
  );
}
