"use client";

import { create } from "zustand";

export interface TranscriptLine {
  speaker: string;
  text: string;
  timestamp?: string;
}

export type Suggestion = {
  text: string;
  tone?: string;
  rank?: number;
  resolutionLikelihood?: number;
};

export interface IntentTrendPoint {
  intent: string;
  confidence: number;
  policyMatchScore: number;
  timestamp: string;
}

export interface AnalysisState {
  callId: string | null;
  transcript: TranscriptLine[];
  intent: string | null;
  intentConfidence: number | null;
  inferredNeed: string;
  customerDisposition: string | null;
  isPreviousIssue: boolean;
  sentimentScore: number | null;
  sentimentLabel: string | null;
  escalationRisk: number;
  escalationReason: string;
  interventionSuggestion: string;
  policySuggestion: string;
  policyMatchScore: number | null;
  intentTrend: IntentTrendPoint[];
  knowledgeCandidates: string[];
  suggestions: Suggestion[];
  complianceAlert: boolean;
  complianceReason: string;
  complianceSeverity: string;
  knowledgeSnippet: string;
  isRepeatCaller: boolean;
  activeMode: string | null;
  conferenceSid?: string | null;
  customerParticipantSid?: string | null;
  liveSummary?: string | null;
  sentimentArc?: number[];
}

interface CallStore extends AnalysisState {
  updateTranscript: (lines: TranscriptLine[]) => void;
  updateAnalysis: (partial: Partial<AnalysisState>) => void;
  resetCall: () => void;
  appendTranscript: (line: TranscriptLine) => void;
  setCallId: (id: string | null) => void;
  setIntent: (intent: string | null) => void;
  setIsPreviousIssue: (isPrevious: boolean) => void;
  setSentimentScore: (score: number | null) => void;
  setSentimentLabel: (label: string | null) => void;
  setEscalationRisk: (risk: number) => void;
  setEscalationReason: (reason: string) => void;
  setInterventionSuggestion: (suggestion: string) => void;
  setSuggestions: (suggestions: Suggestion[]) => void;
  setComplianceAlert: (alert: boolean) => void;
  setComplianceReason: (reason: string) => void;
  setComplianceSeverity: (severity: string) => void;
  setKnowledgeSnippet: (snippet: string) => void;
  setActiveMode: (mode: "whisper" | "alert" | "auto") => void;
  reset: () => void;
}

const initialState: AnalysisState = {
  callId: null,
  transcript: [],
  intent: null,
  intentConfidence: null,
  inferredNeed: "",
  customerDisposition: null,
  isPreviousIssue: false,
  sentimentScore: null,
  sentimentLabel: null,
  escalationRisk: 0,
  escalationReason: "",
  interventionSuggestion: "",
  policySuggestion: "",
  policyMatchScore: null,
  intentTrend: [],
  knowledgeCandidates: [],
  suggestions: [],
  complianceAlert: false,
  complianceReason: "",
  complianceSeverity: "warning",
  knowledgeSnippet: "",
  isRepeatCaller: false,
  activeMode: null,
  conferenceSid: null,
  customerParticipantSid: null,
  liveSummary: null,
  sentimentArc: [],
};

export const useCallStore = create<CallStore>((set) => ({
  ...initialState,
  updateTranscript: (lines) =>
    set((state) => ({
      ...state,
      transcript: lines,
    })),
  updateAnalysis: (partial) =>
    set((state) => ({
      ...state,
      ...partial,
    })),
  resetCall: () => set(() => ({ ...initialState })),
  appendTranscript: (line) =>
    set((state) => ({
      ...state,
      transcript: [...state.transcript, line],
    })),
  setCallId: (id) =>
    set((state) => ({
      ...state,
      callId: id,
    })),
  setIntent: (intent) =>
    set((state) => ({
      ...state,
      intent,
    })),
  setIsPreviousIssue: (isPrevious) =>
    set((state) => ({
      ...state,
      isPreviousIssue: isPrevious,
    })),
  setSentimentScore: (score) =>
    set((state) => ({
      ...state,
      sentimentScore: score,
    })),
  setSentimentLabel: (label) =>
    set((state) => ({
      ...state,
      sentimentLabel: label,
    })),
  setEscalationRisk: (risk) =>
    set((state) => ({
      ...state,
      escalationRisk: risk,
    })),
  setEscalationReason: (reason) =>
    set((state) => ({
      ...state,
      escalationReason: reason,
    })),
  setInterventionSuggestion: (suggestion) =>
    set((state) => ({
      ...state,
      interventionSuggestion: suggestion,
    })),
  setSuggestions: (suggestions) =>
    set((state) => ({
      ...state,
      suggestions,
    })),

  setComplianceAlert: (alert) =>
    set((state) => ({
      ...state,
      complianceAlert: alert,
    })),
  setComplianceReason: (reason) =>
    set((state) => ({
      ...state,
      complianceReason: reason,
    })),
  setComplianceSeverity: (severity) =>
    set((state) => ({
      ...state,
      complianceSeverity: severity,
    })),
  setKnowledgeSnippet: (snippet) =>
    set((state) => ({
      ...state,
      knowledgeSnippet: snippet,
    })),
  setActiveMode: (mode) =>
    set((state) => ({
      ...state,
      activeMode: mode,
    })),
  reset: () => set(() => ({ ...initialState })),
}));

