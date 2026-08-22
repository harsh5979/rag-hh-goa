import { useState, useCallback, useRef } from "react";
import { audioApi } from "@/lib/api/audioApi";
import { queryApi } from "@/lib/api/queryApi";
import { useAnalyticsStore } from "@/store/analyticsStore";
import type { PipelineResponse } from "@/lib/api/types";
import { useVoiceRecorder } from "./useVoiceRecorder";

export function useVoiceQuery() {
  const [result, setResult] = useState<PipelineResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSpeakingAnswer, setIsSpeakingAnswer] = useState<boolean>(false);
  const { addResult } = useAnalyticsStore();

  const handleStopRef = useRef<() => Promise<void>>(async () => {});

  const handleAutoStop = useCallback(() => {
    handleStopRef.current();
  }, []);

  const {
    state: recorderState,
    analyser,
    liveTranscript,
    audioLevel,
    speechDetected,
    silenceCountdown,
    startRecording,
    stopRecording,
    isRecognizing,
    isProcessing,
  } = useVoiceRecorder({
    silenceThresholdMs: 1100,
    energyThreshold: 8,
    onAutoStop: handleAutoStop,
  });

  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize persistent audio element on mount
  if (typeof window !== "undefined" && !activeAudioRef.current) {
    activeAudioRef.current = new Audio();
  }

  const speakAnswer = useCallback(async (text: string) => {
    if (!text || typeof window === "undefined") return;

    // Stop any currently playing audio
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    setIsSpeakingAnswer(true);

    try {
      // 1. Primary: Use Sarvam AI bulbul:v2 studio TTS from backend
      const ttsData = await audioApi.sendTTS(text);
      if (ttsData?.audio_base64) {
        if (!activeAudioRef.current) activeAudioRef.current = new Audio();
        
        const audio = activeAudioRef.current;
        audio.src = `data:audio/wav;base64,${ttsData.audio_base64}`;
        
        audio.onended = () => {
          setIsSpeakingAnswer(false);
        };
        audio.onerror = (err) => {
          console.warn("Sarvam Audio playback error, falling back to Web Speech:", err);
          setIsSpeakingAnswer(false);
        };

        await audio.play();
        return;
      }
    } catch (err) {
      console.warn("Sarvam TTS API failed, using browser Web Speech fallback:", err);
    }

    // 2. Fallback: Browser Web Speech API
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();

      // Auto-detect language block based on unicode ranges
      if (/[\u0900-\u097F]/.test(text)) { // Hindi / Marathi
        utterance.lang = "hi-IN";
        const v = voices.find(v => v.lang.startsWith("hi"));
        if (v) utterance.voice = v;
      } else if (/[\u0A80-\u0AFF]/.test(text)) { // Gujarati
        utterance.lang = "gu-IN";
        const v = voices.find(v => v.lang.startsWith("gu"));
        if (v) utterance.voice = v;
      } else if (/[\u0B80-\u0BFF]/.test(text)) { // Tamil
        utterance.lang = "ta-IN";
        const v = voices.find(v => v.lang.startsWith("ta"));
        if (v) utterance.voice = v;
      } else if (/[\u0C00-\u0C7F]/.test(text)) { // Telugu
        utterance.lang = "te-IN";
        const v = voices.find(v => v.lang.startsWith("te"));
        if (v) utterance.voice = v;
      } else if (/[\u0C80-\u0CFF]/.test(text)) { // Kannada
        utterance.lang = "kn-IN";
        const v = voices.find(v => v.lang.startsWith("kn"));
        if (v) utterance.voice = v;
      } else if (/[\u0D00-\u0D7F]/.test(text)) { // Malayalam
        utterance.lang = "ml-IN";
        const v = voices.find(v => v.lang.startsWith("ml"));
        if (v) utterance.voice = v;
      } else if (/[\u0980-\u09FF]/.test(text)) { // Bengali / Assamese
        utterance.lang = "bn-IN";
        const v = voices.find(v => v.lang.startsWith("bn"));
        if (v) utterance.voice = v;
      } else if (/[\u0B00-\u0B7F]/.test(text)) { // Odia
        utterance.lang = "or-IN";
        const v = voices.find(v => v.lang.startsWith("or"));
        if (v) utterance.voice = v;
      } else if (/[\u0A00-\u0A7F]/.test(text)) { // Punjabi
        utterance.lang = "pa-IN";
        const v = voices.find(v => v.lang.startsWith("pa"));
        if (v) utterance.voice = v;
      } else { // Default to English
        utterance.lang = "en-IN";
        const v = voices.find(v => v.lang.startsWith("en-IN") || v.lang.startsWith("en"));
        if (v) utterance.voice = v;
      }

      utterance.onend = () => setIsSpeakingAnswer(false);
      utterance.onerror = () => setIsSpeakingAnswer(false);
      window.speechSynthesis.speak(utterance);
    } else {
      setIsSpeakingAnswer(false);
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current.currentTime = 0;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeakingAnswer(false);
  }, []);

  const unlockAudio = useCallback(() => {
    // Unlock audio context on first user interaction
    if (activeAudioRef.current) {
      activeAudioRef.current.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"; // silent base64
      activeAudioRef.current.play().then(() => {
        activeAudioRef.current?.pause();
      }).catch(() => { /* ignore */ });
    }
  }, []);

  const handleStart = useCallback(() => {
    unlockAudio();

    // Stop any ongoing TTS playback
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeakingAnswer(false);
    }
    setError(null);
    setResult(null);
    startRecording();
  }, [startRecording, unlockAudio]);

  const handleStop = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { blob, transcript } = await stopRecording();

      let res: PipelineResponse;
      if (blob && blob.size > 800) {
        // Send recorded audio + fallback interim transcript to backend
        res = await audioApi.sendAudioQuery(blob, transcript);
      } else if (transcript && transcript.trim()) {
        // If audio blob was tiny but live transcript was recognized, use text query
        res = await queryApi.sendTextQuery(transcript.trim());
      } else {
        setIsLoading(false);
        return;
      }

      if (transcript && !res.transcript) {
        res.transcript = transcript;
      }

      setResult(res);
      addResult(res, transcript || "[Voice Query]");

      if (res.answer) {
        speakAnswer(res.answer);
      }
    } catch (err: any) {
      console.error("Audio recognition query failed:", err);
      setError(err?.message || "Failed to process voice query. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [stopRecording, addResult, speakAnswer]);

  handleStopRef.current = handleStop;

  const toggle = useCallback(async () => {
    if (isRecognizing) {
      await handleStop();
    } else if (recorderState === "idle" && !isLoading) {
      handleStart();
    }
  }, [isRecognizing, recorderState, isLoading, handleStop, handleStart]);


  return {
    result,
    error,
    isLoading: isLoading || isProcessing,
    recorderState,
    analyser,
    liveTranscript,
    audioLevel,
    speechDetected,
    silenceCountdown,
    isRecognizing,
    isProcessing,
    isSpeakingAnswer,
    startRecording: handleStart,
    stopRecording: handleStop,
    toggle,
    toggleRecording: toggle,
    speakAnswer,
    stopSpeaking,
    unlockAudio,
    setResult,
    clearResult: () => {
      stopSpeaking();
      setResult(null);
      setError(null);
    },
  };
}

