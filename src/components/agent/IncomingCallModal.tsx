"use client";

import { useState, useEffect } from "react";
import { Phone, PhoneOff } from "lucide-react";
import { useCallStore } from "@/store/callStore";
import { getFirestore, doc, updateDoc } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface IncomingCallModalProps {
  callId: string;
  callerPhone: string;
  onClose: () => void;
}

const db = getFirestore();

export function IncomingCallModal({
  callId,
  callerPhone,
  onClose,
}: IncomingCallModalProps) {
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const { user } = useAuth();
  const { toast } = useToast();
  const isRepeatCaller = useCallStore((s) => s.isRepeatCaller);

  // Ring timer
  useEffect(() => {
    const id = setInterval(() => setElapsed((p) => p + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const handleAccept = async () => {
    if (!user) return;
    setAccepting(true);
    try {
      useCallStore.getState().setCallId(callId);
      await updateDoc(doc(db, "agentPresence", user.uid), {
        incomingCall: null,
        updatedAt: new Date().toISOString(),
      });
      toast({
        title: "Call connected",
        description: `Connected to ${callerPhone}`,
      });
      onClose();
    } catch {
      toast({
        title: "Error",
        description: "Failed to accept call",
        variant: "destructive",
      });
    } finally {
      setAccepting(false);
    }
  };

  const handleReject = async () => {
    if (!user) return;
    setRejecting(true);
    try {
      await updateDoc(doc(db, "agentPresence", user.uid), {
        status: "available",
        callId: null,
        incomingCall: null,
        updatedAt: new Date().toISOString(),
      });
      toast({ title: "Call declined" });
      onClose();
    } catch {
      toast({
        title: "Error",
        description: "Failed to reject call",
        variant: "destructive",
      });
    } finally {
      setRejecting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="w-full max-w-sm mx-4 rounded-2xl border border-white/[0.08] bg-[#0d1220] shadow-2xl shadow-black/60 p-6 relative overflow-hidden"
        >
          {/* Background glow */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Content */}
          <div className="relative text-center space-y-5">
            {/* Pulsing phone icon */}
            <div className="flex justify-center">
              <div className="relative">
                <div className="h-16 w-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Phone className="h-7 w-7 text-emerald-400 animate-bounce" />
                </div>
                {/* Ripple rings */}
                <div className="absolute inset-0 rounded-full border-2 border-emerald-500/30 animate-ping" />
                <div
                  className="absolute inset-0 rounded-full border-2 border-emerald-500/20 animate-ping"
                  style={{ animationDelay: "0.5s" }}
                />
              </div>
            </div>

            {/* Info */}
            <div>
              <p className="text-[11px] text-emerald-400 font-semibold uppercase tracking-widest mb-1">
                Incoming Call
              </p>
              <p className="text-2xl font-bold text-white tracking-wide">
                {callerPhone}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Ringing for {elapsed}s
              </p>
            </div>

            {/* Repeat caller warning */}
            {isRepeatCaller && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-semibold"
              >
                ⚠️ Repeat Caller — Check History
              </motion.div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleReject}
                disabled={rejecting || accepting}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-200",
                  "bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25 active:scale-[0.97]",
                  (rejecting || accepting) && "opacity-50 pointer-events-none"
                )}
              >
                <PhoneOff className="h-4 w-4" />
                {rejecting ? "..." : "Decline"}
              </button>
              <button
                onClick={handleAccept}
                disabled={rejecting || accepting}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-200",
                  "bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/30 active:scale-[0.97]",
                  (rejecting || accepting) && "opacity-50 pointer-events-none"
                )}
              >
                <Phone className="h-4 w-4" />
                {accepting ? "Connecting..." : "Accept"}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}