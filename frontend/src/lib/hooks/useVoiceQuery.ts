"use client";

import { useCallback } from "react";
import { useVoiceRag } from "@/hooks/useVoiceRag";
import type { IndicLanguageCode } from "@/lib/voice/types";
import type { RecorderState } from "./useVoiceRecorder";

export function useVoiceQuery(initialLanguage: IndicLanguageCode = "en-IN") {
  const voiceRag = useVoiceRag({
    language: initialLanguage,
    silenceThresholdMs: 1800,
    energyThreshold: 3.5,
    autoSpeak: true,
  });

  // Map VoiceState to legacy RecorderState for UI components that check recorderState
  const recorderState: RecorderState =
    voiceRag.state === "listening" || voiceRag.state === "requesting_permission"
      ? "recognizing"
      : voiceRag.state === "processing"
      ? "processing"
      : "idle";

  return {
    ...voiceRag,
    recorderState,
    isLoading: voiceRag.isProcessing,
    isRecognizing: voiceRag.isListening,
    isSpeakingAnswer: voiceRag.isSpeaking,
    error: voiceRag.error?.message || null,
    startRecording: voiceRag.startListening,
    stopRecording: voiceRag.stopListening,
    toggle: voiceRag.toggleListening,
    toggleRecording: voiceRag.toggleListening,
  };
}
