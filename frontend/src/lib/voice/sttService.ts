/**
 * sttService.ts
 *
 * Single Responsibility: Submit audio to the backend STT+RAG pipeline.
 *
 * - NO device detection
 * - NO AudioContext
 * - NO playback
 * - Handles MIME → filename mapping
 * - Handles retries (2 attempts)
 * - Size gate: > 50 bytes (server decides if audio is meaningful)
 */

import type { PipelineResponse } from "@/lib/api/types";

/** Minimum blob size in bytes before we bother sending to the server. */
const MIN_BLOB_BYTES = 50;

/** How many ms to wait between retries. */
const RETRY_DELAY_MS = 600;

export interface STTSubmitOptions {
  /** The recorded audio blob from AudioCapture. */
  blob: Blob | null;
  /** BCP-47 language code (e.g. "hi-IN") or "unknown" for auto-detect. */
  language: string;
  /**
   * Interim transcript from webkitSpeechRecognition (if any).
   * Sent as fallback if STT returns empty.
   */
  fallbackTranscript?: string;
  /** Base URL override, defaults to /api */
  apiBase?: string;
}

export interface STTResult {
  transcript: string;
  language: string;
  response: PipelineResponse;
}

export class STTError extends Error {
  constructor(
    message: string,
    public readonly code: "BLOB_TOO_SMALL" | "NETWORK" | "SERVER" | "EMPTY_TRANSCRIPT",
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "STTError";
  }
}

/**
 * Derives the correct filename from a Blob's MIME type so the backend
 * receives a correctly-typed file regardless of device/browser.
 */
function getFilenameForBlob(blob: Blob): string {
  const mime = blob.type || "";
  if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")) {
    return "recording.mp4";
  }
  if (mime.includes("wav")) {
    return "recording.wav";
  }
  if (mime.includes("ogg")) {
    return "recording.ogg";
  }
  // Default: webm (Chrome, Firefox, Android Chrome all produce this)
  return "recording.webm";
}

/**
 * Normalises a raw backend response into a properly-typed PipelineResponse.
 */
function normaliseResponse(raw: Record<string, unknown>): PipelineResponse {
  const timings = {
    total_ms: (raw.ms_total as number) || 0,
    stt_ms: (raw.ms_stt as number) || 0,
    retrieve_dense_ms: (raw.ms_retrieval as number) || 0,
    retrieve_sparse_ms: 0,
    rerank_ms: 0,
    generate_ms: (raw.ms_generation as number) || 0,
    grounding_ms: 0,
    embed_ms: 0,
    ms_stt: (raw.ms_stt as number) || 0,
    ms_retrieval: (raw.ms_retrieval as number) || 0,
    ms_generation: (raw.ms_generation as number) || 0,
    ms_total: (raw.ms_total as number) || 0,
  };

  const guardrailArr = (raw.guardrails as Array<{ type: string; passed: boolean }>) || [];
  const guardrail_flags = {
    input_safe: !guardrailArr.some((g) => g.type === "toxicity" && !g.passed),
    on_topic: !guardrailArr.some((g) => g.type === "off-topic" && !g.passed),
    retrieval_confident: ((raw.confidence as number) ?? 1.0) > 0.4,
    grounding_passed:
      raw.generation_mode !== "refusal" && !guardrailArr.some((g) => !g.passed),
  };

  return {
    ...(raw as unknown as PipelineResponse),
    refused: raw.generation_mode === "refusal",
    refusal_reason:
      (raw.refusal_reason as string | null) ||
      (raw.generation_mode === "refusal" ? (raw.answer as string) : null),
    timings,
    guardrail_flags,
  };
}

/**
 * Submits audio to the backend STT+RAG pipeline.
 * Works on ALL devices and browsers.
 * Throws STTError on unrecoverable failure.
 */
export async function submitSTT(opts: STTSubmitOptions): Promise<STTResult> {
  const { blob, language, fallbackTranscript = "", apiBase = "/api" } = opts;

  // 1. Guard: send blob only if it has meaningful data
  if (!blob || blob.size < MIN_BLOB_BYTES) {
    // If we have a fallback transcript, fall through to text-only query
    if (!fallbackTranscript.trim()) {
      throw new STTError(
        `Audio blob too small (${blob?.size ?? 0} bytes) and no fallback transcript.`,
        "BLOB_TOO_SMALL"
      );
    }
    return submitTextFallback(fallbackTranscript.trim(), language, apiBase);
  }

  // 2. Build FormData with clean MIME type (strip any ;codecs=opus params)
  const cleanMime = (blob.type || "").split(";")[0].trim().toLowerCase() || "audio/webm";
  const cleanBlob = blob.type !== cleanMime ? new Blob([blob], { type: cleanMime }) : blob;
  const filename = getFilenameForBlob(blob);

  const formData = new FormData();
  formData.append("audio_file", cleanBlob, filename);
  if (fallbackTranscript.trim()) {
    formData.append("fallback_transcript", fallbackTranscript.trim());
  }
  const sttLang = language && language !== "auto" ? language : "unknown";
  formData.append("language", sttLang);

  // 3. POST with one retry
  const url = `${apiBase.replace(/\/+$/, "")}/chat/audio`;
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { method: "POST", body: formData });
      if (!res.ok) {
        throw new STTError(`Server ${res.status}: ${res.statusText}`, "SERVER");
      }
      const raw = (await res.json()) as Record<string, unknown>;
      const response = normaliseResponse(raw);
      return {
        transcript: (
          (response.transcript || response.query || fallbackTranscript) as string
        ).trim(),
        language: (response.language as string) || language,
        response,
      };
    } catch (err) {
      lastError = err;
      if (attempt < 1) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }
  }

  throw new STTError("Network request failed after retries.", "NETWORK", lastError);
}

/**
 * Text-only fallback: submits a plain text query when no audio blob is available.
 */
async function submitTextFallback(
  transcript: string,
  language: string,
  apiBase: string
): Promise<STTResult> {
  const url = `${apiBase.replace(/\/+$/, "")}/chat/text`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: transcript, language }),
  });
  if (!res.ok) {
    throw new STTError(`Text query failed: ${res.status}`, "SERVER");
  }
  const raw = (await res.json()) as Record<string, unknown>;
  const response = normaliseResponse(raw);
  return {
    transcript,
    language: (response.language as string) || language,
    response,
  };
}
