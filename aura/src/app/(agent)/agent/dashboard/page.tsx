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

export default function AgentDashboardPage() {
  const { incomingCall } = useLiveCall();
  const { toast } = useToast();
  const callId = useCallStore((s) => s.callId);
  const sentimentLabel = useCallStore((s) => s.sentimentLabel);
  const sentimentScore = useCallStore((s) => s.sentimentScore);
  const activeMode = useCallStore((s) => s.activeMode);
  const transcript = useCallStore((s) => s.transcript);

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

  const handleEndCall = useCallback(async () => {
    if (!callId) return;
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
  }, [callId, endCall, toast]);

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
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] bg-white/[0.01]">
        {/* Left: Caller info */}
        <div className="flex items-center gap-3">
          {/* Status dot */}
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                callId
                  ? "bg-emerald-400 shadow-lg shadow-emerald-400/30 animate-pulse"
                  : "bg-slate-600"
              )}
            />
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">
                {callId ? "Live Call" : "Standby"}
              </p>
              <p className="text-sm font-semibold text-white/90">
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
               // Wait for device to be ready to prevent calling without token loaded
               disabled={!dialerReady}
               onClick={() => setIsOutboundOpen(true)}
               className="group flex items-center gap-2 px-6 py-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white font-semibold shadow-lg shadow-indigo-500/20 active:scale-95 transition-all text-sm disabled:opacity-50 disabled:pointer-events-none border border-indigo-400/20"
             >
               <PhoneCall className="h-4 w-4 fill-white flex-shrink-0 group-hover:animate-bounce" />
               {dialerReady ? " Make call" : "Voice Initializing..."}
             </button>
           </div>
        )}

        {/* Right: Stats + Controls */}
        <div className="flex items-center gap-3">
          {/* Timer */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
            <Timer className="h-3 w-3 text-slate-500" />
            <span
              className={cn(
                "font-mono text-sm font-bold tabular-nums",
                callId ? "text-white" : "text-slate-600"
              )}
            >
              {mm}:{ss}
            </span>
          </div>

          {/* Mode */}
          <div
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border",
              activeMode === "alert"
                ? "bg-red-500/10 border-red-500/20 text-red-400"
                : "bg-white/[0.04] border-white/[0.06] text-slate-400"
            )}
          >
            <Zap className="h-3 w-3" />
            <span className="text-[11px] font-semibold">{modeLabel}</span>
          </div>

          {/* Sentiment */}
          <div
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.06]",
              sentimentBg
            )}
          >
            <Activity className="h-3 w-3 text-slate-500" />
            <span className={cn("text-[11px] font-bold capitalize", sentimentColor)}>
              {sentimentLabel || "—"}
            </span>
            {sentimentScore !== null && (
              <span className={cn("text-[10px] font-mono", sentimentColor)}>
                {sentimentScore}
              </span>
            )}
          </div>

          {/* Call Controls */}
          {callId && (
            <div className="flex items-center gap-1 ml-1">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center transition-all duration-200",
                  isMuted
                    ? "bg-red-500/20 text-red-400 border border-red-500/20"
                    : "bg-white/[0.04] text-slate-400 border border-white/[0.06] hover:bg-white/[0.06]"
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
                  "h-8 w-8 rounded-lg flex items-center justify-center transition-all duration-200",
                  isOnHold
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/20"
                    : "bg-white/[0.04] text-slate-400 border border-white/[0.06] hover:bg-white/[0.06]"
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
                className="h-8 px-4 rounded-lg bg-red-500/20 text-red-400 border border-red-500/25 text-[11px] font-semibold flex items-center gap-1.5 hover:bg-red-500/30 active:scale-[0.97] transition-all duration-200"
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
            className="overflow-hidden bg-indigo-500/5 border-b border-indigo-500/10"
          >
            <div className="px-5 py-2.5 flex items-center gap-3">
               <div className="h-5 w-5 rounded-md bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                  <Sparkles className="h-3 w-3 text-indigo-400" />
               </div>
               <p className="text-xs font-medium text-indigo-100 italic">
                  &quot;{liveSummary}&quot;
               </p>
               <div className="ml-auto px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                  <span className="text-[9px] font-bold text-indigo-300 uppercase tracking-tighter">Live AI Status</span>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Main Content Grid ─── */}
      <div className="flex-1 flex min-h-0 p-4 gap-4">
        {/* Left Panel: Transcript + Sentiment */}
        <div className="flex-[3] flex flex-col gap-4 min-h-0">
          <div className="flex-1 min-h-0">
            <LiveTranscript />
          </div>
          <SentimentGraph />
        </div>

        {/* Right Panel: Copilot */}
        <div className="flex-[2] min-h-0">
          <CopilotPanel />
        </div>
      </div>

      {/* ─── Bottom Stats Bar (when idle) ─── */}
      {!callId && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-5 py-3 border-t border-white/[0.06] bg-white/[0.01]"
        >
          <div className="flex items-center justify-center gap-8 text-center">
            <div>
              <p className="text-lg font-bold text-white/90">
                {transcript.length}
              </p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                Messages Today
              </p>
            </div>
            <div className="h-8 w-px bg-white/[0.06]" />
            <div>
              <p className="text-lg font-bold text-white/90">0</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                Calls Queued
              </p>
            </div>
            <div className="h-8 w-px bg-white/[0.06]" />
            <div>
              <p className="text-lg font-bold text-emerald-400">Ready</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">
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
