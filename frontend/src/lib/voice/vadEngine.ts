export interface VADEngineOptions {
  /** FFT frequency bins used for energy analysis. Power of 2. Default: 128. */
  fftSize?: number;
  /** Static base energy threshold (0-255) fallback. Default: 18. */
  energyThreshold?: number;
  /**
   * How long (ms) the signal must stay below silence threshold after speech was
   * detected before onSilenceTimeout fires. Default: 480 (Snappy sub-500ms conversational cutoff).
   */
  silenceThresholdMs?: number;
  /**
   * Minimum total recording time (ms) before silence timeout can fire.
   * Prevents instant cut-offs when the user just tapped. Default: 350.
   */
  minRecordingMs?: number;
  /**
   * Maximum total recording duration (ms) before auto-finalizing and submitting.
   * Prevents microphone staying open indefinitely. Default: 12000 (12 seconds).
   */
  maxRecordingMs?: number;
  /**
   * How long (ms) to wait for the user to start speaking before auto-cancelling the mic.
   * Prevents microphone staying active indefinitely if the user tapped mic and walked away.
   * Default: 3500 (3.5 seconds).
   */
  noSpeechTimeoutMs?: number;
  /** VAD polling interval in ms. Default: 40 (25 ticks/sec for sub-50ms responsiveness). */
  pollIntervalMs?: number;
  /** Called on every VAD tick with the current average energy level (0-255). */
  onAudioLevel?: (level: number) => void;
  /** Called when speech energy rises above threshold. */
  onSpeechStart?: () => void;
  /** Called on every tick during silence with remaining time until auto-submit. */
  onSilenceProgress?: (remainingMs: number, ratio: number) => void;
  /** Called when silence timeout fires after speech was detected. */
  onSilenceTimeout?: () => void;
  /** Called when the user never spoke within noSpeechTimeoutMs after opening mic. */
  onNoSpeechTimeout?: () => void;
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

  // Adaptive Noise Floor Calibration
  private calibrationSamples: number[] = [];
  private ambientNoiseFloor = 10;
  private isCalibrated = false;
  private effectiveSpeechThreshold = 18;
  private effectiveSilenceThreshold = 12;

  private readonly silenceThresholdMs: number;
  private readonly minRecordingMs: number;
  private readonly maxRecordingMs: number;
  private readonly noSpeechTimeoutMs: number;
  private readonly pollIntervalMs: number;
  private readonly fftSize: number;
  private readonly opts: VADEngineOptions;

  constructor(opts: VADEngineOptions = {}) {
    this.opts = opts;
    this.fftSize = opts.fftSize ?? 128;
    this.silenceThresholdMs = opts.silenceThresholdMs ?? 480;
    this.minRecordingMs = opts.minRecordingMs ?? 350;
    this.maxRecordingMs = opts.maxRecordingMs ?? 12000;
    this.noSpeechTimeoutMs = opts.noSpeechTimeoutMs ?? 3500;
    this.pollIntervalMs = opts.pollIntervalMs ?? 40;
    this.effectiveSpeechThreshold = opts.energyThreshold ?? 18;
    this.effectiveSilenceThreshold = 12;
  }

  /** Returns true if speech was detected during the current recording session. */
  public hasUserSpoken(): boolean {
    return this.hasSpoken;
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

    try {
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
      analyser.smoothingTimeConstant = 0.35;
      source.connect(analyser);

      this.analyser = analyser;
      this.dataArray = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;
      this.hasSpoken = false;
      this.lastSpeechTs = 0;
      this.startTs = Date.now();
      this.calibrationSamples = [];
      this.isCalibrated = false;
      this.running = true;

      this._startLoop();
    } catch (err) {
      console.error("[VADEngine] start error:", err);
      this.stop();
      throw err;
    }
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

      // If AudioContext was suspended mid-recording, resume silently.
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
      const totalMs = now - this.startTs;

      // ── Step 1: Dynamic Ambient Noise Calibration (First 280ms) ───────────
      if (!this.isCalibrated) {
        this.calibrationSamples.push(avg);
        if (this.calibrationSamples.length >= 7) {
          const ambientSum = this.calibrationSamples.reduce((a, b) => a + b, 0);
          this.ambientNoiseFloor = ambientSum / this.calibrationSamples.length;
          // Set dynamic speech threshold relative to measured room noise
          this.effectiveSpeechThreshold = Math.max(16, this.ambientNoiseFloor + 9);
          this.effectiveSilenceThreshold = Math.max(10, this.ambientNoiseFloor + 4);
          this.isCalibrated = true;
        }
      }

      // ── Step 2: Hard-Cap Maximum Duration (12s Safety Guard) ──────────────
      if (totalMs >= this.maxRecordingMs) {
        this.running = false;
        if (this.vadInterval) {
          clearInterval(this.vadInterval);
          this.vadInterval = null;
        }
        if (this.hasSpoken) {
          this.opts.onSilenceTimeout?.();
        } else {
          this.opts.onNoSpeechTimeout?.();
        }
        return;
      }

      // ── Step 3: Active Speech Detection ──────────────────────────────────
      if (avg >= this.effectiveSpeechThreshold) {
        if (!this.hasSpoken) {
          this.opts.onSpeechStart?.();
        }
        this.hasSpoken = true;
        this.lastSpeechTs = now;
        this.opts.onSilenceProgress?.(this.silenceThresholdMs, 0);
      }
      // ── Step 4: Silence Detection After Speech ────────────────────────────
      else if (this.hasSpoken && this.lastSpeechTs > 0) {
        const silenceMs = now - this.lastSpeechTs;
        const remainingMs = Math.max(0, this.silenceThresholdMs - silenceMs);
        const ratio = Math.min(1, silenceMs / this.silenceThresholdMs);
        this.opts.onSilenceProgress?.(remainingMs, ratio);

        if (silenceMs >= this.silenceThresholdMs && totalMs >= this.minRecordingMs) {
          this.running = false;
          if (this.vadInterval) {
            clearInterval(this.vadInterval);
            this.vadInterval = null;
          }
          this.opts.onSilenceTimeout?.();
        }
      }
      // ── Step 5: Initial No-Speech Inactivity Timeout (4s) ─────────────────
      else if (!this.hasSpoken) {
        if (totalMs >= this.noSpeechTimeoutMs) {
          this.running = false;
          if (this.vadInterval) {
            clearInterval(this.vadInterval);
            this.vadInterval = null;
          }
          this.opts.onNoSpeechTimeout?.();
        }
      }
    }, this.pollIntervalMs);
  }
}
