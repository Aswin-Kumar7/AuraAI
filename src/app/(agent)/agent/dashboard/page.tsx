"use client";

import { useEffect, useState, useCallback } from "react";
import { useCallStore } from "@/store/callStore";
import { useLiveCall } from "@/hooks/useLiveCall";
import dynamic from "next/dynamic";
import { IncomingCallModal } from "@/components/agent/IncomingCallModal";
import { CallerMemoryBadge } from "@/components/agent/CallerMemoryBadge";
import { useToast } from "@/hooks/use-toast";
import { getAuth } from "firebase/auth";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Timer,
  Activity,
  Zap,
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  Pause,
  Sparkles,
  FlaskConical,
} from "lucide-react";

import { OutboundCallModal } from "@/components/agent/OutboundCallModal";
import { useTwilioClient } from "@/hooks/useTwilioClient";

const LiveTranscript = dynamic(
  () =>
    import("@/components/agent/LiveTranscript").then((mod) => ({
      default: mod.LiveTranscript,
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
const IntentPanel = dynamic(
  () =>
    import("@/components/agent/IntentPanel").then((mod) => ({
      default: mod.IntentPanel,
    })),
  { ssr: false }
);
const KnowledgeRetrievalPanel = dynamic(
  () =>
    import("@/components/agent/KnowledgeRetrievalPanel").then((mod) => ({
      default: mod.KnowledgeRetrievalPanel,
    })),
  { ssr: false }
);
const MOCK_ANALYSIS = {
  callId: "sim-demo-001",
  intent: "billing_issue",
  intentConfidence: 0.92,
  inferredNeed: "Customer wants a refund for a duplicate charge on their last invoice.",
  customerDisposition: "angry" as const,
  isPreviousIssue: true,
  sentimentScore: 22,
  sentimentLabel: "frustrated",
  escalationRisk: 0.75,
  escalationReason: "Repeat caller, frustrated tone",
  interventionSuggestion: "Offer immediate refund and apology",
  policySuggestion: "As per refund policy §3.2, duplicate charges are eligible for same-day refund. Verify the charge ID and process via the billing portal.",
  policyMatchScore: 0.88,
  suggestions: [
    { text: "I can see the duplicate charge on your account. I'm processing your refund now and you'll receive a confirmation email within the hour.", tone: "apologetic", rank: 1, resolutionLikelihood: 0.91 },
    { text: "I sincerely apologize for this billing error. Our refund team will reverse the charge today. Can I confirm the best email for your receipt?", tone: "empathetic", rank: 2, resolutionLikelihood: 0.78 },
    { text: "Thank you for bringing this to our attention. I have initiated the refund. Is there anything else I can help you with today?", tone: "professional", rank: 3, resolutionLikelihood: 0.61 },
  ],
  intentTrend: [
    { intent: "general_inquiry", confidence: 0.45, policyMatchScore: 0.3, timestamp: new Date(Date.now() - 60000).toISOString() },
    { intent: "billing_issue", confidence: 0.68, policyMatchScore: 0.55, timestamp: new Date(Date.now() - 40000).toISOString() },
    { intent: "billing_issue", confidence: 0.85, policyMatchScore: 0.72, timestamp: new Date(Date.now() - 20000).toISOString() },
    { intent: "billing_issue", confidence: 0.92, policyMatchScore: 0.88, timestamp: new Date().toISOString() },
  ],
  knowledgeCandidates: [
    "Refund Policy §3.2: Duplicate charges are eligible for same-day reversal when reported within 30 days.",
    "Billing Disputes: Agents must verify the charge ID in CRM before initiating any refund.",
    "Customer Retention: Offer a goodwill credit for customers who have experienced billing errors.",
  ],
  complianceAlert: false,
  complianceReason: "",
  complianceSeverity: "info",
  knowledgeSnippet: "Duplicate charges: same-day refund eligible. Verify via billing portal.",
  isRepeatCaller: true,
  activeMode: "alert" as const,
  liveSummary: "[SIMULATION] Customer frustrated about duplicate charge, requesting refund.",
  sentimentArc: [60, 50, 38, 28, 22],
};

export default function AgentDashboardPage() {
  const { incomingCall } = useLiveCall();
  const { toast } = useToast();
  const callId = useCallStore((s) => s.callId);
  const intent = useCallStore((s) => s.intent);
  const intentConfidence = useCallStore((s) => s.intentConfidence);
  const customerDisposition = useCallStore((s) => s.customerDisposition);
  const sentimentLabel = useCallStore((s) => s.sentimentLabel);
  const sentimentScore = useCallStore((s) => s.sentimentScore);
  const activeMode = useCallStore((s) => s.activeMode);
  const transcript = useCallStore((s) => s.transcript);
  const updateAnalysis = useCallStore((s) => s.updateAnalysis);
  const updateTranscript = useCallStore((s) => s.updateTranscript);
  const [isSimulating, setIsSimulating] = useState(false);

  const simulateLiveData = useCallback(() => {
    setIsSimulating(true);
    updateTranscript([
      { speaker: "customer", text: "Hello, I was charged twice on my last invoice and I need this resolved immediately.", timestamp: new Date(Date.now() - 90000).toISOString() },
      { speaker: "agent", text: "I understand your frustration. Let me pull up your account right now.", timestamp: new Date(Date.now() - 75000).toISOString() },
      { speaker: "customer", text: "This is the second time this has happened. I'm very upset about this.", timestamp: new Date(Date.now() - 60000).toISOString() },
      { speaker: "agent", text: "I sincerely apologize. I can see the duplicate charge on your account.", timestamp: new Date(Date.now() - 45000).toISOString() },
      { speaker: "customer", text: "I want a refund of the duplicate amount as per your refund policy.", timestamp: new Date(Date.now() - 30000).toISOString() },
    ]);
    updateAnalysis({ ...MOCK_ANALYSIS, callId: "sim-demo-001" });
    toast({ title: "Simulation active", description: "All panels are now populated with mock live call data." });
    setTimeout(() => setIsSimulating(false), 500);
  }, [updateAnalysis, updateTranscript, toast]);

  const [callStartTime, setCallStartTime] = useState<Date | null>(null);
  const [now, setNow] = useState<Date | null>(null); // Start with null for SSR safety
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [isOutboundOpen, setIsOutboundOpen] = useState(false);

  // Initialize client-side state after mount
  useEffect(() => {
    setNow(new Date());
  }, []);

  // Load Twilio WebRTC Voice Dialer
  const { makeCall, endCall, toggleMute, isReady: dialerReady } = useTwilioClient();

  // Sync mute state with Twilio
  useEffect(() => {
    toggleMute(isMuted || isOnHold);
  }, [isMuted, isOnHold, toggleMute]);

  // Timer
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Track call start
  useEffect(() => {
    if (callId && !callStartTime) {
      setCallStartTime(new Date());
    }
    if (!callId) {
      setCallStartTime(null);
    }
  }, [callId, callStartTime]);

  const seconds = (callStartTime && now)
    ? Math.max(0, Math.floor((now.getTime() - callStartTime.getTime()) / 1000))
    : 0;
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  const conferenceSid = useCallStore((s) => s.conferenceSid);
  const customerParticipantSid = useCallStore((s) => s.customerParticipantSid);

  const handleHoldToggle = useCallback(async () => {
    if (!callId || !conferenceSid || !customerParticipantSid) {
       // Fallback for simple mute if conference data isn't ready
       setIsOnHold(!isOnHold);
       return;
    }

    try {
      const nextHold = !isOnHold;
      const res = await fetch("/api/twilio/conference/hold", {
        method: "POST",
        body: JSON.stringify({
          conferenceSid,
          participantSid: customerParticipantSid,
          hold: nextHold
        })
      });

      if (!res.ok) throw new Error("Failed to toggle hold");

      setIsOnHold(nextHold);
      toast({ 
        title: nextHold ? "Call on Hold" : "Call Resumed",
        description: nextHold ? "Customer is hearing the hold notice." : "Customer is back on the line."
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown hold error";
      toast({ title: "Hold Error", description: message, variant: "destructive" });
    }
  }, [callId, conferenceSid, customerParticipantSid, isOnHold, toast]);

  const resetCall = useCallStore((s) => s.resetCall);

  const handleEndCall = useCallback(async () => {
    if (!callId) return;

    // Simulation calls are local-only — no Twilio/Firestore to clean up
    if (callId.startsWith("sim-")) {
      resetCall();
      endCall();
      toast({ title: "Simulation ended", description: "Dashboard reset to standby." });
      return;
    }

    try {
      const auth = getAuth();
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Not authenticated");

      const res = await fetch(`/api/calls/${callId}/end`, {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to end call");
      }

      toast({ title: "Call ended" });
      endCall(); // If WebRTC is active
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown end call error";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  }, [callId, endCall, resetCall, toast]);

  const liveSummary = useCallStore((s) => s.liveSummary);

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
    activeMode === "alert"
      ? "Alert"
      : activeMode === "auto"
        ? "Auto"
        : "Whisper";

  return (
    <div className="flex flex-col h-full">
      {/* ─── Top Status Bar ─── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-white shadow-sm">
        {/* Left: Caller info */}
        <div className="flex items-center gap-3">
          {/* Status dot */}
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                callId
                  ? "bg-emerald-500 shadow-md shadow-emerald-400/40 animate-pulse"
                  : "bg-slate-300"
              )}
            />
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">
                {callId ? "Live Call" : "Standby"}
              </p>
              <p className="text-sm font-semibold text-slate-800">
                {callId
                  ? `Call ${callId.slice(-8)}`
                  : "Waiting for incoming call…"}
              </p>
            </div>
          </div>

          {/* Caller memory */}
          <CallerMemoryBadge />
        </div>

        {/* Center: Make Call Shortcut */}
        {!callId && (
           <div className="absolute left-1/2 -translate-x-1/2 animate-in fade-in zoom-in duration-300">
             <button
               disabled={!dialerReady}
               onClick={() => setIsOutboundOpen(true)}
               className="group flex items-center gap-2 px-6 py-2 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-md shadow-indigo-500/20 active:scale-95 transition-all text-sm disabled:opacity-50 disabled:pointer-events-none"
             >
               <PhoneCall className="h-4 w-4 fill-white flex-shrink-0 group-hover:animate-bounce" />
               {dialerReady ? " Make call" : "Voice Initializing..."}
             </button>
           </div>
        )}

        {/* Right: Stats + Controls */}
        <div className="flex items-center gap-2">
          {/* Timer */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200">
            <Timer className="h-3 w-3 text-slate-400" />
            <span
              className={cn(
                "font-mono text-sm font-bold tabular-nums",
                callId ? "text-slate-800" : "text-slate-400"
              )}
            >
              {mm}:{ss}
            </span>
          </div>

          {/* Mode */}
          <div
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold",
              activeMode === "alert"
                ? "bg-red-50 border-red-200 text-red-600"
                : "bg-slate-100 border-slate-200 text-slate-500"
            )}
          >
            <Zap className="h-3 w-3" />
            <span>{modeLabel}</span>
          </div>

          {/* Sentiment */}
          <div
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold",
              !sentimentScore
                ? "bg-slate-100 border-slate-200 text-slate-500"
                : sentimentScore >= 60
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : sentimentScore >= 40
                ? "bg-amber-50 border-amber-200 text-amber-700"
                : "bg-red-50 border-red-200 text-red-700"
            )}
          >
            <Activity className="h-3 w-3" />
            <span className="capitalize">
              {customerDisposition || sentimentLabel || "—"}
            </span>
            {sentimentScore !== null && (
              <span className="font-mono">{sentimentScore}</span>
            )}
          </div>

          {/* Intent */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50">
            <Zap className="h-3 w-3 text-indigo-600" />
            <span className="text-[11px] font-semibold text-indigo-700 capitalize">
              {intent ? intent.replace(/_/g, " ") : "intent pending"}
            </span>
            {typeof intentConfidence === "number" && (
              <span className="text-[10px] font-mono text-indigo-500">
                {Math.round(intentConfidence * 100)}%
              </span>
            )}
          </div>

          {/* Call Controls */}
          {callId && (
            <div className="flex items-center gap-1 ml-1">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center transition-all duration-200 border",
                  isMuted
                    ? "bg-red-50 text-red-600 border-red-200"
                    : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                )}
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? (
                  <MicOff className="h-3.5 w-3.5" />
                ) : (
                  <Mic className="h-3.5 w-3.5" />
                )}
              </button>

              <button
                onClick={handleHoldToggle}
                className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center transition-all duration-200 border",
                  isOnHold
                    ? "bg-amber-50 text-amber-600 border-amber-200"
                    : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                )}
                title={isOnHold ? "Resume" : "Hold"}
              >
                {isOnHold ? (
                  <Play className="h-3.5 w-3.5" />
                ) : (
                  <Pause className="h-3.5 w-3.5" />
                )}
              </button>

              <button
                onClick={handleEndCall}
                className="h-8 px-4 rounded-lg bg-red-50 text-red-600 border border-red-200 text-[11px] font-semibold flex items-center gap-1.5 hover:bg-red-100 active:scale-[0.97] transition-all duration-200"
              >
                <PhoneOff className="h-3.5 w-3.5" />
                End
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── Live Summary Sub-header ─── */}
      <AnimatePresence>
        {callId && liveSummary && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-indigo-50 border-b border-indigo-100"
          >
            <div className="px-5 py-2.5 flex items-center gap-3">
               <div className="h-5 w-5 rounded-md bg-indigo-100 flex items-center justify-center border border-indigo-200">
                  <Sparkles className="h-3 w-3 text-indigo-600" />
               </div>
               <p className="text-xs font-medium text-indigo-700 italic">
                  &quot;{liveSummary}&quot;
               </p>
               <div className="ml-auto px-2 py-0.5 rounded-full bg-indigo-100 border border-indigo-200">
                  <span className="text-[9px] font-bold text-indigo-600 uppercase tracking-tighter">Live AI Status</span>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Main Content Grid ─── */}
      <div className="flex-1 flex min-h-0 p-4 gap-4 overflow-hidden">
        {/* LEFT 60%: Transcript — Primary Card */}
        <div className="flex-[3] min-h-0">
          <LiveTranscript />
        </div>

        {/* RIGHT 40%: AI Suggestions (Primary Card) + flat sections */}
        <div className="flex-[2] flex flex-col min-h-0 overflow-y-auto scrollbar-thin">
          {!callId && (
            <button
              type="button"
              onClick={simulateLiveData}
              disabled={isSimulating}
              className="flex items-center justify-center gap-2 w-full px-4 py-2 mb-3 rounded-xl border border-dashed border-slate-300 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700 text-[12px] font-medium transition-colors disabled:opacity-60"
            >
              <FlaskConical className="h-3.5 w-3.5" />
              {isSimulating ? "Loading simulation…" : "Simulate Live Call Data"}
            </button>
          )}
          <CopilotPanel />
          <IntentPanel />
          <KnowledgeRetrievalPanel />
        </div>
      </div>

      {/* ─── Bottom Stats Bar (when idle) ─── */}
      {!callId && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-5 py-3 border-t border-slate-200 bg-white"
        >
          <div className="flex items-center justify-center gap-8 text-center">
            <div>
              <p className="text-lg font-bold text-slate-800">
                {transcript.length}
              </p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                Messages Today
              </p>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div>
              <p className="text-lg font-bold text-slate-800">0</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                Calls Queued
              </p>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div>
              <p className="text-lg font-bold text-emerald-600">Ready</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                Status
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* ─── Incoming Call Modal ─── */}
      {incomingCall && (
        <IncomingCallModal
          callId={incomingCall.callId}
          callerPhone={incomingCall.callerPhone}
          onClose={() => {}}
        />
      )}

      {/* ─── Outbound Dialer Modal ─── */}
      <OutboundCallModal
        isOpen={isOutboundOpen}
        onClose={() => setIsOutboundOpen(false)}
        isDialerReady={dialerReady}
        onCall={(params) => makeCall(params)}
      />
    </div>
  );
}
