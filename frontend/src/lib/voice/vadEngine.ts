/**
 * vadEngine.ts
 *
 * Single Responsibility: Voice Activity Detection (VAD) using frequency-domain
 * energy analysis via the Web Audio API AnalyserNode.
 *
 * - Owns its OWN AudioContext — created close to the user-gesture call path
 * - NO microphone access (receives a MediaStream from AudioCapture)
 * - NO recording
 * - NO network calls
 * - Works identically on all browsers and devices
 */

export interface VADEngineOptions {
  /** FFT frequency bins used for energy analysis. Power of 2. Default: 128. */
  fftSize?: number;
  /** Average energy level (0-255) required to consider audio as speech. Default: 3.5. */
  energyThreshold?: number;
  /**
   * How long (ms) the signal must stay below energyThreshold after speech was
   * detected before onSilenceTimeout fires. Default: 1800.
   */
  silenceThresholdMs?: number;
  /**
   * Minimum total recording time (ms) before silence timeout can fire.
   * Prevents instant cut-offs when the user just tapped. Default: 1400.
   */
  minRecordingMs?: number;
  /** VAD polling interval in ms. Default: 75. */
  pollIntervalMs?: number;
  /** Called on every VAD tick with the current average energy level (0-255). */
  onAudioLevel?: (level: number) => void;
  /** Called when speech energy rises above threshold. */
  onSpeechStart?: () => void;
  /** Called when silence timeout fires after speech was detected. */
  onSilenceTimeout?: () => void;
}

export class VADEngine {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array<ArrayBuffer> | null = null;
  private vadInterval: ReturnType<typeof setInterval> | null = null;
  private hasSpoken = false;
  private lastSpeechTs = 0;
  private startTs = 0;
  private running = false;

  private readonly energyThreshold: number;
  private readonly silenceThresholdMs: number;
  private readonly minRecordingMs: number;
  private readonly pollIntervalMs: number;
  private readonly fftSize: number;
  private readonly opts: VADEngineOptions;

  constructor(opts: VADEngineOptions = {}) {
    this.opts = opts;
    this.fftSize = opts.fftSize ?? 128;
    this.energyThreshold = opts.energyThreshold ?? 3.5;
    this.silenceThresholdMs = opts.silenceThresholdMs ?? 1800;
    this.minRecordingMs = opts.minRecordingMs ?? 1400;
    this.pollIntervalMs = opts.pollIntervalMs ?? 75;
  }

  /**
   * Starts VAD on the given MediaStream.
   *
   * Call this IMMEDIATELY after getUserMedia() returns — the call chain is still
   * close enough to the original user gesture for AudioContext creation to succeed
   * on iOS Safari and Android Chrome.
   */
  public async start(stream: MediaStream): Promise<void> {
    if (this.running) return;

    // Create AudioContext here, as early as possible in the async chain
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.audioCtx = new AC();

    // Resume if browser suspended it (some browsers do this even immediately)
    if (this.audioCtx.state === "suspended") {
      await this.audioCtx.resume().catch(() => {});
    }

    const source = this.audioCtx.createMediaStreamSource(stream);
    const analyser = this.audioCtx.createAnalyser();
    analyser.fftSize = this.fftSize;
    analyser.smoothingTimeConstant = 0.4;
    source.connect(analyser);

    this.analyser = analyser;
    this.dataArray = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;
    this.hasSpoken = false;
    this.lastSpeechTs = 0;
    this.startTs = Date.now();
    this.running = true;

    this._startLoop();
  }

  /** Returns the AnalyserNode for waveform visualisation (may be null before start). */
  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  /** Stops the VAD loop and releases the AudioContext. */
  public stop(): void {
    this.running = false;
    if (this.vadInterval) {
      clearInterval(this.vadInterval);
      this.vadInterval = null;
    }
    try { this.audioCtx?.close(); } catch {}
    this.audioCtx = null;
    this.analyser = null;
    this.dataArray = null;
  }

  // ─── private ─────────────────────────────────────────────────────────────

  private _startLoop(): void {
    this.vadInterval = setInterval(() => {
      if (!this.running || !this.analyser || !this.dataArray) return;

      // If AudioContext was suspended mid-recording (can happen on some Android Chrome
      // versions), attempt to resume silently.
      if (this.audioCtx?.state === "suspended") {
        this.audioCtx.resume().catch(() => {});
        return;
      }

      this.analyser.getByteFrequencyData(this.dataArray);

      let sum = 0;
      for (let i = 0; i < this.dataArray.length; i++) {
        sum += this.dataArray[i];
      }
      const avg = sum / this.dataArray.length;
      this.opts.onAudioLevel?.(Math.round(avg));

      const now = Date.now();

      if (avg >= this.energyThreshold) {
        if (!this.hasSpoken) {
          this.opts.onSpeechStart?.();
        }
        this.hasSpoken = true;
        this.lastSpeechTs = now;
      } else if (this.hasSpoken && this.lastSpeechTs > 0) {
        const silenceMs = now - this.lastSpeechTs;
        const totalMs = now - this.startTs;
        if (silenceMs >= this.silenceThresholdMs && totalMs >= this.minRecordingMs) {
          this.running = false;
          if (this.vadInterval) {
            clearInterval(this.vadInterval);
            this.vadInterval = null;
          }
          this.opts.onSilenceTimeout?.();
        }
      }
    }, this.pollIntervalMs);
  }
}
