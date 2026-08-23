import type {
  IndicLanguageCode,
  ServerWebSocketMessage,
  VoiceError,
  VoiceStreamTimings,
} from "./types";
import type { PipelineResponse } from "@/lib/api/types";
import { audioApi } from "@/lib/api/audioApi";

export interface VoiceWebSocketOptions {
  language?: IndicLanguageCode;
  wsUrl?: string;
  onTranscript?: (transcript: string, isFinal: boolean, language?: string) => void;
  onRagResponse?: (response: PipelineResponse) => void;
  onTtsChunk?: (audioBase64: string, isLast: boolean, languageCode?: string) => void;
  onDone?: (timings: VoiceStreamTimings, response?: PipelineResponse) => void;
  onError?: (error: VoiceError) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
}

/**
 * Derives the optimal WebSocket URL based on current host & protocol.
 */
function resolveWebSocketUrl(language: string, explicitUrl?: string): string {
  if (explicitUrl) {
    const separator = explicitUrl.includes("?") ? "&" : "?";
    return `${explicitUrl}${separator}lang=${encodeURIComponent(language)}`;
  }

  if (typeof window === "undefined") {
    return `ws://localhost:8000/ws/voice?lang=${encodeURIComponent(language)}`;
  }

  const envWs = process.env.NEXT_PUBLIC_WS_URL;
  if (envWs) {
    const separator = envWs.includes("?") ? "&" : "?";
    return `${envWs}${separator}lang=${encodeURIComponent(language)}`;
  }

  const envApi = process.env.NEXT_PUBLIC_API_URL;
  if (envApi && envApi.startsWith("http")) {
    const wsProto = envApi.startsWith("https") ? "wss:" : "ws:";
    const host = envApi.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    return `${wsProto}//${host}/ws/voice?lang=${encodeURIComponent(language)}`;
  }

  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  return `${proto}//${host}/ws/voice?lang=${encodeURIComponent(language)}`;
}

export class VoiceWebSocketClient {
  private socket: WebSocket | null = null;
  private pendingQueue: ArrayBuffer[] = [];
  private isConnecting = false;
  private isConnected = false;
  private language: IndicLanguageCode = "en-IN";
  private options: VoiceWebSocketOptions;
  private timings: VoiceStreamTimings = { streamStartMs: 0 };
  private sessionResponse: Partial<PipelineResponse> = {};

  constructor(options: VoiceWebSocketOptions = {}) {
    this.options = options;
    this.language = options.language || "en-IN";
  }

  public setLanguage(lang: IndicLanguageCode) {
    this.language = lang;
  }

  public getLanguage(): IndicLanguageCode {
    return this.language;
  }

  public isSocketOpen(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  /**
   * Opens WebSocket connection to backend.
   */
  public async connect(): Promise<void> {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isConnecting = true;
    this.timings = { streamStartMs: Date.now() };
    this.sessionResponse = {};

    const targetUrl = resolveWebSocketUrl(this.language, this.options.wsUrl);

    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(targetUrl);
        ws.binaryType = "arraybuffer";
        this.socket = ws;

        ws.onopen = () => {
          this.isConnecting = false;
          this.isConnected = true;
          this.flushPendingQueue();
          this.options.onConnected?.();
          resolve();
        };

        ws.onmessage = (event: MessageEvent) => {
          this.handleIncomingMessage(event);
        };

        ws.onerror = (event: Event) => {
          console.warn("[VoiceWebSocket] Socket connection error, falling back to REST:", event);
          this.isConnecting = false;
          this.options.onError?.({
            code: "WS_DISCONNECTED",
            message: "WebSocket connection error.",
            originalError: event,
          });
          resolve(); // Resolve to allow REST fallback if WS is down
        };

        ws.onclose = () => {
          this.isConnected = false;
          this.isConnecting = false;
          this.socket = null;
          this.options.onDisconnected?.();
        };

        // Safety timeout for socket connection (1.5s)
        setTimeout(() => {
          if (this.isConnecting) {
            this.isConnecting = false;
            resolve();
          }
        }, 1500);
      } catch (err) {
        this.isConnecting = false;
        resolve();
      }
    });
  }

  /**
   * Sends an audio frame (ArrayBuffer or Blob). Queues data if still connecting.
   */
  public async sendAudioChunk(data: Blob | ArrayBuffer): Promise<void> {
    let buffer: ArrayBuffer;
    if (data instanceof Blob) {
      buffer = await data.arrayBuffer();
    } else {
      buffer = data;
    }

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(buffer);
      if (!this.timings.firstChunkMs) {
        this.timings.firstChunkMs = Date.now();
      }
    } else {
      // Buffer in queue to guarantee zero dropped frames during handshake
      this.pendingQueue.push(buffer);
    }
  }

  /**
   * Notifies backend that user has finished speaking and audio input has ended.
   */
  public sendEnd(fallbackTranscript?: string): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: "end_stream",
          language: this.language,
          fallback_transcript: fallbackTranscript || "",
        })
      );
    }
  }

  /**
   * Gracefully closes WebSocket session.
   */
  public close(): void {
    if (this.socket) {
      try {
        if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
          this.socket.close(1000, "Client closed stream");
        }
      } catch {}
      this.socket = null;
    }
    this.pendingQueue = [];
    this.isConnected = false;
    this.isConnecting = false;
  }

  /**
   * Fallback to standard multipart HTTP POST `/chat/audio` if WebSocket is unavailable.
   */
  public async fallbackRestAudioQuery(
    audioBlob: Blob,
    fallbackTranscript?: string
  ): Promise<PipelineResponse> {
    return await audioApi.sendAudioQuery(audioBlob, fallbackTranscript);
  }

  private flushPendingQueue(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    while (this.pendingQueue.length > 0) {
      const chunk = this.pendingQueue.shift();
      if (chunk) {
        this.socket.send(chunk);
      }
    }
  }

  private handleIncomingMessage(event: MessageEvent): void {
    // 1. Binary payload (e.g. raw PCM or audio packet)
    if (event.data instanceof ArrayBuffer) {
      const base64 = this.arrayBufferToBase64(event.data);
      this.options.onTtsChunk?.(base64, false, this.language);
      return;
    }

    // 2. Text / JSON payload
    if (typeof event.data === "string") {
      try {
        const msg = JSON.parse(event.data) as ServerWebSocketMessage;

        switch (msg.type) {
          case "transcript": {
            if (!this.timings.transcriptReceivedMs) {
              this.timings.transcriptReceivedMs = Date.now();
            }
            this.sessionResponse.transcript = msg.transcript;
            this.options.onTranscript?.(msg.transcript, Boolean(msg.is_final), msg.language);
            break;
          }

          case "rag_response": {
            if (!this.timings.ragResponseReceivedMs) {
              this.timings.ragResponseReceivedMs = Date.now();
            }
            const fullResponse: PipelineResponse = {
              answer: msg.answer,
              sources: msg.sources || [],
              timings: msg.timings || { total_ms: 0 },
              confidence: msg.confidence ?? 0.9,
              generation_mode: msg.generation_mode || "groq",
              refused: msg.refused ?? false,
              refusal_reason: msg.refusal_reason,
              transcript: this.sessionResponse.transcript || "",
            };
            this.sessionResponse = fullResponse;
            this.options.onRagResponse?.(fullResponse);
            break;
          }

          case "tts_chunk": {
            if (!this.timings.firstAudioReceivedMs) {
              this.timings.firstAudioReceivedMs = Date.now();
            }
            if (msg.audio_base64) {
              this.options.onTtsChunk?.(msg.audio_base64, Boolean(msg.is_last), msg.language_code);
            }
            break;
          }

          case "done": {
            this.timings.totalLatencyMs = Date.now() - (this.timings.streamStartMs || Date.now());
            const finalResp = (msg.response || this.sessionResponse) as PipelineResponse;
            this.options.onDone?.(this.timings, finalResp);
            break;
          }

          case "error": {
            this.options.onError?.({
              code: "RAG_FAILED",
              message: msg.message || "Streaming server encountered an error",
            });
            break;
          }
        }
      } catch (err) {
        console.warn("[VoiceWebSocket] Error parsing server message:", err, event.data);
      }
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }
}
