"use client";

import { useEffect, useState } from "react";
import { getFirestore, doc, onSnapshot, setDoc, arrayUnion } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { useCallStore, TranscriptLine } from "@/store/callStore";

const db = getFirestore();

export function useLiveCall() {
  const { user } = useAuth();
  const [incomingCall, setIncomingCall] = useState<{ callId: string; callerPhone: string } | null>(null);
  const updateTranscript = useCallStore.getState().updateTranscript;
  const updateAnalysis = useCallStore.getState().updateAnalysis;
  const resetCall = useCallStore.getState().resetCall;

  useEffect(() => {
    if (!user) {
      resetCall();
      setIncomingCall(null);
      return;
    }

    const presenceRef = doc(db, "agentPresence", user.uid);
    let unsubLive: (() => void) | null = null;
    let recognition: any = null;

    const unsubPresence = onSnapshot(presenceRef, (snap) => {
      const data = snap.data() as any;
      const callId: string | null = data?.callId || null;
      const incoming = data?.incomingCall || null;

      setIncomingCall(incoming);

      // --- AGENT BROWSER TRANSCRIPTION ---
      if (callId && !recognition && typeof window !== "undefined") {
         const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
         if (SpeechRecognition) {
            recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = false;
            recognition.lang = "en-IN";

            recognition.onresult = async (event: any) => {
              const result = event.results[event.results.length - 1];
              if (result.isFinal) {
                const text = result[0].transcript.trim();
                if (text.length > 2) {
                  // FIXED: Use setDoc with merge: true to avoid "NOT_FOUND" 5 error
                  const liveRef = doc(db, "liveCallState", callId);
                  await setDoc(liveRef, {
                    callId,
                    transcript: arrayUnion({
                      speaker: "agent",
                      text,
                      timestamp: new Date().toISOString()
                    })
                  }, { merge: true }).catch(err => console.error("[AGENT-PUSH-ERR]:", err));
                }
              }
            };

            recognition.onerror = (e: any) => console.error("Agent Speech Error:", e);
            recognition.onend = () => { if (callId) recognition?.start(); };
            recognition.start();
         }
      }

      if (!callId) {
        if (unsubLive) { unsubLive(); unsubLive = null; }
        if (recognition) { recognition.stop(); recognition = null; }
        resetCall();
        return;
      }

      const liveRef = doc(db, "liveCallState", callId);
      if (unsubLive) { unsubLive(); unsubLive = null; }

      unsubLive = onSnapshot(liveRef, (liveSnap) => {
        const live = liveSnap.data() as any;
        if (!live) { resetCall(); return; }

        const transcript: TranscriptLine[] = (live.transcript || []).map((l: any) => ({
          speaker: l.speaker,
          text: l.text,
          timestamp: l.timestamp,
        }));

        updateTranscript(transcript);
        updateAnalysis({
          callId,
          intent: live.intent || null,
          isPreviousIssue: !!live.isPreviousIssue,
          sentimentScore: live.sentimentScore ?? null,
          sentimentLabel: live.sentimentLabel ?? null,
          suggestions: live.currentSuggestions || [],
          complianceAlert: !!live.complianceAlert,
          knowledgeSnippet: live.knowledgeSnippet || "",
          isRepeatCaller: !!live.isRepeatCaller,
          activeMode: live.activeMode || null,
          conferenceSid: live.conferenceSid || null,
          customerParticipantSid: live.customerParticipantSid || null,
          liveSummary: live.liveSummary || null,
          complianceReason: live.complianceReason || null,
          sentimentArc: (live.sentimentArc || []).map((p: any) => p.score),
        });
      });
    });

    return () => {
      unsubPresence();
      if (unsubLive) unsubLive();
      if (recognition) recognition.stop();
      resetCall();
      setIncomingCall(null);
    };
  }, [user]);

  return { incomingCall };
}
