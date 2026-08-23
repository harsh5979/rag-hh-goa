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
  const speechRecognitionRef = useRef<any>(null);
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
      player.stop();
      playerRef.current = null;
    };
  }, [updateState]);

  // Audio Context unlocker for mobile browsers
  const unlockAudio = useCallback(async () => {
    if (playerRef.current) {
      await playerRef.current.unlockAudio();
    }
  }, []);

  // Stop currently playing speech
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

// Auto-detect Indic script from text content
function detectScriptLanguage(text: string, fallbackLang: IndicLanguageCode = "en-IN"): IndicLanguageCode {
  if (/[\u0900-\u097F]/.test(text)) return "hi-IN"; // Hindi / Marathi
  if (/[\u0A80-\u0AFF]/.test(text)) return "gu-IN"; // Gujarati
  if (/[\u0B80-\u0BFF]/.test(text)) return "ta-IN"; // Tamil
  if (/[\u0C00-\u0C7F]/.test(text)) return "te-IN"; // Telugu
  if (/[\u0980-\u09FF]/.test(text)) return "bn-IN"; // Bengali
  if (/[\u0C80-\u0CFF]/.test(text)) return "kn-IN"; // Kannada
  if (/[\u0D00-\u0D7F]/.test(text)) return "ml-IN"; // Malayalam
  if (/[\u0A00-\u0A7F]/.test(text)) return "pa-IN"; // Punjabi
  if (/[\u0B00-\u0B7F]/.test(text)) return "or-IN"; // Odia
  return fallbackLang || "en-IN";
}

  // Sarvam AI Neural Studio Voice synthesis with browser fallback
  const speakAnswer = useCallback(
    async (textToSpeak: string, langCode: IndicLanguageCode = "en-IN") => {
      if (!textToSpeak || !textToSpeak.trim()) return;

      stopSpeaking();
      const detectedLang = detectScriptLanguage(textToSpeak, langCode);

      try {
        updateState("speaking");
        // 1. Play studio neural voice via Sarvam AI TTS
        const ttsRes = await audioApi.sendTTS(textToSpeak, detectedLang);
        if (ttsRes?.audio_base64 && playerRef.current) {
          await playerRef.current.playBase64(ttsRes.audio_base64);
          return;
        }
      } catch (err) {
        console.warn("[useVoiceRag] Sarvam TTS fallback to browser speech:", err);
      }

      // 2. Fallback to browser SpeechSynthesis
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        updateState("speaking");
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.lang = detectedLang;
        utterance.rate = 1.0;

        const voices = window.speechSynthesis.getVoices();
        const langPrefix = detectedLang.split("-")[0];
        const match = voices.find((v) => v.lang.startsWith(langPrefix));
        if (match) {
          utterance.voice = match;
        }

        utterance.onboundary = (e) => {
          if (textToSpeak.length > 0 && e.charIndex !== undefined) {
            setSpeechProgress(Math.min(1, e.charIndex / textToSpeak.length));
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

    // Stop speech recognition
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {}
      speechRecognitionRef.current = null;
    }

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
        finalResponse = await audioApi.sendAudioQuery(audioBlob, currentTranscript, currentLanguageRef.current);
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

        // 2. Start Live Browser SpeechRecognition for instant live input feedback
        if (typeof window !== "undefined") {
          const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
          if (SpeechRec) {
            try {
              const recognition = new SpeechRec();
              recognition.continuous = false; // Auto-detects end of utterance and triggers onend
              recognition.interimResults = true;
              recognition.maxAlternatives = 1;

              recognition.onresult = (event: any) => {
                let currentTranscript = "";
                for (let i = event.resultIndex; i < event.results.length; i++) {
                  currentTranscript += event.results[i][0].transcript;
                }
                const full = currentTranscript.trim();
                if (full) {
                  setLiveTranscript(full);
                  transcriptRef.current = full;
                  onTranscript?.(full, false);
                }
              };

              recognition.onerror = (e: any) => {
                if (e.error === "no-speech" || e.error === "aborted") {
                  // Silently ignore standard idle timeout
                } else {
                  console.debug("[SpeechRecognition] note:", e.error);
                }
              };

              recognition.onend = () => {
                // When utterance ends, automatically trigger stop and search if we got words
                if (transcriptRef.current && transcriptRef.current.trim() && !isStoppingRef.current) {
                  stopListening();
                }
              };

              recognition.start();
              speechRecognitionRef.current = recognition;
            } catch (recErr) {
              console.debug("[SpeechRecognition] init skip:", recErr);
            }
          }
        }

      // 3. Initialize Audio Streamer with 250ms chunks and 100% track cleanup
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
