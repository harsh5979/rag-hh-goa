import { getOptimalAudioMimeType } from "./mimeHelper";
import type { VoiceError } from "./types";

export interface AudioStreamerOptions {
  sampleRate?: number;
  channelCount?: number;
  chunkDurationMs?: number;
  energyThreshold?: number;
  silenceThresholdMs?: number;
  maxRecordingMs?: number;
  onAudioChunk?: (chunk: Blob, isLast: boolean) => void;
  onAudioLevel?: (level: number) => void;
  onSpeechDetected?: (detected: boolean) => void;
  onSilenceTimeout?: () => void;
  onError?: (error: VoiceError) => void;
}

export class AudioStreamer {
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private audioChunks: Blob[] = [];
  private vadInterval: ReturnType<typeof setInterval> | null = null;
  private maxTimer: ReturnType<typeof setTimeout> | null = null;
  private isRecording = false;
  private isStopping = false;
  private hasSpoken = false;
  private lastSpeechTimestamp = 0;
  private startTime = 0;
  private options: Required<AudioStreamerOptions>;

  constructor(options: AudioStreamerOptions = {}) {
    this.options = {
      sampleRate: options.sampleRate ?? 16000,
      channelCount: options.channelCount ?? 1,
      chunkDurationMs: options.chunkDurationMs ?? 250,
      energyThreshold: options.energyThreshold ?? 3.5,
      silenceThresholdMs: options.silenceThresholdMs ?? 1800,
      maxRecordingMs: options.maxRecordingMs ?? 15000,
      onAudioChunk: options.onAudioChunk ?? (() => {}),
      onAudioLevel: options.onAudioLevel ?? (() => {}),
      onSpeechDetected: options.onSpeechDetected ?? (() => {}),
      onSilenceTimeout: options.onSilenceTimeout ?? (() => {}),
      onError: options.onError ?? (() => {}),
    };
  }

  /**
   * Returns active AnalyserNode for audio visualization.
   */
  public getAnalyser(): AnalyserNode | null {
    return this.analyserNode;
  }

  /**
   * Returns current recording state.
   */
  public isActive(): boolean {
    return this.isRecording;
  }

  /**
   * Requests microphone access with optimal acoustic settings and starts chunked recording.
   */
  public async startStreaming(): Promise<void> {
    if (this.isRecording) {
      return;
    }

    this.isStopping = false;
    this.hasSpoken = false;
    this.lastSpeechTimestamp = 0;
    this.audioChunks = [];

    try {
      // 1. Request hardware microphone with noise suppression & cross-platform acoustic constraints
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.mediaStream = stream;

      // 2. Setup AudioContext and AnalyserNode for visualization and energy-based VAD
      const AudioCtxClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtxClass();
      if (audioCtx.state === "suspended") {
        await audioCtx.resume().catch(() => {});
      }

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);

      this.audioContext = audioCtx;
      this.analyserNode = analyser;

      // 3. Initialize MediaRecorder with the best available container MIME
      const mimeType = getOptimalAudioMimeType();
      const recorderOptions: MediaRecorderOptions = mimeType ? { mimeType } : {};
      const recorder = new MediaRecorder(stream, recorderOptions);
      this.mediaRecorder = recorder;

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
          this.options.onAudioChunk(event.data, false);
        }
      };

      recorder.onerror = (event: Event) => {
        console.error("MediaRecorder error:", event);
        this.options.onError({
          code: "MIC_UNAVAILABLE",
          message: "An error occurred with audio capture hardware.",
          originalError: event,
        });
      };

      // 4. Start recording with chunk duration (250ms chunks)
      recorder.start(this.options.chunkDurationMs);
      this.isRecording = true;
      this.startTime = Date.now();

      // 5. Start VAD / silence detection loop
      this.startVADLoop(analyser);

      // 6. Max recording safeguard timer
      this.maxTimer = setTimeout(() => {
        if (this.isRecording && !this.isStopping) {
          this.options.onSilenceTimeout();
        }
      }, this.options.maxRecordingMs);
    } catch (err: unknown) {
      this.cleanupHardwareTracks();
      const errorObj = err as { name?: string; message?: string };
      const isPermission =
        errorObj?.name === "NotAllowedError" || errorObj?.name === "PermissionDeniedError";

      const voiceError: VoiceError = {
        code: isPermission ? "PERMISSION_DENIED" : "MIC_UNAVAILABLE",
        message: isPermission
          ? "Microphone permission was denied. Please allow microphone access in your browser."
          : "Unable to access microphone. Please check your audio settings.",
        originalError: err,
      };

      this.options.onError(voiceError);
      throw voiceError;
    }
  }

  /**
   * Stops recording, flushes last chunks, and 100% releases microphone hardware locks.
   */
  public async stopStreaming(): Promise<{ blob: Blob | null; durationMs: number }> {
    if (!this.isRecording || this.isStopping) {
      return { blob: this.getAggregatedBlob(), durationMs: Date.now() - this.startTime };
    }

    this.isStopping = true;

    // Clear timers
    if (this.vadInterval) {
      clearInterval(this.vadInterval);
      this.vadInterval = null;
    }
    if (this.maxTimer) {
      clearTimeout(this.maxTimer);
      this.maxTimer = null;
    }

    const durationMs = Math.max(0, Date.now() - this.startTime);

    return new Promise((resolve) => {
      const finishCleanup = () => {
        const finalBlob = this.getAggregatedBlob();
        if (finalBlob) {
          this.options.onAudioChunk(finalBlob, true);
        }
        this.cleanupHardwareTracks();
        this.isRecording = false;
        this.isStopping = false;
        resolve({ blob: finalBlob, durationMs });
      };

      if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
        this.mediaRecorder.onstop = () => {
          finishCleanup();
        };
        try {
          if (this.mediaRecorder.state === "recording") {
            this.mediaRecorder.requestData();
          }
          this.mediaRecorder.stop();
        } catch {
          finishCleanup();
        }
      } else {
        finishCleanup();
      }
    });
  }

  /**
   * Compiles all recorded chunks into a single Blob.
   */
  public getAggregatedBlob(): Blob | null {
    if (this.audioChunks.length === 0) return null;
    const mime = this.mediaRecorder?.mimeType || getOptimalAudioMimeType() || "audio/webm";
    return new Blob(this.audioChunks, { type: mime });
  }

  /**
   * Complete hardware cleanup: stops every MediaStreamTrack to immediately release
   * the Android / iOS microphone indicator and device locks.
   */
  public cleanupHardwareTracks(): void {
    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach((track) => {
          track.stop();
        });
      } catch (e) {
        console.warn("Track stop error:", e);
      }
      this.mediaStream = null;
    }

    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }

    this.analyserNode = null;
    this.mediaRecorder = null;
    this.isRecording = false;
    this.isStopping = false;
  }

  /**
   * Real-time Voice Activity Detection using frequency domain energy analysis.
   */
  private startVADLoop(analyser: AnalyserNode): void {
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    this.vadInterval = setInterval(() => {
      if (!this.isRecording || this.isStopping) return;

      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avgEnergy = sum / dataArray.length;
      this.options.onAudioLevel(Math.round(avgEnergy));

      const now = Date.now();

      if (avgEnergy >= this.options.energyThreshold) {
        this.hasSpoken = true;
        this.lastSpeechTimestamp = now;
        this.options.onSpeechDetected(true);
      } else if (this.hasSpoken && this.lastSpeechTimestamp > 0) {
        const silenceMs = now - this.lastSpeechTimestamp;
        if (silenceMs >= this.options.silenceThresholdMs && now - this.startTime > 1400) {
          this.options.onSpeechDetected(false);
          this.options.onSilenceTimeout();
        }
      }
    }, 75);
  }
}
