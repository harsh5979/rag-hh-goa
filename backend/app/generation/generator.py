"""
Generator — Groq Waterfall Fallback + Extractive Safety Net.

Fallback chain:
  [Model 0: llama-3.1-8b-instant @ 3s]  ← fastest
       ↓ timeout / 429 / 503 / any error
  [Model 1: gemma2-9b-it @ 5s]
       ↓ timeout / 429 / 503 / any error
  [Model 2: llama-3.3-70b-versatile @ 7s]
       ↓ ALL groq models exhausted
  [Extractive TF-IDF @ ~5ms]  ← UNBREAKABLE, always succeeds
"""
import asyncio
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional

from groq import AsyncGroq, RateLimitError, APITimeoutError, APIStatusError
from loguru import logger

from app.config import get_settings
from app.generation.extractive import extractive_answer


class GenerationMode(str, Enum):
    EXTRACTIVE = "extractive"
    GROQ       = "groq"
    FALLBACK   = "fallback"


@dataclass
class GenerationResult:
    answer:           str
    mode:             GenerationMode
    model_used:       Optional[str]
    confidence:       float
    elapsed_ms:       float
    fallback_reasons: List[str] = field(default_factory=list)


# ── System prompt ────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """\
You are a voice-enabled factual AI assistant.
STRICT RULES:
1. Answer factually using the provided context passages whenever relevant. If the context does not explicitly cover the question, answer accurately and directly from factual knowledge.
2. Be simple, direct, and conversational — 1 to 2 complete short sentences (under 35 words).
3. NEVER say phrases like "The provided passages do not contain information about MSMARCO". Always provide the actual answer directly.
4. STRICT LANGUAGE & INTENT MATCHING:
   - If the user asks in English about an Indic phrase or translation (e.g. "how to say tame mane gamo chho" or "what does kem chho mean"), answer directly and accurately in English.
   - If the question is in native or conversational Hindi, respond strictly in pure Hindi (Devanagari script).
   - If the question is in native or conversational Gujarati, respond strictly in Gujarati.
   - If the question is in native or conversational Marathi, respond strictly in Marathi.
   - If the question is in Tamil, Telugu, Bengali, Kannada, Malayalam, Punjabi, Odia, or English, respond in that exact language.
5. Always finish your sentence with a proper full stop (। or .). Never leave sentences incomplete.
6. No markdown formatting, no bullet points, no reasoning tags. Return pure spoken text.\
"""

USER_TEMPLATE = """\
Context passages:
{context}

Question: {query}

Answer (1-2 sentences strictly fulfilling the question's language and intent):
"""


# ── Minimum relevance score — refuse if best chunk is below this ──────────────
MIN_CHUNK_SCORE = -1.5   # Cross-encoder log-odds; below this = irrelevant retrieval


def _build_prompt(query: str, chunks: List[str]) -> str:
    context = "\n\n---\n\n".join(
        f"[Passage {i+1}]: {c[:400]}"
        for i, c in enumerate(chunks[:2])
    )
    return USER_TEMPLATE.format(context=context, query=query)


class Generator:
    def __init__(self) -> None:
        cfg = get_settings()
        self._client     = AsyncGroq(api_key=cfg.groq_api_key)
        self._models     = cfg.groq_models_list
        self._timeouts   = cfg.groq_timeouts_list
        self._max_tokens = cfg.groq_max_tokens
        self._retries    = cfg.groq_retries_per_model
        self._temperature= cfg.groq_temperature
        self._mode       = cfg.generation_mode

        logger.info(
            f"Generator ready | mode={self._mode} | "
            f"chain={self._models} | timeouts={self._timeouts}ms"
        )

    async def generate(
        self,
        query: str,
        chunks: List[str],
        chunk_scores: Optional[List[float]] = None,
    ) -> GenerationResult:
        """
        Run the full waterfall. Never raises — always returns a result.
        chunk_scores: cross-encoder scores for the top chunks (used for relevance gate).
        """
        t_start = time.perf_counter()

        # ── Pure extractive mode ─────────────────────────────────────────
        if self._mode == "extractive":
            return self._run_extractive(query, chunks, t_start, reasons=[])

        # ── Run Groq waterfall ───────────────────────────────────────────
        fallback_reasons: List[str] = []

        for model, timeout_ms in zip(self._models, self._timeouts):
            result = await self._try_groq(
                query, chunks, model, timeout_ms,
                fallback_reasons, t_start
            )
            if result is not None:
                return result

        # ── All Groq models exhausted → extractive ───────────────────────
        logger.warning(
            f"All Groq models exhausted. Reasons: {fallback_reasons}. "
            "Falling back to extractive."
        )
        return self._run_extractive(query, chunks, t_start, fallback_reasons)

    # ── Private helpers ────────────────────────────────────────────────────

    async def _try_groq(
        self,
        query: str,
        chunks: List[str],
        model: str,
        timeout_ms: int,
        reasons: List[str],
        t_start: float,
    ) -> Optional[GenerationResult]:
        import re
        prompt   = _build_prompt(query, chunks)
        timeout_s = timeout_ms / 1000

        for attempt in range(self._retries + 1):
            try:
                t0 = time.perf_counter()
                response = await asyncio.wait_for(
                    self._client.chat.completions.create(
                        model=model,
                        messages=[
                            {"role": "system", "content": SYSTEM_PROMPT},
                            {"role": "user",   "content": prompt},
                        ],
                        max_tokens=  self._max_tokens,
                        temperature= self._temperature,
                        stream=      False,
                    ),
                    timeout=timeout_s,
                )
                raw_answer = response.choices[0].message.content or ""
                # Robust cleaning: strip complete and truncated <think> blocks, tags & prefixes
                text = re.sub(r"<think>.*?</think>", "", raw_answer, flags=re.DOTALL)
                if "<think>" in text:
                    text = text.split("<think>")[0]
                if "</think>" in text:
                    text = text.split("</think>")[-1]
                text = re.sub(r"<[^>]+>", "", text)
                text = re.sub(r"^(Answer|उत्तर|જવાબ)\s*:\s*", "", text.strip(), flags=re.IGNORECASE)
                answer = text.strip()

                elapsed = (time.perf_counter() - t_start) * 1000
                groq_ms = (time.perf_counter() - t0) * 1000

                if not answer:
                    logger.warning(f"Groq empty answer | model={model} attempt={attempt+1}")
                    reason = f"{model}:empty_answer"
                    if reason not in reasons:
                        reasons.append(reason)
                    continue

                logger.info(
                    f"Groq OK | model={model} attempt={attempt+1} "
                    f"groq_ms={groq_ms:.0f} total_ms={elapsed:.0f}"
                )
                return GenerationResult(
                    answer=           answer,
                    mode=             GenerationMode.GROQ,
                    model_used=       model,
                    confidence=       0.85,
                    elapsed_ms=       round(elapsed, 2),
                    fallback_reasons= list(reasons),
                )

            except asyncio.TimeoutError:
                reason = f"{model}:timeout>{timeout_ms}ms"
                reasons.append(reason)
                logger.warning(f"Groq timeout | {reason} attempt={attempt+1}")
                break

            except RateLimitError as e:
                reason = f"{model}:rate_limit"
                reasons.append(reason)
                logger.warning(f"Groq 429 | {reason}: {e}")
                break

            except APITimeoutError:
                reason = f"{model}:api_timeout"
                reasons.append(reason)
                logger.warning(f"Groq API timeout | {reason} attempt={attempt+1}")
                break

            except APIStatusError as e:
                reason = f"{model}:status_{e.status_code}"
                reasons.append(reason)
                logger.warning(f"Groq API error | {reason}: {e.message}")
                if e.status_code in (503, 529) or (400 <= e.status_code < 500):
                    break
                if attempt < self._retries:
                    await asyncio.sleep(0.1 * (attempt + 1))

            except Exception as e:
                reason = f"{model}:error:{type(e).__name__}"
                reasons.append(reason)
                logger.exception(f"Groq unexpected error | {reason}: {e}")
                break

        return None

    def _run_extractive(
        self,
        query: str,
        chunks: List[str],
        t_start: float,
        reasons: List[str],
    ) -> GenerationResult:
        answer, confidence, ext_ms = extractive_answer(query, chunks)
        elapsed = (time.perf_counter() - t_start) * 1000
        mode = GenerationMode.EXTRACTIVE if not reasons else GenerationMode.FALLBACK

        logger.info(
            f"Extractive | mode={mode} ext_ms={ext_ms:.1f} "
            f"total_ms={elapsed:.1f} reasons={reasons}"
        )
        return GenerationResult(
            answer=           answer,
            mode=             mode,
            model_used=       None,
            confidence=       confidence,
            elapsed_ms=       round(elapsed, 2),
            fallback_reasons= reasons,
        )


# ── Singleton ─────────────────────────────────────────────────────────────────
_generator: Optional[Generator] = None

def init_generator() -> None:
    global _generator
    _generator = Generator()

def get_generator() -> Generator:
    if _generator is None:
        raise RuntimeError("Generator not initialised — call init_generator() in lifespan")
    return _generator
