/**
 * audioCapture.ts
 *
 * Single Responsibility: Manage the browser's MediaRecorder lifecycle.
 *
 * - Requests microphone via getUserMedia
 * - Collects audio chunks into a Blob
 * - Flushes final buffer on stop
 * - Releases ALL hardware tracks on completion
 * - NO AudioContext (VADEngine owns that)
 * - NO VAD logic
 * - NO network calls
 * - Works on ALL browsers and devices
 */

import { getOptimalAudioMimeType } from "./mimeHelper";

export interface AudioCaptureOptions {
  /** Chunk interval in ms. MediaRecorder fires ondataavailable at this rate. Default: 250. */
  chunkDurationMs?: number;
  /** Called for each incoming audio chunk. */
  onChunk?: (chunk: Blob) => void;
}

export class AudioCapture {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private readonly chunkDurationMs: number;
  private readonly onChunk?: (chunk: Blob) => void;

  constructor(opts: AudioCaptureOptions = {}) {
    this.chunkDurationMs = opts.chunkDurationMs ?? 250;
    this.onChunk = opts.onChunk;
  }

  /**
   * Requests microphone access and starts recording.
   * Returns the raw MediaStream so VADEngine can attach to it.
   *
   * Uses only acoustic constraints (echo cancellation, noise suppression,
   * auto gain) — does NOT hardcode sample rate or channel count to remain
   * compatible with all hardware drivers (mobile, desktop, WebView).
   */
  public async start(): Promise<MediaStream> {
    if (this.stream) {
      // Already recording — return existing stream
      return this.stream;
    }

    this.chunks = [];

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.stream = stream;

    const mimeType = getOptimalAudioMimeType();
    const opts: MediaRecorderOptions = mimeType ? { mimeType } : {};
    const recorder = new MediaRecorder(stream, opts);
    this.recorder = recorder;

    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) {
        this.chunks.push(e.data);
        this.onChunk?.(e.data);
      }
    };

    recorder.start(this.chunkDurationMs);
    return stream;
  }

  /**
   * Stops recording, flushes the final buffer, releases all hardware tracks,
   * and returns the complete audio Blob (or null if nothing was captured).
   */
  public async stop(): Promise<Blob | null> {
    if (!this.recorder || this.recorder.state === "inactive") {
      const blob = this._buildBlob();
      this._releaseStream();
      return blob;
    }

    return new Promise<Blob | null>((resolve) => {
      if (!this.recorder) {
        resolve(null);
        return;
      }

      this.recorder.onstop = () => {
        const blob = this._buildBlob();
        this._releaseStream();
        resolve(blob);
      };

      try {
        // requestData() flushes the current encoder buffer into ondataavailable
        // BEFORE stop() — critical for capturing the last spoken words on mobile.
        if (this.recorder.state === "recording") {
          this.recorder.requestData();
        }
        this.recorder.stop();
      } catch {
        const blob = this._buildBlob();
        this._releaseStream();
        resolve(blob);
      }
    });
  }

  /**
   * Forcefully releases all microphone hardware tracks.
   * Safe to call after stop() or in error paths.
   */
  public release(): void {
    this._releaseStream();
  }

  // ─── private ────────────────────────────────────────────────────────────

  private _buildBlob(): Blob | null {
    if (this.chunks.length === 0) return null;
    const mime =
      this.recorder?.mimeType || getOptimalAudioMimeType() || "audio/webm";
    return new Blob(this.chunks, { type: mime });
  }

  private _releaseStream(): void {
    if (this.stream) {
      try {
        this.stream.getTracks().forEach((t) => t.stop());
      } catch {}
      this.stream = null;
    }
    this.recorder = null;
    this.chunks = [];
  }
}
