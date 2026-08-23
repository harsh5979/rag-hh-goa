export interface StageTiming {
  stt_ms?: number | null;
  embed_ms?: number;
  retrieve_dense_ms?: number;
  retrieve_sparse_ms?: number;
  rerank_ms?: number;
  generate_ms?: number;
  grounding_ms?: number;
  total_ms: number;
  ms_stt?: number;
  ms_retrieval?: number;
  ms_generation?: number;
  ms_total?: number;
}

export interface Source {
  passage_id?: string;
  text: string;
  score: number;
  language?: string;
  url?: string;
  chunk_strategy?: "fixed" | "semantic" | "metadata" | string;
  method?: string;
  metadata?: Record<string, any>;
}

export interface GuardrailItem {
  passed: boolean;
  reason?: string | null;
  type: string;
}

export interface GuardrailFlags {
  input_safe: boolean;
  on_topic: boolean;
  retrieval_confident: boolean;
  grounding_passed: boolean;
}

export interface PipelineResponse {
  answer: string;
  sources: Source[];
  timings?: StageTiming;
  guardrail_flags?: GuardrailFlags;
  guardrails?: GuardrailItem[];
  refused?: boolean;
  refusal_reason?: string | null;
  generation_mode: "extractive" | "groq" | "fallback" | "refusal" | string;
  confidence?: number;
  model_used?: string;
  transcript?: string;
  query?: string;
  language?: string;
  ms_stt?: number;
  ms_retrieval?: number;
  ms_generation?: number;
  ms_total?: number;
}
