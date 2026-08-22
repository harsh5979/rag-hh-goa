import { useState, useRef, useCallback, useEffect } from "react";

export type RecorderState = "idle" | "recognizing" | "processing";

interface VoiceRecorderOptions {
  silenceThresholdMs?: number; // Silence duration before auto-stop (e.g. 1500ms)
  energyThreshold?: number;    // Minimum audio energy to consider "speaking"
  onAutoStop?: () => void;
}

export function useVoiceRecorder(options: VoiceRecorderOptions = {}) {
  const {
    silenceThresholdMs = 1600,
    energyThreshold = 18,
    onAutoStop
  } = options;

  const [state, setState] = useState<RecorderState>("idle");
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [liveTranscript, setLiveTranscript] = useState<string>("");
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [speechDetected, setSpeechDetected] = useState<boolean>(false);
  const [silenceCountdown, setSilenceCountdown] = useState<number | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const recognitionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const vadIntervalRef = useRef<any>(null);
  const lastSpokenTimeRef = useRef<number>(0);
  const hasSpokenRef = useRef<boolean>(false);
  const isStoppingRef = useRef<boolean>(false);
  const transcriptRef = useRef<string>("");
  const onAutoStopRef = useRef(onAutoStop);
  onAutoStopRef.current = onAutoStop;

  // Sync ref with liveTranscript state
  useEffect(() => {
    transcriptRef.current = liveTranscript;
  }, [liveTranscript]);

  // Initialize SpeechRecognition if available in browser
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = "en-US";

          recognition.onresult = (event: any) => {
            let current = "";
            for (let i = 0; i < event.results.length; i++) {
              current += event.results[i][0].transcript;
            }
            if (current) {
              setLiveTranscript(current);
              transcriptRef.current = current;
              hasSpokenRef.current = true;
              setSpeechDetected(true);
              lastSpokenTimeRef.current = Date.now();
            }
          };

          recognition.onerror = (e: any) => {
            // Ignore non-fatal recognition errors
            console.debug("Speech recognition note:", e.error);
          };

          recognitionRef.current = recognition;
        } catch (e) {
          console.warn("SpeechRecognition init error:", e);
        }
      }
    }
  }, []);

  const stopRecording = useCallback((): Promise<{ blob: Blob | null; transcript: string }> => {
    return new Promise((resolve) => {
      if (isStoppingRef.current) {
        resolve({ blob: null, transcript: transcriptRef.current });
        return;
      }
      isStoppingRef.current = true;

      // Stop VAD interval
      if (vadIntervalRef.current) {
        clearInterval(vadIntervalRef.current);
        vadIntervalRef.current = null;
      }

      setSilenceCountdown(null);
      setSpeechDetected(false);
      setAudioLevel(0);

      try {
        recognitionRef.current?.stop();
      } catch (err) {
        // Ignored
      }

      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") {
        setState("idle");
        isStoppingRef.current = false;
        resolve({ blob: null, transcript: transcriptRef.current });
        return;
      }

      setState("processing");

      mediaRecorderRef.current.onstop = () => {
        const mime = mediaRecorderRef.current?.mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: mime });

        // Cleanup stream tracks
        streamRef.current?.getTracks().forEach((t) => t.stop());
        try {
          audioContextRef.current?.close();
        } catch (e) {}

        const finalTranscript = transcriptRef.current;
        setState("idle");
        isStoppingRef.current = false;
        resolve({ blob: audioBlob, transcript: finalTranscript });
      };

      mediaRecorderRef.current.stop();
    });
  }, []);

  const startRecording = useCallback(async () => {
    try {
      isStoppingRef.current = false;
      hasSpokenRef.current = false;
      lastSpokenTimeRef.current = 0;
      setSpeechDetected(false);
      setSilenceCountdown(null);
      setLiveTranscript("");
      transcriptRef.current = "";

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      streamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyserNode = audioCtx.createAnalyser();
      analyserNode.fftSize = 128;
      analyserNode.smoothingTimeConstant = 0.4;
      source.connect(analyserNode);

      audioContextRef.current = audioCtx;
      setAnalyser(analyserNode);

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";

      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(100);
      setState("recognizing");

      // Start live web speech recognition if available
      try {
        recognitionRef.current?.start();
      } catch (err) {}

      // Start VAD / Silence Monitoring Loop
      const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
      const startTime = Date.now();
      let lastSpeechTimestamp = 0;
      let speechStarted = false;

      // Also set a max recording timeout of 12 seconds
      const maxTimer = setTimeout(() => {
        if (!isStoppingRef.current && onAutoStopRef.current) {
          onAutoStopRef.current();
        }
      }, 12000);

      vadIntervalRef.current = setInterval(() => {
        if (isStoppingRef.current) {
          clearTimeout(maxTimer);
          return;
        }

        analyserNode.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avgEnergy = sum / dataArray.length;
        setAudioLevel(Math.round(avgEnergy));

        const now = Date.now();
        const hasTranscript = transcriptRef.current && transcriptRef.current.trim().length > 0;

        // Speech detected if audio level > energyThreshold (e.g. 8) OR live transcript exists
        if (avgEnergy > energyThreshold || hasTranscript) {
          speechStarted = true;
          hasSpokenRef.current = true;
          setSpeechDetected(true);
          lastSpeechTimestamp = now;
          lastSpokenTimeRef.current = now;
          setSilenceCountdown(null);
        } else if (speechStarted && lastSpeechTimestamp > 0) {
          const silentForMs = now - lastSpeechTimestamp;
          
          // Auto-stop after 1.1 seconds of silence if user has spoken
          if (silentForMs >= silenceThresholdMs && (now - startTime > 1000)) {
            clearTimeout(maxTimer);
            if (onAutoStopRef.current) {
              onAutoStopRef.current();
            } else {
              stopRecording();
            }
          }
        }
      }, 80);

    } catch (err) {
      console.error("Failed to start voice recognition:", err);
      setState("idle");
    }
  }, [energyThreshold, silenceThresholdMs, stopRecording]);

  const toggleRecording = useCallback(() => {
    if (state === "recognizing") {
      return stopRecording();
    } else if (state === "idle") {
      startRecording();
      return Promise.resolve(null);
    }
    return Promise.resolve(null);
  }, [state, startRecording, stopRecording]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (vadIntervalRef.current) clearInterval(vadIntervalRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      try {
        audioContextRef.current?.close();
      } catch (e) {}
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

