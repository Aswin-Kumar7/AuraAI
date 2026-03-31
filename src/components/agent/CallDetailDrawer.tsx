"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { FileText, MessageSquare, Brain, Phone, Clock, Loader2, Star } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface Call {
  callId: string;
  callerPhone: string;
  transcript: Array<{
    speaker: string;
    text: string;
    timestamp: string;
  }>;
  sentimentArc: Array<{
    score: number;
    timestamp: string;
  }>;
  duration: number;
  status: string;
  summary: any;
  issueCategory: string;
  resolved: boolean;
  createdAt: string;
}

interface CallDetailDrawerProps {
  callId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CallDetailDrawer({
  callId,
  open,
  onOpenChange,
}: CallDetailDrawerProps) {
  const [call, setCall] = useState<Call | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"summary" | "transcript" | "aiLog">("summary");
  const { toast } = useToast();

  useEffect(() => {
    if (callId && open) {
      setCall(null);
      setActiveTab("summary");
      fetchCall();
    }
  }, [callId, open]);

  const fetchCall = async () => {
    if (!callId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/agent/calls/${callId}`);
      if (res.ok) {
        const data = await res.json();
        setCall(data);
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch call details.",
          variant: "destructive",
        });
        onOpenChange(false);
      }
    } catch {
      toast({
        title: "Error",
        description: "Could not load call details.",
        variant: "destructive",
      });
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const getSentimentEmoji = (score: number) => {
    if (score >= 60) return "😊";
    if (score >= 40) return "😐";
    return "😤";
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl bg-[#0a0e1a] border-white/[0.08] p-0 flex flex-col sm:max-w-xl md:max-w-2xl">
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/[0.08] bg-white/[0.02]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-white/90">
              <Phone className="h-4 w-4 text-indigo-400" />
              Call Details
              {callId && (
                <span className="text-xs font-mono text-slate-500 font-normal">
                  #{callId.slice(-8)}
                </span>
              )}
            </SheetTitle>
            <SheetDescription className="text-slate-400">
              Review transcript, AI summary, and sentiment timeline.
            </SheetDescription>
          </SheetHeader>
        </div>

        {/* Navigation Tabs */}
        <div className="flex px-4 pt-2 border-b border-white/[0.08]">
          {[
            { id: "summary", label: "Summary", icon: FileText },
            { id: "transcript", label: "Transcript", icon: MessageSquare },
            { id: "aiLog", label: "AI Log", icon: Brain },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all relative",
                activeTab === tab.id
                  ? "text-indigo-400"
                  : "text-slate-400 hover:text-white"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="h-6 w-6 text-indigo-400 animate-spin" />
            </div>
          ) : !call ? (
            <div className="text-center py-10 text-slate-500">
              No data available.
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* ─── SUMMARY TAB ─── */}
                {activeTab === "summary" && (
                  <div className="space-y-6">
                    {/* Status badges row */}
                    <div className="flex flex-wrap gap-2">
                      <div className="px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-semibold text-white/80">
                        {call.callerPhone}
                      </div>
                      <div
                        className={cn(
                          "px-3 py-1 rounded-full border text-xs font-semibold",
                          call.status === "completed"
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                            : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                        )}
                      >
                        {call.status}
                      </div>
                      <div
                        className={cn(
                          "px-3 py-1 rounded-full border text-xs font-semibold",
                          call.resolved
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                            : "bg-red-500/10 border-red-500/20 text-red-400"
                        )}
                      >
                        {call.resolved ? "Resolved" : "Unresolved"}
                      </div>
                      <div className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-semibold text-indigo-400">
                        {call.issueCategory || "Categorizing..."}
                      </div>
                      <div className="px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-medium text-slate-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {call.duration
                          ? `${Math.round(call.duration / 60)}m ${call.duration % 60}s`
                          : "N/A"}
                      </div>
                    </div>

                    {/* AI Summary Structured Card */}
                    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
                      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
                        <Brain className="h-4 w-4 text-primary" />
                        <h4 className="text-sm font-semibold text-white/90">
                          AI Post-Call Summary
                        </h4>
                      </div>
                      <div className="p-4 space-y-4 text-sm">
                        {call.summary ? (
                          <>
                            <div>
                              <span className="text-slate-400 text-xs uppercase tracking-wide font-semibold block mb-1">
                                Brief Overview
                              </span>
                              <p className="text-white/80 leading-relaxed">
                                {call.summary.briefSummary || (call.summary as any).summary || "No brief summary available."}
                              </p>
                            </div>

                            <div>
                              <span className="text-slate-400 text-xs uppercase tracking-wide font-semibold block mb-1">
                                Customer Sentiment
                              </span>
                              <p className="text-white/80 capitalize">
                                {call.summary.customerSentiment || "Unknown"}
                              </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <span className="text-slate-400 text-xs uppercase tracking-wide font-semibold block mb-1">
                                  Resolution Action
                                </span>
                                <p className="text-white/80">
                                  {call.summary.resolutionAction || "None"}
                                </p>
                              </div>
                              <div>
                                <span className="text-slate-400 text-xs uppercase tracking-wide font-semibold block mb-1">
                                  Call Quality Score
                                </span>
                                <div className="flex items-center gap-1">
                                  <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                                  <span className="text-white/90 font-bold">
                                    {call.summary.callQualityScore || "N/A"}
                                  </span>
                                  <span className="text-slate-500 text-xs">/5</span>
                                </div>
                              </div>
                            </div>

                            {call.summary.nextSteps &&
                              call.summary.nextSteps.length > 0 && (
                                <div>
                                  <span className="text-slate-400 text-xs uppercase tracking-wide font-semibold block mb-2">
                                    Follow-up Required
                                  </span>
                                  <ul className="list-disc pl-4 space-y-1">
                                    {call.summary.nextSteps.map(
                                      (step: string, i: number) => (
                                        <li key={i} className="text-white/80">
                                          {step}
                                        </li>
                                      )
                                    )}
                                  </ul>
                                </div>
                              )}
                          </>
                        ) : (
                          <div className="text-slate-500 italic text-center py-4">
                            Summary generation pending or failed.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── TRANSCRIPT TAB ─── */}
                {activeTab === "transcript" && (
                  <div className="space-y-4">
                    {call.transcript.length > 0 ? (
                      call.transcript.map((line, index) => {
                        const isAgent = line.speaker === "agent";
                        return (
                          <div
                            key={index}
                            className={cn(
                              "flex gap-3 max-w-[85%]",
                              isAgent ? "ml-auto flex-row-reverse" : "mr-auto"
                            )}
                          >
                            <div
                              className={cn(
                                "flex-1 rounded-2xl p-3 text-sm",
                                isAgent
                                  ? "bg-indigo-500/15 border border-indigo-500/20 text-white/90 rounded-tr-sm"
                                  : "bg-white/[0.04] border border-white/[0.08] text-white/80 rounded-tl-sm"
                              )}
                            >
                              <div
                                className={cn(
                                  "flex items-center gap-2 mb-1",
                                  isAgent ? "justify-end" : "justify-start"
                                )}
                              >
                                <span
                                  className={cn(
                                    "text-[10px] font-bold uppercase",
                                    isAgent ? "text-indigo-400" : "text-slate-400"
                                  )}
                                >
                                  {isAgent ? "You" : "Caller"}
                                </span>
                                <span className="text-[9px] text-slate-500 font-mono">
                                  {new Date(line.timestamp).toLocaleTimeString()}
                                </span>
                              </div>
                              <p className="leading-relaxed">{line.text}</p>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-8 text-slate-500">
                        No transcript recorded.
                      </div>
                    )}
                  </div>
                )}

                {/* ─── AI LOG TAB ─── */}
                {activeTab === "aiLog" && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
                        Sentiment Timeline
                      </h3>
                      {call.sentimentArc && call.sentimentArc.length > 0 ? (
                        <div className="space-y-3">
                          {call.sentimentArc.map((point, index) => {
                            const colorClass =
                              point.score >= 60
                                ? "bg-emerald-500"
                                : point.score >= 40
                                  ? "bg-amber-500"
                                  : "bg-red-500";
                            return (
                              <div
                                key={index}
                                className="flex items-center gap-4 bg-white/[0.02] border border-white/[0.06] rounded-lg p-3"
                              >
                                <div className="text-xs text-slate-500 font-mono w-20 shrink-0">
                                  {new Date(point.timestamp).toLocaleTimeString(
                                    [],
                                    { hour: "2-digit", minute: "2-digit" }
                                  )}
                                </div>
                                <div className="text-lg w-6 shrink-0 text-center">
                                  {getSentimentEmoji(point.score)}
                                </div>
                                <div className="flex-1 h-2 bg-white/[0.05] rounded-full overflow-hidden">
                                  <div
                                    className={`h-full ${colorClass}`}
                                    style={{ width: `${point.score}%` }}
                                  />
                                </div>
                                <div className="text-xs font-bold text-white/80 w-10 text-right tabular-nums">
                                  {point.score}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-slate-500 text-sm">
                          No sentiment data.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}