import { apiClient } from "./client";
import type { PipelineResponse } from "./types";

export const audioApi = {
  async sendAudioQuery(audioBlob: Blob, fallbackTranscript?: string, language?: string): Promise<PipelineResponse> {
    const formData = new FormData();
    formData.append("audio_file", audioBlob, "recording.webm");
    if (fallbackTranscript && fallbackTranscript.trim()) {
      formData.append("fallback_transcript", fallbackTranscript.trim());
    }
    if (language && language.trim()) {
      formData.append("language", language.trim());
    }
    
    const response = await apiClient.postFormData<any>("/chat/audio", formData);
    
    // Normalize response for frontend
    const timings = {
      total_ms: response.ms_total || 0,
      stt_ms: response.ms_stt || 0,
      retrieve_dense_ms: response.ms_retrieval || 0,
      retrieve_sparse_ms: 0,
      rerank_ms: 0,
      generate_ms: response.ms_generation || 0,
      grounding_ms: 0,
      embed_ms: 0,
      ms_stt: response.ms_stt || 0,
      ms_retrieval: response.ms_retrieval || 0,
      ms_generation: response.ms_generation || 0,
      ms_total: response.ms_total || 0,
    };

    const guardrail_flags = {
      input_safe: !response.guardrails?.some((g: any) => g.type === "toxicity" && !g.passed),
      on_topic: !response.guardrails?.some((g: any) => g.type === "off-topic" && !g.passed),
      retrieval_confident: (response.confidence ?? 1.0) > 0.4,
      grounding_passed: response.generation_mode !== "refusal" && !response.guardrails?.some((g: any) => !g.passed),
    };

    return {
      ...response,
      refused: response.generation_mode === "refusal",
      refusal_reason: response.refusal_reason || (response.generation_mode === "refusal" ? response.answer : null),
      timings,
      guardrail_flags,
    };
  },

  async sendTTS(text: string, target_language_code?: string): Promise<{ audio_base64: string; language_code: string }> {
    const response = await apiClient.post<any>("/chat/tts", {
      text,
      target_language_code,
      speaker: "anushka",
    });
    return response;
  }
};

