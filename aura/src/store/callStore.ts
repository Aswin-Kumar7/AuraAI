"use client";

import { create } from "zustand";

export interface TranscriptLine {
  speaker: string;
  text: string;
  timestamp?: string;
}

export interface AnalysisState {
  callId: string | null;
  transcript: TranscriptLine[];
  sentimentScore: number | null;
  sentimentLabel: string | null;
  suggestions: any[];
  complianceAlert: boolean;
  knowledgeSnippet: string;
  isRepeatCaller: boolean;
  activeMode: string | null;
  conferenceSid?: string | null;
  customerParticipantSid?: string | null;
  liveSummary?: string | null;
  complianceReason?: string | null;
  sentimentArc?: number[];
}

interface CallStore extends AnalysisState {
  updateTranscript: (lines: TranscriptLine[]) => void;
  updateAnalysis: (partial: Partial<AnalysisState>) => void;
  resetCall: () => void;
  appendTranscript: (line: TranscriptLine) => void;
  setCallId: (id: string | null) => void;
  setSentimentScore: (score: number | null) => void;
  setSentimentLabel: (label: string | null) => void;
  setSuggestions: (suggestions: any[]) => void;
  setComplianceAlert: (alert: boolean) => void;
  setKnowledgeSnippet: (snippet: string) => void;
  reset: () => void;
}

const initialState: AnalysisState = {
  callId: null,
  transcript: [],
  sentimentScore: null,
  sentimentLabel: null,
  suggestions: [],
  complianceAlert: false,
  knowledgeSnippet: "",
  isRepeatCaller: false,
  activeMode: null,
  conferenceSid: null,
  customerParticipantSid: null,
  liveSummary: null,
  complianceReason: null,
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
  setKnowledgeSnippet: (snippet) =>
    set((state) => ({
      ...state,
      knowledgeSnippet: snippet,
    })),
  reset: () => set(() => ({ ...initialState })),
}));

