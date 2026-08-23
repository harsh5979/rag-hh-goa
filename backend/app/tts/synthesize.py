"""
app/tts/synthesize.py

Single Responsibility: Sarvam AI Text-to-Speech synthesis.

Extracted from stt/transcribe.py to keep STT and TTS concerns separate.
"""
import time
from typing import Optional

import httpx
from fastapi import HTTPException
from loguru import logger

from app.config import get_settings
from app.language import detect_language

SARVAM_TTS_URL = "https://api.sarvam.ai/text-to-speech"

# ── module-level connection pool ──────────────────────────────────────────────
_TTS_CLIENT: Optional[httpx.AsyncClient] = None

def _get_tts_client() -> httpx.AsyncClient:
    global _TTS_CLIENT
    if _TTS_CLIENT is None or _TTS_CLIENT.is_closed:
        _TTS_CLIENT = httpx.AsyncClient(
            timeout=12.0,
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=50),
        )
    return _TTS_CLIENT


# ── in-memory cache (max 500 entries, keyed by lang+speaker+text) ────────────
_TTS_CACHE: dict[str, dict] = {}


async def synthesize_speech(
    text: str,
    target_language_code: Optional[str] = None,
    speaker: str = "anushka",
) -> dict:
    """
    Calls Sarvam AI bulbul:v2 Text-to-Speech API with in-memory caching.

    Returns a dict containing:
      - audio_base64: str  (base64-encoded WAV audio)
      - language_code: str
      - ms_elapsed: float
    """
    t0 = time.perf_counter()
    settings = get_settings()

    if not settings.sarvam_api_key:
        raise HTTPException(status_code=500, detail="Sarvam API key not configured")

    # Auto-detect language from Unicode script when not supplied
    if not target_language_code or target_language_code in ("auto", "unknown"):
        target_language_code = detect_language(text, default="en-IN")

    # Sarvam TTS uses "od-IN" for Odia
    if target_language_code == "or-IN":
        target_language_code = "od-IN"

    cache_key = f"{target_language_code}:{speaker}:{text.strip()[:300]}"
    if cache_key in _TTS_CACHE:
        ms_cached = (time.perf_counter() - t0) * 1000
        logger.info(f"Sarvam TTS CACHE HIT | lang={target_language_code} | ms={ms_cached:.2f}ms")
        cached = _TTS_CACHE[cache_key].copy()
        cached["ms_elapsed"] = round(ms_cached, 2)
        return cached

    headers = {
        "api-subscription-key": settings.sarvam_api_key,
        "Content-Type": "application/json",
    }

    payload = {
        "inputs": [text[:500]],
        "target_language_code": target_language_code,
        "speaker": speaker or "anushka",
        "model": "bulbul:v2",
    }

    client = _get_tts_client()
    try:
        response = await client.post(SARVAM_TTS_URL, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()
        audios = data.get("audios", [])
        ms_elapsed = (time.perf_counter() - t0) * 1000
        logger.info(f"Sarvam TTS OK | lang={target_language_code} | ms={ms_elapsed:.0f}")

        result = {
            "audio_base64": audios[0] if audios else "",
            "language_code": target_language_code,
            "ms_elapsed": round(ms_elapsed, 2),
        }
        if audios and len(_TTS_CACHE) < 500:
            _TTS_CACHE[cache_key] = result
        return result

    except httpx.HTTPStatusError as e:
        logger.error(f"Sarvam TTS API Error: {e.response.status_code} - {e.response.text}")
        raise HTTPException(status_code=502, detail="TTS provider error")
    except Exception as e:
        logger.warning(f"Sarvam TTS Error: {e}")
        raise HTTPException(status_code=500, detail=f"TTS synthesis error: {str(e)}")
