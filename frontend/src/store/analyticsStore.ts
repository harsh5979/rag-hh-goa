import { create } from 'zustand';
import type { PipelineResponse } from '@/lib/api/types';

export interface GuardrailEvent {
  timestamp: string;
  query: string;
  type: string;
  action: string;
  severity: "warning" | "danger" | "success";
}

interface AnalyticsState {
  history: PipelineResponse[];
  events: GuardrailEvent[];
  addResult: (result: PipelineResponse, queryText: string) => void;
}

export const useAnalyticsStore = create<AnalyticsState>((set) => ({
  history: [],
  events: [],
  addResult: (result, queryText) => set((state) => {
    const newEvents: GuardrailEvent[] = [];
    const flags = result.guardrail_flags;
    
    // Check flags
    if (flags && !flags.input_safe) {
      newEvents.push({
        timestamp: new Date().toISOString(),
        query: queryText,
        type: "Input Safety",
        action: "Blocked",
        severity: "danger"
      });
    }
    if (flags && !flags.on_topic) {
      newEvents.push({
        timestamp: new Date().toISOString(),
        query: queryText,
        type: "Topic Enforcement",
        action: "Blocked",
        severity: "warning"
      });
    }
    if (flags && !flags.grounding_passed) {
      newEvents.push({
        timestamp: new Date().toISOString(),
        query: queryText,
        type: "Grounding (Hallucination)",
        action: "Fallback triggered",
        severity: "danger"
      });
    }
    if (flags && !flags.retrieval_confident) {
      newEvents.push({
        timestamp: new Date().toISOString(),
        query: queryText,
        type: "Retrieval Confidence",
        action: "Low score warning",
        severity: "warning"
      });
    }

    return {
      history: [...state.history, result].slice(-100), // Keep last 100
      events: [...newEvents, ...state.events].slice(0, 50), // Keep last 50 events, newest first
    };
  }),
}));

