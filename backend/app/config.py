"""
Backend Settings — loaded once at startup via pydantic-settings.
All values come from backend/.env (or environment variables).
"""
from functools import lru_cache
from typing import List
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── APIs ────────────────────────────────────────────────
    sarvam_api_key: str = ""
    groq_api_key:   str = ""

    # ── Generation ──────────────────────────────────────────
    generation_mode: str = "auto"   # "extractive" | "groq" | "auto"

    # Comma-separated fallback model chain
    groq_fallback_models: str = (
        "openai/gpt-oss-120b,openai/gpt-oss-20b,qwen/qwen3.6-27b,groq/compound-mini"
    )
    # Comma-separated per-model timeout budgets (ms), same length as models
    groq_timeouts_ms: str = "6000,8000"

    groq_max_tokens:          int   = 120   # short focused answers
    groq_retries_per_model:   int   = 1
    groq_temperature:         float = 0.05  # very low temp = more faithful to context

    # ── Derived properties (parse CSV fields) ───────────────
    @property
    def groq_models_list(self) -> List[str]:
        return [m.strip() for m in self.groq_fallback_models.split(",") if m.strip()]

    @property
    def groq_timeouts_list(self) -> List[int]:
        raw = [t.strip() for t in self.groq_timeouts_ms.split(",") if t.strip()]
        timeouts = [int(t) for t in raw]
        # Pad with last value if fewer timeouts than models
        models = self.groq_models_list
        while len(timeouts) < len(models):
            timeouts.append(timeouts[-1] if timeouts else 500)
        return timeouts[:len(models)]

    # ── Retrieval ───────────────────────────────────────────
    faiss_index_path: str = "indexes/msmarco.faiss"
    bm25_index_path:  str = "indexes/msmarco.bm25"
    metadata_path:    str = "indexes/metadata.jsonl"
    top_k_dense:      int = 20
    top_k_sparse:     int = 20
    top_k_rerank:     int = 5

    # ── Guardrails ──────────────────────────────────────────
    off_topic_threshold:       float = 0.35
    grounding_threshold:       float = 0.60
    retrieval_confidence_min:  float = 0.40

    # ── Redis ───────────────────────────────────────────────
    redis_url:         str = "redis://localhost:6379"
    cache_ttl_seconds: int = 3600

    # ── Logging ─────────────────────────────────────────────
    log_level:     str = "INFO"
    requests_log:  str = "logs/requests.jsonl"
    guardrail_log: str = "logs/guardrail_events.jsonl"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
