import type { PipelineResponse, Source, StageTiming } from "@/lib/api/types";

/**
 * Supported Indic and Indian English language codes across the 11 official pipeline targets.
 */
export type IndicLanguageCode =
  | "auto"  // Auto-Detect language (Sarvam AI)
  | "gu-IN" // Gujarati
  | "hi-IN" // Hindi
  | "mr-IN" // Marathi
  | "ta-IN" // Tamil
  | "te-IN" // Telugu
  | "bn-IN" // Bengali
  | "kn-IN" // Kannada
  | "ml-IN" // Malayalam
  | "pa-IN" // Punjabi
  | "or-IN" // Odia
  | "en-IN"; // Indian English

/**
 * State machine for Voice RAG interaction.
 */
export type VoiceState =
  | "idle"
  | "requesting_permission"
  | "connecting"
  | "listening"
  | "processing"
  | "speaking"
  | "error";

/**
 * Standardized client-facing voice error structure.
 */
export interface VoiceError {
  code:
    | "PERMISSION_DENIED"
    | "MIC_UNAVAILABLE"
    | "UNSUPPORTED_BROWSER"
    | "WS_DISCONNECTED"
    | "STT_FAILED"
    | "RAG_FAILED"
    | "TTS_FAILED"
    | "UNKNOWN";
  message: string;
  originalError?: unknown;
}

/**
 * Inbound WebSocket messages received from backend streaming server.
 */
export type ServerWebSocketMessage =
  | {
      type: "connected";
      session_id?: string;
      message?: string;
    }
  | {
      type: "transcript";
      transcript: string;
      is_final?: boolean;
      language?: string;
      confidence?: number;
      ms_elapsed?: number;
    }
  | {
      type: "rag_response";
      answer: string;
      sources?: Source[];
      timings?: StageTiming;
      confidence?: number;
      generation_mode?: string;
      refused?: boolean;
      refusal_reason?: string | null;
    }
  | {
      type: "tts_chunk";
      audio_base64?: string;
      is_last?: boolean;
      language_code?: string;
    }
  | {
      type: "done";
      ms_total?: number;
      response?: PipelineResponse;
    }
  | {
      type: "error";
      message: string;
      code?: string;
    };

/**
 * Configuration options for useVoiceRag and streaming clients.
 */
export interface VoiceConfig {
  language?: IndicLanguageCode;
  sampleRate?: number;
  chunkDurationMs?: number;
  silenceThresholdMs?: number;
  energyThreshold?: number;
  autoSpeak?: boolean;
  speaker?: "anushka" | "arvind" | string;
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  onResponse?: (response: PipelineResponse) => void;
  onError?: (error: VoiceError) => void;
  onStateChange?: (state: VoiceState) => void;
}

/**
 * Device category detected for audio handling optimization.
 */
export type DeviceCategory = "android" | "ios" | "desktop" | "other";

/**
 * Stream timing telemetry for real-time latency monitoring.
 */
export interface VoiceStreamTimings {
  streamStartMs: number;
  firstChunkMs?: number;
  transcriptReceivedMs?: number;
  ragResponseReceivedMs?: number;
  firstAudioReceivedMs?: number;
  totalLatencyMs?: number;
}
