import { useState, useRef, useCallback, useEffect } from "react";
import { AudioStreamer } from "@/lib/voice/audioStreamer";

export type RecorderState = "idle" | "recognizing" | "processing";

export interface VoiceRecorderOptions {
  silenceThresholdMs?: number;
  energyThreshold?: number;
  onAutoStop?: () => void;
}

export function useVoiceRecorder(options: VoiceRecorderOptions = {}) {
  const {
    silenceThresholdMs = 1400,
    energyThreshold = 10,
    onAutoStop,
  } = options;

  const [state, setState] = useState<RecorderState>("idle");
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [liveTranscript, setLiveTranscript] = useState<string>("");
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [speechDetected, setSpeechDetected] = useState<boolean>(false);
  const [silenceCountdown, setSilenceCountdown] = useState<number | null>(null);

  const streamerRef = useRef<AudioStreamer | null>(null);
  const onAutoStopRef = useRef(onAutoStop);
  onAutoStopRef.current = onAutoStop;

  const stopRecording = useCallback(async (): Promise<{ blob: Blob | null; transcript: string }> => {
    setState("processing");
    setSilenceCountdown(null);
    setSpeechDetected(false);
    setAudioLevel(0);

    let blob: Blob | null = null;
    if (streamerRef.current) {
      const result = await streamerRef.current.stopStreaming();
      blob = result.blob;
    }

    setState("idle");
    return { blob, transcript: liveTranscript };
  }, [liveTranscript]);

  const startRecording = useCallback(async () => {
    try {
      setSpeechDetected(false);
      setSilenceCountdown(null);
      setLiveTranscript("");

      const streamer = new AudioStreamer({
        energyThreshold,
        silenceThresholdMs,
        onAudioLevel: (lvl) => setAudioLevel(lvl),
        onSpeechDetected: (detected) => setSpeechDetected(detected),
        onSilenceTimeout: () => {
          if (onAutoStopRef.current) {
            onAutoStopRef.current();
          } else {
            stopRecording();
          }
        },
        onError: (err) => {
          console.error("AudioStreamer error:", err);
          setState("idle");
        },
      });

      streamerRef.current = streamer;
      await streamer.startStreaming();

      setAnalyser(streamer.getAnalyser());
      setState("recognizing");
    } catch (err) {
      console.error("Failed to start voice recorder:", err);
      setState("idle");
    }
  }, [energyThreshold, silenceThresholdMs, stopRecording]);

  const toggleRecording = useCallback(() => {
    if (state === "recognizing") {
      return stopRecording();
    } else if (state === "idle") {
      startRecording();
      return Promise.resolve({ blob: null, transcript: "" });
    }
    return Promise.resolve({ blob: null, transcript: "" });
  }, [state, startRecording, stopRecording]);

  // Clean up on unmount — 100% microphone track release
  useEffect(() => {
    return () => {
      if (streamerRef.current) {
        streamerRef.current.cleanupHardwareTracks();
      }
    };
  }, []);

  return {
    state,
    analyser,
    liveTranscript,
    audioLevel,
    speechDetected,
    silenceCountdown,
    startRecording,
    stopRecording,
    toggleRecording,
    isRecognizing: state === "recognizing",
    isProcessing: state === "processing",
  };
}
