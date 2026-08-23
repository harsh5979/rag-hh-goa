import type { VoiceError } from "./types";

export interface VoicePlayerOptions {
  onPlayStart?: () => void;
  onProgress?: (progress: number) => void;
  onPlayEnd?: () => void;
  onError?: (error: VoiceError) => void;
}

export class VoicePlayer {
  private audioContext: AudioContext | null = null;
  private currentSourceNode: AudioBufferSourceNode | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private isPlaying = false;
  private isUnlocked = false;
  private options: VoicePlayerOptions;
  private playbackInterval: ReturnType<typeof setInterval> | null = null;

  constructor(options: VoicePlayerOptions = {}) {
    this.options = options;
  }

  /**
   * Resumes the Web Audio Context and unlocks iOS / Android autoplay restrictions.
   * Call this upon user gesture (tap, click).
   */
  public async unlockAudio(): Promise<void> {
    if (typeof window === "undefined") return;

    try {
      if (!this.audioContext) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.audioContext = new AudioCtx();
      }

      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      // Also create and prime HTMLAudioElement for fallback
      if (!this.audioElement) {
        this.audioElement = new Audio();
        // Play silent wav buffer
        this.audioElement.src =
          "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
        await this.audioElement.play().catch(() => {});
        this.audioElement.pause();
      }

      this.isUnlocked = true;
    } catch (e) {
      console.debug("[VoicePlayer] Audio unlock note:", e);
    }
  }

  public isCurrentlyPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Plays base64-encoded audio (WAV, MP3, etc.) returned by Sarvam TTS with ultra-low latency.
   */
  public async playBase64(base64Audio: string): Promise<void> {
    if (!base64Audio || typeof window === "undefined") return;

    this.stop();
    this.isPlaying = true;
    this.options.onPlayStart?.();

    try {
      await this.unlockAudio();

      // Convert base64 to ArrayBuffer
      const binaryString = window.atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const arrayBuffer = bytes.buffer;

      // Method 1: Web Audio API AudioContext decodeAudioData
      if (this.audioContext && this.audioContext.state !== "closed") {
        try {
          const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer.slice(0));
          const source = this.audioContext.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(this.audioContext.destination);
          this.currentSourceNode = source;

          const durationSec = audioBuffer.duration;
          const startTime = this.audioContext.currentTime;

          // Track playback progress
          if (this.playbackInterval) clearInterval(this.playbackInterval);
          this.playbackInterval = setInterval(() => {
            if (!this.isPlaying || !this.audioContext) {
              if (this.playbackInterval) clearInterval(this.playbackInterval);
              return;
            }
            const elapsed = this.audioContext.currentTime - startTime;
            const progress = Math.min(1, Math.max(0, elapsed / durationSec));
            this.options.onProgress?.(progress);
          }, 50);

          source.onended = () => {
            if (this.playbackInterval) clearInterval(this.playbackInterval);
            this.isPlaying = false;
            this.currentSourceNode = null;
            this.options.onProgress?.(1);
            this.options.onPlayEnd?.();
          };

          source.start(0);
          return;
        } catch (decodeErr) {
          console.debug("[VoicePlayer] AudioContext decode fallback to HTMLAudioElement:", decodeErr);
        }
      }

      // Method 2: HTMLAudioElement fallback
      if (!this.audioElement) {
        this.audioElement = new Audio();
      }

      const audio = this.audioElement;
      audio.src = `data:audio/wav;base64,${base64Audio}`;

      audio.ontimeupdate = () => {
        if (audio.duration && audio.duration > 0) {
          this.options.onProgress?.(audio.currentTime / audio.duration);
        }
      };

      audio.onended = () => {
        this.isPlaying = false;
        this.options.onProgress?.(1);
        this.options.onPlayEnd?.();
      };

      audio.onerror = (err) => {
        console.warn("[VoicePlayer] HTMLAudio playback error:", err);
        this.isPlaying = false;
        this.options.onPlayEnd?.();
      };

      await audio.play();
    } catch (err: unknown) {
      console.warn("[VoicePlayer] Playback failure:", err);
      this.isPlaying = false;
      this.options.onPlayEnd?.();
      this.options.onError?.({
        code: "TTS_FAILED",
        message: "Failed to play audio output.",
        originalError: err,
      });
    }
  }

  /**
   * Immediately stops audio playback.
   */
  public stop(): void {
    if (this.playbackInterval) {
      clearInterval(this.playbackInterval);
      this.playbackInterval = null;
    }

    if (this.currentSourceNode) {
      try {
        this.currentSourceNode.stop();
        this.currentSourceNode.disconnect();
      } catch {}
      this.currentSourceNode = null;
    }

    if (this.audioElement) {
      try {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
      } catch {}
    }

    this.isPlaying = false;
    this.options.onProgress?.(0);
  }

  public destroy(): void {
    this.stop();
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }
    this.audioElement = null;
  }
}
