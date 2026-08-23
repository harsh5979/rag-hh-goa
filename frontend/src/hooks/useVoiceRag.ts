"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  VoiceWebSocketClient,
  type IndicLanguageCode,
  type VoiceState,
  type VoiceConfig,
  type VoiceError,
} from "@/lib/voice";
import { AudioCapture } from "@/lib/voice/audioCapture";
import { VADEngine } from "@/lib/voice/vadEngine";
import { TTSService } from "@/lib/voice/ttsService";
import { submitSTT, STTError } from "@/lib/voice/sttService";
import type { PipelineResponse } from "@/lib/api/types";
import { useAnalyticsStore } from "@/store/analyticsStore";

// ─── Script-based language detection (no network, no external dep) ─────────
function detectScriptLanguage(
  text: string,
  fallbackLang: IndicLanguageCode = "en-IN"
): IndicLanguageCode {
  if (/[\u0900-\u097F]/.test(text)) return "hi-IN"; // Hindi / Marathi
  if (/[\u0A80-\u0AFF]/.test(text)) return "gu-IN"; // Gujarati
  if (/[\u0B80-\u0BFF]/.test(text)) return "ta-IN"; // Tamil
  if (/[\u0C00-\u0C7F]/.test(text)) return "te-IN"; // Telugu
  if (/[\u0980-\u09FF]/.test(text)) return "bn-IN"; // Bengali
  if (/[\u0C80-\u0CFF]/.test(text)) return "kn-IN"; // Kannada
  if (/[\u0D00-\u0D7F]/.test(text)) return "ml-IN"; // Malayalam
  if (/[\u0A00-\u0A7F]/.test(text)) return "pa-IN"; // Punjabi
  if (/[\u0B00-\u0B7F]/.test(text)) return "or-IN"; // Odia
  return fallbackLang;
}

export function useVoiceRag(config: VoiceConfig = {}) {
  const {
    language: initialLanguage = "en-IN",
    silenceThresholdMs = 1800,
    energyThreshold = 3.5,
    autoSpeak = true,
    speaker = "anushka",
    onTranscript,
    onResponse,
    onError,
    onStateChange,
  } = config;

  // ── UI state ──────────────────────────────────────────────────────────────
  const [state, setState] = useState<VoiceState>("idle");
  const [language, setLanguageState] = useState<IndicLanguageCode>(initialLanguage);
  const [liveTranscript, setLiveTranscript] = useState<string>("");
  const [responseAnswer, setResponseAnswer] = useState<string>("");
  const [result, setResultState] = useState<PipelineResponse | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [speechDetected, setSpeechDetected] = useState<boolean>(false);
  const [silenceCountdown, setSilenceCountdown] = useState<number | null>(null);
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const [speechProgress, setSpeechProgress] = useState<number>(0);
  const [error, setError] = useState<VoiceError | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const { addResult } = useAnalyticsStore();

  // ── Service refs (instantiated once, never re-created on render) ──────────
  const captureRef = useRef<AudioCapture | null>(null);
  const vadRef = useRef<VADEngine | null>(null);
  const ttsRef = useRef<TTSService | null>(null);
  const wsClientRef = useRef<VoiceWebSocketClient | null>(null);
  const speechRecognitionRef = useRef<any>(null);
  const isStoppingRef = useRef<boolean>(false);
  const transcriptRef = useRef<string>("");
  const currentLanguageRef = useRef<IndicLanguageCode>(language);
  const startTimeRef = useRef<number>(0);

  currentLanguageRef.current = language;

  const updateState = useCallback(
    (newState: VoiceState) => {
      setState(newState);
      onStateChange?.(newState);
    },
    [onStateChange]
  );

  const setLanguage = useCallback((newLang: IndicLanguageCode) => {
    setLanguageState(newLang);
    currentLanguageRef.current = newLang;
    if (wsClientRef.current) {
      wsClientRef.current.setLanguage(newLang);
    }
  }, []);

  // ── Initialise TTSService once ─────────────────────────────────────────────
  useEffect(() => {
    const tts = new TTSService({
      speaker,
      onPlayStart: () => updateState("speaking"),
      onProgress: (p) => setSpeechProgress(p),
      onPlayEnd: () => {
        updateState("idle");
        setSpeechProgress(1);
      },
    });
    ttsRef.current = tts;
    return () => {
      tts.destroy();
      ttsRef.current = null;
    };
  }, [updateState, speaker]);

  // ── Teardown on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      captureRef.current?.release();
      vadRef.current?.stop();
      wsClientRef.current?.close();
      ttsRef.current?.destroy();
    };
  }, []);

  // ── unlockAudio: call on user gesture BEFORE any await ───────────────────
  // This keeps the AudioContext creation inside the gesture call stack on iOS/Android.
  const unlockAudio = useCallback(async () => {
    await ttsRef.current?.unlock();
  }, []);

  // ── stopSpeaking ─────────────────────────────────────────────────────────
  const stopSpeaking = useCallback(() => {
    ttsRef.current?.stop();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    updateState("idle");
    setSpeechProgress(0);
  }, [updateState]);

  // ── speakAnswer ───────────────────────────────────────────────────────────
  const speakAnswer = useCallback(
    async (text: string, langCode: IndicLanguageCode = "en-IN") => {
      if (!text?.trim()) return;
      stopSpeaking();
      const detectedLang = detectScriptLanguage(text, langCode);
      updateState("speaking");

      // 1. Sarvam TTS via TTSService
      try {
        await ttsRef.current?.speak(text, detectedLang);
        return;
      } catch (err) {
        console.warn("[useVoiceRag] TTS failed, falling back to browser synthesis:", err);
      }

      // 2. Browser SpeechSynthesis fallback
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = detectedLang;
        utterance.rate = 1.0;
        const voices = window.speechSynthesis.getVoices();
        const match = voices.find((v) => v.lang.startsWith(detectedLang.split("-")[0]));
        if (match) utterance.voice = match;
        utterance.onend = () => { updateState("idle"); setSpeechProgress(1); };
        utterance.onerror = () => updateState("idle");
        window.speechSynthesis.speak(utterance);
      } else {
        updateState("idle");
      }
    },
    [stopSpeaking, updateState]
  );

  // ── stopListening ─────────────────────────────────────────────────────────
  const stopListening = useCallback(async (): Promise<PipelineResponse | null> => {
    if (isStoppingRef.current) return null;
    isStoppingRef.current = true;

    // Stop optional browser SpeechRecognition
    try { speechRecognitionRef.current?.stop(); } catch {}
    speechRecognitionRef.current = null;

    setSilenceCountdown(null);
    setSpeechDetected(false);
    setAudioLevel(0);
    updateState("processing");

    const durationMs = Date.now() - startTimeRef.current;
    let finalResponse: PipelineResponse | null = null;

    try {
      // 1. Stop VAD + recording
      vadRef.current?.stop();
      const blob = await captureRef.current?.stop() ?? null;

      // 2. Signal WebSocket end
      const currentTranscript = transcriptRef.current;
      wsClientRef.current?.sendEnd(currentTranscript);

      // 3. Submit to STT+RAG via sttService
      const lang =
        currentLanguageRef.current === "auto" ? "unknown" : currentLanguageRef.current;

      try {
        const sttResult = await submitSTT({
          blob,
          language: lang,
          fallbackTranscript: currentTranscript,
        });

        finalResponse = sttResult.response;

        // Update transcript display
        const bestTranscript = sttResult.transcript || currentTranscript;
        if (bestTranscript) {
          finalResponse.transcript = bestTranscript;
          setLiveTranscript(bestTranscript);
          transcriptRef.current = bestTranscript;
          onTranscript?.(bestTranscript, true);
        }
      } catch (sttErr) {
        if (sttErr instanceof STTError && sttErr.code === "BLOB_TOO_SMALL") {
          // Nothing to submit — go idle without error
          updateState("idle");
          isStoppingRef.current = false;
          return null;
        }
        throw sttErr;
      }

      if (finalResponse) {
        setResultState(finalResponse);
        setResponseAnswer(finalResponse.answer || "");
        setLatencyMs(finalResponse.timings?.total_ms || durationMs);
        addResult(finalResponse, finalResponse.transcript || "[Voice Query]");
        onResponse?.(finalResponse);

        if (autoSpeak && finalResponse.answer) {
          await speakAnswer(
            finalResponse.answer,
            (finalResponse.language as IndicLanguageCode) || currentLanguageRef.current
          );
        } else {
          updateState("idle");
        }
      } else {
        updateState("idle");
      }
    } catch (err: unknown) {
      console.error("[useVoiceRag] stopListening error:", err);
      const voiceErr: VoiceError = {
        code: "RAG_FAILED",
        message: (err as { message?: string })?.message || "Failed to process voice query.",
        originalError: err,
      };
      setError(voiceErr);
      onError?.(voiceErr);
      updateState("error");
    } finally {
      isStoppingRef.current = false;
      wsClientRef.current?.close();
    }

    return finalResponse;
  }, [updateState, addResult, onResponse, autoSpeak, speakAnswer, onError, onTranscript]);

  // ── startListening ────────────────────────────────────────────────────────
  const startListening = useCallback(async () => {
    isStoppingRef.current = false;
    setError(null);
    setLiveTranscript("");
    transcriptRef.current = "";
    setResponseAnswer("");
    setResultState(null);
    setSilenceCountdown(null);
    setSpeechDetected(false);

    // ★ STEP 1: Unlock TTS AudioContext IN THIS CALL (still within user-gesture scope).
    //   This keeps iOS/Android AudioContext activation inside the gesture call stack
    //   BEFORE any await that could expire the gesture context window.
    await unlockAudio();
    stopSpeaking();
    updateState("requesting_permission");

    try {
      // ★ STEP 2: Request microphone (AudioCapture)
      const capture = new AudioCapture({
        chunkDurationMs: 250,
        onChunk: (chunk) => wsClientRef.current?.sendAudioChunk(chunk),
      });
      captureRef.current = capture;

      // getUserMedia — the gesture context is still valid here on all browsers
      const stream = await capture.start();
      startTimeRef.current = Date.now();

      // ★ STEP 3: Start VAD immediately after getUserMedia
      //   AudioContext creation here is still inside the async chain close to user gesture
      const vad = new VADEngine({
        energyThreshold,
        silenceThresholdMs,
        onAudioLevel: (lvl) => setAudioLevel(lvl),
        onSpeechStart: () => setSpeechDetected(true),
        onSilenceTimeout: () => {
          if (!isStoppingRef.current) stopListening();
        },
      });
      vadRef.current = vad;
      await vad.start(stream);

      // Update analyser for waveform visualisation
      setAnalyser(vad.getAnalyser());

      // ★ STEP 4: Optional browser SpeechRecognition for live text preview
      //   Try on any browser that supports it — no device restriction
      if (typeof window !== "undefined") {
        const SpeechRec =
          (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRec) {
          try {
            const recognition = new SpeechRec();
            recognition.continuous = false;
            recognition.interimResults = true;
            recognition.maxAlternatives = 1;
            recognition.lang =
              currentLanguageRef.current && currentLanguageRef.current !== "auto"
                ? currentLanguageRef.current
                : "en-IN";

            recognition.onresult = (event: any) => {
              let t = "";
              for (let i = event.resultIndex; i < event.results.length; i++) {
                t += event.results[i][0].transcript;
              }
              const full = t.trim();
              if (full) {
                setLiveTranscript(full);
                transcriptRef.current = full;
                onTranscript?.(full, false);
              }
            };
            recognition.onerror = (e: any) => {
              // audio-capture = mic already in use; silently ignore
              if (e.error !== "no-speech" && e.error !== "aborted" && e.error !== "audio-capture") {
                console.debug("[SpeechRecognition] note:", e.error);
              }
            };
            recognition.onend = () => {
              // Auto-stop if we got a transcript and haven't already stopped
              if (transcriptRef.current?.trim() && !isStoppingRef.current) {
                stopListening();
              }
            };
            recognition.start();
            speechRecognitionRef.current = recognition;
          } catch (recErr) {
            // Non-fatal: SpeechRecognition is optional preview only
            console.debug("[SpeechRecognition] init skip:", recErr);
          }
        }
      }

      // ★ STEP 5: Set up WebSocket for real-time streaming (non-blocking)
      const wsClient = new VoiceWebSocketClient({
        language:
          currentLanguageRef.current === "auto" ? "en-IN" : currentLanguageRef.current,
        onTranscript: (t, isFinal) => {
          setLiveTranscript(t);
          transcriptRef.current = t;
          onTranscript?.(t, isFinal);
        },
        onRagResponse: (res) => {
          setResultState(res);
          setResponseAnswer(res.answer);
          onResponse?.(res);
        },
        onTtsChunk: (_base64) => {
          // TTS chunks from WS are handled via speakAnswer after response completes
          void _base64;
        },
        onDone: (timings, res) => {
          if (res) { setResultState(res); setResponseAnswer(res.answer); }
          if (timings.totalLatencyMs) setLatencyMs(timings.totalLatencyMs);
        },
        onError: (err) => console.warn("[useVoiceRag] WS note:", err.message),
      });
      wsClientRef.current = wsClient;
      wsClient.connect().catch(() => {});

      updateState("listening");
    } catch (err: unknown) {
      captureRef.current?.release();
      vadRef.current?.stop();
      console.error("[useVoiceRag] startListening error:", err);
      const voiceErr: VoiceError = {
        code: (err as any)?.code === "PERMISSION_DENIED" ? "PERMISSION_DENIED" : "MIC_UNAVAILABLE",
        message:
          (err as { message?: string })?.message ||
          "Unable to access microphone. Please check your browser settings.",
        originalError: err,
      };
      setError(voiceErr);
      onError?.(voiceErr);
      updateState("error");
    }
  }, [
    unlockAudio,
    stopSpeaking,
    updateState,
    energyThreshold,
    silenceThresholdMs,
    onTranscript,
    onResponse,
    autoSpeak,
    stopListening,
    onError,
  ]);

  const toggleListening = useCallback(async () => {
    if (
      state === "listening" ||
      state === "requesting_permission" ||
      state === "connecting"
    ) {
      await stopListening();
    } else if (state === "idle" || state === "error") {
      await startListening();
    }
  }, [state, stopListening, startListening]);

  return {
    state,
    isListening: state === "listening" || state === "requesting_permission",
    isProcessing: state === "processing",
    isSpeaking: state === "speaking",
    liveTranscript,
    responseAnswer,
    result,
    audioLevel,
    speechDetected,
    silenceCountdown,
    latencyMs,
    speechProgress,
    error,
    analyser,
    language,
    startListening,
    stopListening,
    toggleListening,
    setLanguage,
    speakAnswer,
    stopSpeaking,
    unlockAudio,
    clearResult: () => {
      stopSpeaking();
      setResultState(null);
      setResponseAnswer("");
      setError(null);
      setLiveTranscript("");
    },
    setResult: setResultState,
  };
}
