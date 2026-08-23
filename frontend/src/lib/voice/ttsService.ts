/**
 * ttsService.ts
 *
 * Single Responsibility: Request TTS audio from the backend and play it.
 *
 * - NO device detection
 * - NO microphone access
 * - NO recording
 * - Owns its AudioContext (one per service instance)
 * - unlock() MUST be called inside a user gesture handler
 * - Falls back to HTMLAudioElement if AudioContext decode fails
 */

const RETRY_DELAY_MS = 400;

export interface TTSServiceOptions {
  /** Speaker voice ID. Defaults to "anushka". */
  speaker?: string;
  /** Called when playback starts. */
  onPlayStart?: () => void;
  /** Called with 0→1 progress. */
  onProgress?: (progress: number) => void;
  /** Called when playback ends naturally. */
  onPlayEnd?: () => void;
}

export class TTSService {
  private audioCtx: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private progressTimer: ReturnType<typeof setInterval> | null = null;
  private isPlaying = false;
  private readonly speaker: string;
  private readonly opts: TTSServiceOptions;

  constructor(opts: TTSServiceOptions = {}) {
    this.opts = opts;
    this.speaker = opts.speaker ?? "anushka";
  }

  /**
   * Unlocks the Web Audio API on all browsers.
   * MUST be called synchronously inside a user gesture handler (tap / click).
   * Safe to call multiple times.
   */
  public async unlock(): Promise<void> {
    if (typeof window === "undefined") return;
    try {
      if (!this.audioCtx) {
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        this.audioCtx = new AC();
      }
      if (this.audioCtx.state === "suspended") {
        await this.audioCtx.resume();
      }
      // Prime HTMLAudioElement fallback with a silent buffer
      if (!this.audioEl) {
        this.audioEl = new Audio();
        this.audioEl.src =
          "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
        await this.audioEl.play().catch(() => {});
        this.audioEl.pause();
      }
    } catch (e) {
      // Non-fatal: unlock is best-effort
      console.debug("[TTSService] unlock note:", e);
    }
  }

  /**
   * Requests TTS from the backend and plays the result.
   * Returns when playback is complete (or on error).
   */
  public async speak(text: string, language: string, apiBase = "/api"): Promise<void> {
    if (!text.trim() || typeof window === "undefined") return;

    this.stop();
    this.isPlaying = true;
    this.opts.onPlayStart?.();

    try {
      // 1. Ensure audio context is resumed
      if (this.audioCtx?.state === "suspended") {
        await this.audioCtx.resume().catch(() => {});
      }

      // 2. Fetch TTS audio from backend
      const audio64 = await this._fetchTTS(text, language, apiBase);
      if (!audio64) {
        this.isPlaying = false;
        this.opts.onPlayEnd?.();
        return;
      }

      // 3. Decode base64 → ArrayBuffer
      const bytes = window.atob(audio64);
      const buffer = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) {
        buffer[i] = bytes.charCodeAt(i);
      }

      // 4a. Preferred: Web Audio API
      if (this.audioCtx && this.audioCtx.state !== "closed") {
        try {
          await this._playViaWebAudio(buffer.buffer);
          return;
        } catch (err) {
          console.debug("[TTSService] Web Audio decode failed, falling back:", err);
        }
      }

      // 4b. Fallback: HTMLAudioElement
      await this._playViaHTMLAudio(audio64);
    } catch (err) {
      console.warn("[TTSService] speak error:", err);
      this.isPlaying = false;
      this.opts.onPlayEnd?.();
    }
  }

  /** Immediately stops any in-progress playback. */
  public stop(): void {
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
    try { this.sourceNode?.stop(); } catch { /* already stopped */ }
    try { this.sourceNode?.disconnect(); } catch {}
    this.sourceNode = null;
    if (this.audioEl) {
      try { this.audioEl.pause(); this.audioEl.currentTime = 0; } catch {}
    }
    this.isPlaying = false;
    this.opts.onProgress?.(0);
  }

  /** Releases all resources. */
  public destroy(): void {
    this.stop();
    try { this.audioCtx?.close(); } catch {}
    this.audioCtx = null;
    this.audioEl = null;
  }

  public isCurrentlyPlaying(): boolean {
    return this.isPlaying;
  }

  // ─── private ────────────────────────────────────────────────────────────

  private async _fetchTTS(text: string, language: string, apiBase: string): Promise<string> {
    const url = `${apiBase.replace(/\/+$/, "")}/chat/tts`;
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, target_language_code: language, speaker: this.speaker }),
        });
        if (!res.ok) throw new Error(`TTS ${res.status}`);
        const data = (await res.json()) as { audio_base64?: string };
        return data.audio_base64 ?? "";
      } catch (err) {
        lastErr = err;
        if (attempt < 1) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }
    throw lastErr;
  }

  private async _playViaWebAudio(arrayBuffer: ArrayBuffer): Promise<void> {
    if (!this.audioCtx) throw new Error("No AudioContext");
    const audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
    const source = this.audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioCtx.destination);
    this.sourceNode = source;

    const duration = audioBuffer.duration;
    const startTime = this.audioCtx.currentTime;
    this.progressTimer = setInterval(() => {
      if (!this.audioCtx) return;
      const elapsed = this.audioCtx.currentTime - startTime;
      this.opts.onProgress?.(Math.min(1, elapsed / duration));
    }, 50);

    await new Promise<void>((resolve) => {
      source.onended = () => {
        if (this.progressTimer) clearInterval(this.progressTimer);
        this.isPlaying = false;
        this.opts.onProgress?.(1);
        this.opts.onPlayEnd?.();
        resolve();
      };
      source.start(0);
    });
  }

  private async _playViaHTMLAudio(base64: string): Promise<void> {
    if (!this.audioEl) this.audioEl = new Audio();
    const el = this.audioEl;
    el.src = `data:audio/wav;base64,${base64}`;

    await new Promise<void>((resolve) => {
      el.ontimeupdate = () => {
        if (el.duration > 0) this.opts.onProgress?.(el.currentTime / el.duration);
      };
      el.onended = () => {
        this.isPlaying = false;
        this.opts.onProgress?.(1);
        this.opts.onPlayEnd?.();
        resolve();
      };
      el.onerror = () => {
        this.isPlaying = false;
        this.opts.onPlayEnd?.();
        resolve();
      };
      el.play().catch(() => {
        this.isPlaying = false;
        this.opts.onPlayEnd?.();
        resolve();
      });
    });
  }
}
