"use client";

import { useState, useCallback } from "react";
import { useCallStore } from "@/store/callStore";
import dynamic from "next/dynamic";
import {
  DEMO_TRANSCRIPT,
  DEMO_SENTIMENT_ARC,
  DEMO_COMPANY_CONFIG,
  DEMO_CALLER_MEMORY,
} from "@/lib/demoScript";
import {
  Play,
  RotateCcw,
  ArrowRight,
  Phone,
  PhoneOff,
  Timer,
  Activity,
  Zap,
  Mic,
  MicOff,
  Pause,
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const LiveTranscript = dynamic(
  () =>
    import("@/components/agent/LiveTranscript").then((mod) => ({
      default: mod.LiveTranscript,
    })),
  { ssr: false }
);
const SentimentGraph = dynamic(
  () =>
    import("@/components/agent/SentimentGraph").then((mod) => ({
      default: mod.SentimentGraph,
    })),
  { ssr: false }
);
const CopilotPanel = dynamic(
  () =>
    import("@/components/agent/CopilotPanel").then((mod) => ({
      default: mod.CopilotPanel,
    })),
  { ssr: false }
);

export default function DemoPage() {
  const { toast } = useToast();
  const callId = useCallStore((s) => s.callId);
  const sentimentLabel = useCallStore((s) => s.sentimentLabel);
  const sentimentScore = useCallStore((s) => s.sentimentScore);
  const activeMode = useCallStore((s) => s.activeMode);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentLine, setCurrentLine] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  const startDemo = useCallback(async () => {
    if (isPlaying) return;

    setIsPlaying(true);
    setCurrentLine(0);
    useCallStore.getState().reset();

    const demoCallId = "demo-call-" + Date.now();
    useCallStore.getState().setCallId(demoCallId);

    for (let i = 0; i < DEMO_TRANSCRIPT.length; i++) {
      const line = DEMO_TRANSCRIPT[i];
      const sentimentIndex = Math.floor(
        (i / DEMO_TRANSCRIPT.length) * DEMO_SENTIMENT_ARC.length
      );
      const sentiment =
        DEMO_SENTIMENT_ARC[
          Math.min(sentimentIndex, DEMO_SENTIMENT_ARC.length - 1)
        ];

      // Create new transcript line entry
      const newEntry = {
        speaker: line.speaker,
        text: "",
        timestamp: new Date().toISOString(),
      };
      useCallStore.getState().appendTranscript(newEntry);

      // Simulate word-by-word streaming
      const words = line.text.split(" ");
      for (let w = 0; w < words.length; w++) {
        await new Promise((resolve) => setTimeout(resolve, 150)); // 150ms per word avg

        const currentTranscript = [...useCallStore.getState().transcript];
        if (currentTranscript.length > 0) {
           currentTranscript[currentTranscript.length - 1].text += (w === 0 ? "" : " ") + words[w];
           useCallStore.getState().updateTranscript(currentTranscript);
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 800)); // Pause between speakers

      useCallStore.getState().setSentimentScore(sentiment);
      useCallStore.getState().setSentimentLabel(
        sentiment >= 60
          ? "happy"
          : sentiment >= 40
            ? "neutral"
            : sentiment >= 20
              ? "frustrated"
              : "escalating"
      );

      // Trigger AI
      try {
        const response = await fetch("/api/ai/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callId: demoCallId,
            newLine: line,
            companyConfig: DEMO_COMPANY_CONFIG,
            callerMemory: DEMO_CALLER_MEMORY,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          useCallStore
            .getState()
            .setIntent(data.intent || "general_inquiry");
          useCallStore
            .getState()
            .setIsPreviousIssue(data.isPreviousIssue || false);
          useCallStore
            .getState()
            .setSuggestions(data.suggestions || []);
          useCallStore
            .getState()
            .setComplianceAlert(data.complianceAlert || false);
          useCallStore
            .getState()
            .setKnowledgeSnippet(data.knowledgeSnippet || "");
        }
      } catch (error) {
        console.error("Demo AI error:", error);
      }

      setCurrentLine(i + 1);
    }

    setIsPlaying(false);

    // Generate summary
    try {
      const transcript = useCallStore.getState().transcript;
      await fetch("/api/ai/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callId: demoCallId,
          transcript,
          companyName: "Aura Demo Company",
        }),
      });
    } catch (error) {
      console.error("Demo summary error:", error);
    }

    toast({
      title: "✓ Demo completed",
      description: "Post-call summary has been generated.",
    });
  }, [isPlaying, toast]);

  const resetDemo = () => {
    setIsPlaying(false);
    setCurrentLine(0);
    useCallStore.getState().reset();
  };

  const progress =
    DEMO_TRANSCRIPT.length > 0
      ? Math.round((currentLine / DEMO_TRANSCRIPT.length) * 100)
      : 0;

  const sentimentColor = !sentimentScore
    ? "text-slate-500"
    : sentimentScore >= 60
      ? "text-emerald-400"
      : sentimentScore >= 40
        ? "text-amber-400"
        : "text-red-400";

  const sentimentBg = !sentimentScore
    ? "bg-slate-500/10"
    : sentimentScore >= 60
      ? "bg-emerald-500/10"
      : sentimentScore >= 40
        ? "bg-amber-500/10"
        : "bg-red-500/10";

  const modeLabel =
    activeMode === "alert" ? "Alert" : activeMode || "Whisper";

  return (
    <div className="min-h-screen bg-[#060a14] text-foreground flex flex-col">
      {/* ─── Demo Banner ─── */}
      <div className="bg-gradient-to-r from-indigo-600/90 via-violet-600/90 to-purple-600/90 px-5 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-lg bg-white/20 flex items-center justify-center">
              <Zap className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">
                AURA AI — Demo Mode
              </h1>
              <p className="text-[10px] text-white/70">
                Simulated call experience with real AI analysis
              </p>
            </div>
          </div>
          <Link href="/company/dashboard">
            <Button
              variant="outline"
              size="sm"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 text-[11px]"
            >
              Company Dashboard
              <ArrowRight className="h-3 w-3 ml-1.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* ─── Demo Controls ─── */}
      <div className="px-5 py-3 border-b border-white/[0.06] bg-white/[0.01]">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={startDemo}
              disabled={isPlaying}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold transition-all duration-200",
                isPlaying
                  ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                  : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/25 hover:bg-indigo-500/30 active:scale-[0.97]"
              )}
            >
              <Play className="h-3.5 w-3.5" />
              {isPlaying
                ? `Playing… ${currentLine}/${DEMO_TRANSCRIPT.length}`
                : "Start Demo"}
            </button>

            <button
              onClick={resetDemo}
              disabled={isPlaying}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold text-slate-400 border border-white/[0.06] hover:bg-white/[0.04] transition-all duration-200 disabled:opacity-40"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>

            {isPlaying && (
              <div className="flex items-center gap-2 ml-2">
                <div className="w-32 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <span className="text-[10px] text-slate-500 font-mono">
                  {progress}%
                </span>
              </div>
            )}
          </div>

          {/* Status indicators */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
              <Timer className="h-3 w-3 text-slate-500" />
              <span className="text-[11px] font-mono text-white/70 tabular-nums">
                {callId
                  ? `${String(Math.floor((currentLine * 2) / 60)).padStart(2, "0")}:${String((currentLine * 2) % 60).padStart(2, "0")}`
                  : "00:00"}
              </span>
            </div>

            <div
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.06]",
                sentimentBg
              )}
            >
              <Activity className="h-3 w-3 text-slate-500" />
              <span
                className={cn(
                  "text-[11px] font-bold capitalize",
                  sentimentColor
                )}
              >
                {sentimentLabel || "—"}
              </span>
            </div>

            {callId && (
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center transition-all",
                  isMuted
                    ? "bg-red-500/20 text-red-400 border border-red-500/20"
                    : "bg-white/[0.04] text-slate-400 border border-white/[0.06]"
                )}
              >
                {isMuted ? (
                  <MicOff className="h-3.5 w-3.5" />
                ) : (
                  <Mic className="h-3.5 w-3.5" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Main Content ─── */}
      <div className="flex-1 flex min-h-0 p-4 gap-4 max-w-7xl mx-auto w-full">
        {/* Left: Transcript + Sentiment */}
        <div className="flex-[3] flex flex-col gap-4 min-h-0">
          <div className="flex-1 min-h-0">
            <LiveTranscript />
          </div>
          <SentimentGraph />
        </div>

        {/* Right: Copilot */}
        <div className="flex-[2] min-h-0">
          <CopilotPanel />
        </div>
      </div>
    </div>
  );
}