"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  AudioStreamer,
  VoiceWebSocketClient,
  VoicePlayer,
  type IndicLanguageCode,
  type VoiceState,
  type VoiceConfig,
  type VoiceError,
  type VoiceStreamTimings,
} from "@/lib/voice";
import type { PipelineResponse } from "@/lib/api/types";
import { audioApi } from "@/lib/api/audioApi";
import { queryApi } from "@/lib/api/queryApi";
import { useAnalyticsStore } from "@/store/analyticsStore";

export function useVoiceRag(config: VoiceConfig = {}) {
  const {
    language: initialLanguage = "en-IN",
    silenceThresholdMs = 1200,
    energyThreshold = 10,
    autoSpeak = true,
    speaker = "anushka",
    onTranscript,
    onResponse,
    onError,
    onStateChange,
  } = config;

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

  // Core service instances in refs to avoid re-instantiation across renders
  const streamerRef = useRef<AudioStreamer | null>(null);
  const wsClientRef = useRef<VoiceWebSocketClient | null>(null);
  const playerRef = useRef<VoicePlayer | null>(null);
  const isStoppingRef = useRef<boolean>(false);
  const transcriptRef = useRef<string>("");
  const currentLanguageRef = useRef<IndicLanguageCode>(language);

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

  // Initialize Voice Player once
  useEffect(() => {
    const player = new VoicePlayer({
      onPlayStart: () => {
        updateState("speaking");
      },
      onProgress: (prog) => {
        setSpeechProgress(prog);
      },
      onPlayEnd: () => {
        updateState("idle");
        setSpeechProgress(1);
      },
      onError: (err) => {
        console.warn("[useVoiceRag] Playback warning:", err);
        updateState("idle");
      },
    });

    playerRef.current = player;

    return () => {
      player.destroy();
    };
  }, [updateState]);

  const unlockAudio = useCallback(async () => {
    if (playerRef.current) {
      await playerRef.current.unlockAudio();
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.stop();
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    updateState("idle");
    setSpeechProgress(0);
  }, [updateState]);

  const speakAnswer = useCallback(
    async (text: string, targetLanguage?: IndicLanguageCode) => {
      if (!text || typeof window === "undefined") return;

      stopSpeaking();
      updateState("speaking");
      setSpeechProgress(0);

      const langToUse = targetLanguage || currentLanguageRef.current;

      try {
        // 1. Primary: Use Sarvam AI bulbul:v2 studio neural voice
        const ttsData = await audioApi.sendTTS(text, langToUse);
        if (ttsData?.audio_base64 && playerRef.current) {
          await playerRef.current.playBase64(ttsData.audio_base64);
          return;
        }
      } catch (err) {
        console.warn("[useVoiceRag] Sarvam TTS API error, falling back to Web Speech:", err);
      }

      // 2. Fallback only if Sarvam is unreachable
      if ("speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        const voices = window.speechSynthesis.getVoices();
        const v = voices.find((v) => v.lang.startsWith(langToUse.split("-")[0]));
        if (v) utterance.voice = v;

        utterance.onboundary = (event) => {
          if (event.charIndex !== undefined && text.length > 0) {
            setSpeechProgress(event.charIndex / text.length);
          }
        };

        utterance.onend = () => {
          updateState("idle");
          setSpeechProgress(1);
        };
        utterance.onerror = () => {
          updateState("idle");
        };

        window.speechSynthesis.speak(utterance);
      } else {
        updateState("idle");
      }
    },
    [stopSpeaking, updateState]
  );

  // Stop listening and process query
  const stopListening = useCallback(async (): Promise<PipelineResponse | null> => {
    if (isStoppingRef.current) return null;
    isStoppingRef.current = true;

    setSilenceCountdown(null);
    setSpeechDetected(false);
    setAudioLevel(0);
    updateState("processing");

    let finalResponse: PipelineResponse | null = null;

    try {
      // Stop streamer & release microphone tracks 100%
      const streamResult = streamerRef.current
        ? await streamerRef.current.stopStreaming()
        : { blob: null, durationMs: 0 };

      const audioBlob = streamResult.blob;
      const currentTranscript = transcriptRef.current;

      // Close WebSocket stream signal
      if (wsClientRef.current) {
        wsClientRef.current.sendEnd(currentTranscript);
      }

      // If we have an audio blob, process via API pipeline
      if (audioBlob && audioBlob.size > 500) {
        finalResponse = await audioApi.sendAudioQuery(audioBlob, currentTranscript);
      } else if (currentTranscript && currentTranscript.trim()) {
        finalResponse = await queryApi.sendTextQuery(currentTranscript.trim());
      }

      if (finalResponse) {
        if (currentTranscript && !finalResponse.transcript) {
          finalResponse.transcript = currentTranscript;
        }

        setResultState(finalResponse);
        setResponseAnswer(finalResponse.answer || "");
        setLatencyMs(finalResponse.timings?.total_ms || streamResult.durationMs);
        addResult(finalResponse, currentTranscript || "[Voice Query]");
        onResponse?.(finalResponse);

        if (autoSpeak && finalResponse.answer) {
          await speakAnswer(finalResponse.answer, currentLanguageRef.current);
        } else {
          updateState("idle");
        }
      } else {
        updateState("idle");
      }
    } catch (err: unknown) {
      console.error("[useVoiceRag] Query processing error:", err);
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
      if (wsClientRef.current) {
        wsClientRef.current.close();
      }
    }

    return finalResponse;
  }, [updateState, addResult, onResponse, autoSpeak, speakAnswer, onError]);

  // Start listening with zero hardware collisions
  const startListening = useCallback(async () => {
    isStoppingRef.current = false;
    setError(null);
    setLiveTranscript("");
    transcriptRef.current = "";
    setResponseAnswer("");
    setResultState(null);
    setSilenceCountdown(null);
    setSpeechDetected(false);

    await unlockAudio();
    stopSpeaking();
    updateState("requesting_permission");

    try {
      // 1. Initialize WebSocket Client for streaming frames
      const wsClient = new VoiceWebSocketClient({
        language: currentLanguageRef.current,
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
        onTtsChunk: (base64) => {
          if (autoSpeak && playerRef.current) {
            playerRef.current.playBase64(base64);
          }
        },
        onDone: (timings, res) => {
          if (res) {
            setResultState(res);
            setResponseAnswer(res.answer);
          }
          if (timings.totalLatencyMs) {
            setLatencyMs(timings.totalLatencyMs);
          }
        },
        onError: (err) => {
          console.warn("[useVoiceRag] Streaming socket note:", err.message);
        },
      });

      wsClientRef.current = wsClient;
      // Initiate background connection (non-blocking)
      wsClient.connect().catch(() => {});

      // 2. Initialize Audio Streamer with 250ms chunks and 100% track cleanup
      const streamer = new AudioStreamer({
        chunkDurationMs: 250,
        energyThreshold,
        silenceThresholdMs,
        onAudioChunk: (chunk) => {
          if (wsClientRef.current) {
            wsClientRef.current.sendAudioChunk(chunk);
          }
        },
        onAudioLevel: (lvl) => {
          setAudioLevel(lvl);
        },
        onSpeechDetected: (detected) => {
          setSpeechDetected(detected);
        },
        onSilenceTimeout: () => {
          if (!isStoppingRef.current) {
            stopListening();
          }
        },
        onError: (err) => {
          setError(err);
          onError?.(err);
          updateState("error");
        },
      });

      streamerRef.current = streamer;
      await streamer.startStreaming();

      setAnalyser(streamer.getAnalyser());
      updateState("listening");
    } catch (err: unknown) {
      console.error("[useVoiceRag] Failed to start voice streaming:", err);
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
    if (state === "listening" || state === "requesting_permission" || state === "connecting") {
      await stopListening();
    } else if (state === "idle" || state === "error") {
      await startListening();
    }
  }, [state, stopListening, startListening]);

  // Teardown & memory leak prevention on unmount
  useEffect(() => {
    return () => {
      if (streamerRef.current) {
        streamerRef.current.cleanupHardwareTracks();
      }
      if (wsClientRef.current) {
        wsClientRef.current.close();
      }
      if (playerRef.current) {
        playerRef.current.destroy();
      }
    };
  }, []);

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
