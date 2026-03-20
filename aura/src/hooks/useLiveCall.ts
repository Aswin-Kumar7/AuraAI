"use client";

import { useEffect, useState, useRef } from "react";
import { getFirestore, doc, onSnapshot, setDoc, arrayUnion } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { useCallStore, TranscriptLine } from "@/store/callStore";

const db = getFirestore();

export function useLiveCall() {
  const { user } = useAuth();
  const [incomingCall, setIncomingCall] = useState<{ callId: string; callerPhone: string } | null>(null);
  const recognitionRef = useRef<any>(null);
  const unsubLiveRef = useRef<(() => void) | null>(null);
  const currentCallIdRef = useRef<string | null>(null);
  const recognitionErrorCountRef = useRef<number>(0);
  const MAX_RECOGNITION_ERRORS = 3;

  const updateTranscript = useCallStore.getState().updateTranscript;
  const updateAnalysis = useCallStore.getState().updateAnalysis;
  const resetCall = useCallStore.getState().resetCall;

  // Initialize speech recognition
  const initializeSpeechRecognition = (callId: string) => {
    if (recognitionRef.current) {
      console.log("[Speech] Recognition already initialized");
      return;
    }

    if (typeof window === "undefined") {
      console.warn("[Speech] Not in browser environment");
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("[Speech] Speech Recognition API not available in this browser");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = "en-IN";
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        console.log("🎤 [Speech] Recognition started");
        recognitionErrorCountRef.current = 0;
      };

      recognition.onresult = async (event: any) => {
        try {
          const result = event.results[event.results.length - 1];
          if (result.isFinal) {
            const transcript = result[0]?.transcript?.trim();
            const confidence = result[0]?.confidence ?? 0;

            if (!transcript || transcript.length < 2) {
              console.debug("[Speech] Skipping empty or very short transcript");
              return;
            }

            if (confidence < 0.5) {
              console.debug(`[Speech] Low confidence (${(confidence * 100).toFixed(1)}%), skipping: "${transcript}"`);
              return;
            }

            console.log(`✅ [Speech] Agent: "${transcript}" (confidence: ${(confidence * 100).toFixed(1)}%)`);

            try {
              // Send to hybrid endpoint for intelligent routing
              const hybridResponse = await fetch("/api/transcription/hybrid", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  callId,
                  source: "browser",
                  transcript,
                  confidence,
                  language: "en-IN",
                  isFinal: true,
                  timestamp: new Date().toISOString(),
                }),
              });

              if (!hybridResponse.ok) {
                throw new Error(
                  `Hybrid endpoint error: ${hybridResponse.status}`
                );
              }

              const result = await hybridResponse.json();
              console.log(
                `📤 [Hybrid] Routed via: ${result.source} (${result.latency}ms)`
              );
            } catch (err) {
              console.error("[Hybrid] Request error:", err);
              
              // Fallback: Write directly to Firestore if hybrid endpoint fails
              try {
                const liveRef = doc(db, "liveCallState", callId);
                await setDoc(
                  liveRef,
                  {
                    callId,
                    transcript: arrayUnion({
                      speaker: "agent",
                      text: transcript,
                      timestamp: new Date().toISOString(),
                      confidence: confidence,
                      source: "agent-browser-stt-fallback",
                    }),
                  },
                  { merge: true }
                );
                console.log("[Fallback] Direct Firestore write successful");
              } catch (fallbackErr) {
                console.error("[Fallback] Failed:", fallbackErr);
              }
            }
          }
        } catch (err) {
          console.error("[Speech] onresult error:", err);
        }
      };

      recognition.onerror = (event: any) => {
        const errorMessage = event.error || "unknown error";
        console.error(`❌ [Speech] Error: ${errorMessage}`);
        recognitionErrorCountRef.current++;

        // Handle specific errors
        switch (event.error) {
          case "no-speech":
            console.info("[Speech] No speech detected, continuing...");
            break;
          case "audio-capture":
            console.error("[Speech] No microphone available");
            break;
          case "network":
            console.error("[Speech] Network error");
            break;
          case "permission-denied":
            console.error("[Speech] Microphone permission denied");
            break;
        }

        // Stop if too many errors
        if (recognitionErrorCountRef.current >= MAX_RECOGNITION_ERRORS) {
          console.error(`[Speech] Too many errors (${MAX_RECOGNITION_ERRORS}), stopping recognition`);
          recognitionRef.current?.stop();
          recognitionRef.current = null;
        }
      };

      recognition.onend = () => {
        console.log("[Speech] Recognition ended");
        // Auto-restart if call is still active
        if (currentCallIdRef.current && recognitionErrorCountRef.current < MAX_RECOGNITION_ERRORS) {
          try {
            recognition.start();
          } catch (err) {
            console.error("[Speech] Failed to restart:", err);
          }
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("[Speech] Initialization error:", err);
    }
  };

  // Cleanup speech recognition
  const cleanupSpeechRecognition = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.debug("[Speech] Stop error:", err);
      }
      recognitionRef.current = null;
      recognitionErrorCountRef.current = 0;
    }
  };

  useEffect(() => {
    if (!user) {
      cleanupSpeechRecognition();
      if (unsubLiveRef.current) {
        unsubLiveRef.current();
        unsubLiveRef.current = null;
      }
      resetCall();
      setIncomingCall(null);
      currentCallIdRef.current = null;
      return;
    }

    const presenceRef = doc(db, "agentPresence", user.uid);

    const unsubPresence = onSnapshot(
      presenceRef,
      (snap) => {
        const data = snap.data() as any;
        const callId: string | null = data?.callId || null;
        const incoming = data?.incomingCall || null;

        setIncomingCall(incoming);

        // Call started
        if (callId && callId !== currentCallIdRef.current) {
          console.log(`📞 [Call] New call started: ${callId}`);
          currentCallIdRef.current = callId;
          
          // Clean up old listener
          if (unsubLiveRef.current) {
            unsubLiveRef.current();
            unsubLiveRef.current = null;
          }

          // Initialize speech recognition
          initializeSpeechRecognition(callId);

          // Subscribe to live call state
          const liveRef = doc(db, "liveCallState", callId);
          unsubLiveRef.current = onSnapshot(
            liveRef,
            (liveSnap) => {
              const live = liveSnap.data() as any;
              if (!live) {
                resetCall();
                return;
              }

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
            },
            (err) => {
              console.error("[LiveCall] Snapshot listen error:", err);
            }
          );
        }

        // Call ended
        if (!callId && currentCallIdRef.current) {
          console.log(`📞 [Call] Call ended: ${currentCallIdRef.current}`);
          currentCallIdRef.current = null;
          cleanupSpeechRecognition();
          if (unsubLiveRef.current) {
            unsubLiveRef.current();
            unsubLiveRef.current = null;
          }
          resetCall();
        }
      },
      (err) => {
        console.error("[Presence] Snapshot listen error:", err);
      }
    );

    return () => {
      unsubPresence();
      if (unsubLiveRef.current) {
        unsubLiveRef.current();
        unsubLiveRef.current = null;
      }
      cleanupSpeechRecognition();
      resetCall();
      setIncomingCall(null);
      currentCallIdRef.current = null;
    };
  }, [user]);

  return { incomingCall };
}
