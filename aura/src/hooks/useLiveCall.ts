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
            const hasConfidence = typeof confidence === "number" && confidence > 0;

            if (!transcript || transcript.length < 2) {
              console.debug("[Speech] Skipping empty or very short transcript");
              return;
            }

            if (hasConfidence && confidence < 0.5) {
              console.debug(`[Speech] Low confidence (${(confidence * 100).toFixed(1)}%), skipping: "${transcript}"`);
              return;
            }

            if (!hasConfidence) {
              console.debug(`[Speech] Confidence unavailable, accepting transcript: "${transcript}"`);
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
                  speaker: "agent",
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

              const inferSpeaker = (line: any): "agent" | "customer" | "supervisor" => {
                const explicit = String(line?.speaker || "").toLowerCase();
                if (explicit === "agent" || explicit === "customer" || explicit === "supervisor") {
                  return explicit;
                }

                const source = String(line?.source || line?.engine || "").toLowerCase();
                if (source.includes("agent") || source.includes("browser")) {
                  return "agent";
                }
                if (source.includes("customer") || source.includes("twilio") || source.includes("groq") || source.includes("google")) {
                  return "customer";
                }

                return "customer";
              };

              const transcript: TranscriptLine[] = (live.transcript || [])
                .map((l: any) => ({
                  speaker: inferSpeaker(l),
                  text: String(l?.text || "").trim(),
                  timestamp: l?.timestamp,
                }))
                .filter((l: TranscriptLine) => l.text.length > 0)
                .sort((a: TranscriptLine, b: TranscriptLine) => {
                  const ta = a.timestamp ? Date.parse(a.timestamp) : 0;
                  const tb = b.timestamp ? Date.parse(b.timestamp) : 0;
                  return ta - tb;
                });

              updateTranscript(transcript);
              updateAnalysis({
                callId,
                intent: live.intent || null,
                intentConfidence:
                  typeof live.intentConfidence === "number"
                    ? live.intentConfidence
                    : null,
                inferredNeed: live.inferredNeed || "",
                customerDisposition: live.customerDisposition || null,
                isPreviousIssue: !!live.isPreviousIssue,
                sentimentScore: live.sentimentScore ?? null,
                sentimentLabel: live.sentimentLabel ?? null,
                suggestions: Array.isArray(live.currentSuggestions)
                  ? live.currentSuggestions.map((s: unknown, idx: number) => {
                      const item =
                        typeof s === "object" && s !== null
                          ? (s as Record<string, unknown>)
                          : {};
                      return {
                        text: String(item.text || "").trim(),
                        tone: String(item.tone || "neutral"),
                        rank: typeof item.rank === "number" ? item.rank : idx + 1,
                        resolutionLikelihood:
                          typeof item.resolutionLikelihood === "number"
                            ? item.resolutionLikelihood
                            : undefined,
                      };
                    }).filter((s: { text: string }) => s.text.length > 0)
                  : [],
                policySuggestion: live.policySuggestion || "",
                policyMatchScore:
                  typeof live.policyMatchScore === "number"
                    ? live.policyMatchScore
                    : null,
                intentTrend: Array.isArray(live.intentTrend)
                  ? live.intentTrend
                      .map((p: unknown) => {
                        const point =
                          typeof p === "object" && p !== null
                            ? (p as Record<string, unknown>)
                            : {};
                        return {
                          intent: String(point.intent || "other"),
                          confidence:
                            typeof point.confidence === "number"
                              ? point.confidence
                              : 0,
                          policyMatchScore:
                            typeof point.policyMatchScore === "number"
                              ? point.policyMatchScore
                              : 0,
                          timestamp: String(
                            point.timestamp || new Date().toISOString()
                          ),
                        };
                      })
                      .slice(-30)
                  : [],
                knowledgeCandidates: Array.isArray(live.knowledgeCandidates)
                  ? live.knowledgeCandidates
                      .map((c: unknown) => String(c || "").trim())
                      .filter((c: string) => c.length > 0)
                      .slice(0, 3)
                  : [],
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
