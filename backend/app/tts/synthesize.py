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


# ── in-memory cache (max 500 entries, keyed by provider+lang+speaker+text) ─────
_TTS_CACHE: dict[str, dict] = {}

# Microsoft Edge Neural Voice mappings for Indic and English languages
EDGE_VOICE_MAP = {
    "hi-IN": "hi-IN-SwaraNeural",
    "gu-IN": "gu-IN-DhwaniNeural",
    "mr-IN": "mr-IN-AarohiNeural",
    "bn-IN": "bn-IN-TanishaaNeural",
    "ta-IN": "ta-IN-PallaviNeural",
    "te-IN": "te-IN-ShrutiNeural",
    "kn-IN": "kn-IN-SapnaNeural",
    "ml-IN": "ml-IN-SobhanaNeural",
    "pa-IN": "pa-IN-GurpreetNeural",
    "ur-IN": "ur-IN-GulNeural",
    "od-IN": "hi-IN-SwaraNeural",
    "or-IN": "hi-IN-SwaraNeural",
    "en-IN": "en-IN-NeerjaNeural",
    "en-US": "en-US-JennyNeural",
    "en": "en-IN-NeerjaNeural",
}


BULBUL_V3_SPEAKERS = {
    "aditya", "ritu", "ashutosh", "priya", "neha", "rahul", "pooja",
    "rohan", "simran", "kavya", "amit", "dev", "ishani", "roopa",
    "shreya", "ratan", "sandeep", "deepa", "sangeeta", "gaurav"
}


async def _synthesize_sarvam(
    client: httpx.AsyncClient,
    text: str,
    target_language_code: str,
    speaker: str,
    api_key: str,
) -> str:
    """Calls Sarvam AI Text-to-Speech API with bulbul:v3."""
    headers = {
        "api-subscription-key": api_key,
        "Content-Type": "application/json",
    }
    # Automatically map deprecated or unknown speakers to a valid bulbul:v3 voice
    selected_speaker = speaker if speaker in BULBUL_V3_SPEAKERS else "kavya"

    payload = {
        "inputs": [text[:500]],
        "target_language_code": target_language_code,
        "speaker": selected_speaker,
        "model": "bulbul:v3",
    }
    response = await client.post(SARVAM_TTS_URL, headers=headers, json=payload, timeout=4.0)
    response.raise_for_status()
    data = response.json()
    audios = data.get("audios", [])
    if not audios:
        raise ValueError("Sarvam returned empty audio stream")
    return audios[0]



def _clean_text_for_tts(raw_text: str) -> str:
    """Strips markdown asterisks, hashes, urls, and brackets that can confuse TTS engines."""
    import re
    t = re.sub(r"[*_~`#>]", "", raw_text)
    t = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", t)
    t = re.sub(r"https?://\S+", "", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


async def _synthesize_edge_tts(
    text: str,
    target_language_code: str,
) -> tuple[str, str]:
    """
    Synthesizes speech using Microsoft Edge Neural TTS.
    100% free, zero server load, high-fidelity native Indic neural voices.
    Returns (audio_base64, effective_language_code).
    """
    import base64
    import edge_tts

    clean_text = _clean_text_for_tts(text)
    if not clean_text:
        clean_text = text.strip()

    # Prioritize the actual Unicode script of the text.
    # e.g., if Gujarati script is present, we must use Gujarati voice,
    # because Hindi voices (hi-IN) will reject Gujarati Unicode with NoAudioReceived.
    actual_lang = detect_language(clean_text, default="")

    candidate_voices: list[tuple[str, str]] = []
    # 1. Native detected script voice
    if actual_lang and actual_lang in EDGE_VOICE_MAP:
        candidate_voices.append((EDGE_VOICE_MAP[actual_lang], actual_lang))
    # 2. Target requested language
    if target_language_code in EDGE_VOICE_MAP and (not candidate_voices or candidate_voices[0][0] != EDGE_VOICE_MAP[target_language_code]):
        candidate_voices.append((EDGE_VOICE_MAP[target_language_code], target_language_code))
    # 3. Standard fallback voices
    fallback_code = actual_lang or target_language_code
    candidate_voices.append(("hi-IN-SwaraNeural", "hi-IN"))
    candidate_voices.append(("en-IN-NeerjaNeural", "en-IN"))

    last_err: Optional[Exception] = None
    for voice, lang in candidate_voices:
        try:
            logger.info(f"Synthesizing via Edge-TTS (voice={voice}, lang={lang})")
            communicate = edge_tts.Communicate(text=clean_text[:600], voice=voice)
            audio_data = bytearray()
            async for chunk in communicate.stream():
                if chunk.get("type") == "audio":
                    audio_data.extend(chunk["data"])

            if audio_data:
                return base64.b64encode(audio_data).decode("utf-8"), lang
        except Exception as e:
            logger.warning(f"Edge-TTS voice {voice} failed: {e}. Trying next candidate voice...")
            last_err = e

    raise last_err or ValueError("Failed to synthesize speech with candidate voices")


async def synthesize_speech(
    text: str,
    target_language_code: Optional[str] = None,
    speaker: str = "anushka",
) -> dict:
    """
    Synthesizes speech using configured provider (Sarvam bulbul:v2 or Edge-TTS).
    Supports automatic fallback when Sarvam credits are exhausted or unavailable.

    Returns a dict containing:
      - audio_base64: str  (base64-encoded audio)
      - language_code: str
      - ms_elapsed: float
    """
    t0 = time.perf_counter()
    settings = get_settings()

    # Auto-detect language from Unicode script when not supplied
    if not target_language_code or target_language_code in ("auto", "unknown"):
        target_language_code = detect_language(text, default="en-IN")

    # Sarvam TTS uses "od-IN" for Odia
    if target_language_code == "or-IN":
        target_language_code = "od-IN"

    provider = settings.tts_provider.lower().strip()
    cache_key = f"{provider}:{target_language_code}:{speaker}:{text.strip()[:300]}"
    if cache_key in _TTS_CACHE:
        ms_cached = (time.perf_counter() - t0) * 1000
        logger.info(f"TTS CACHE HIT | provider={provider} | lang={target_language_code} | ms={ms_cached:.2f}ms")
        cached = _TTS_CACHE[cache_key].copy()
        cached["ms_elapsed"] = round(ms_cached, 2)
        return cached

    audio_base64 = ""
    effective_lang = target_language_code
    used_provider = provider
    client = _get_tts_client()

    if provider in ("sarvam", "auto"):
        try:
            if not settings.sarvam_api_key:
                raise ValueError("Sarvam API key not configured")
            audio_base64 = await _synthesize_sarvam(
                client=client,
                text=text,
                target_language_code=target_language_code,
                speaker=speaker,
                api_key=settings.sarvam_api_key,
            )
            used_provider = "sarvam"
        except Exception as e:
            if provider == "auto":
                logger.warning(f"[TTS] Sarvam failed ({e}), automatically falling back to Edge-TTS...")
                audio_base64, effective_lang = await _synthesize_edge_tts(text, target_language_code)
                used_provider = "edge-tts-fallback"
            else:
                logger.error(f"[TTS] Sarvam TTS Error: {e}")
                raise HTTPException(status_code=502, detail=f"Sarvam TTS provider error: {str(e)}")

    elif provider in ("edge", "local"):
        logger.info(f"[TTS] Direct Edge-TTS provider mode active (lang={target_language_code})")
        audio_base64, effective_lang = await _synthesize_edge_tts(text, target_language_code)
        used_provider = "edge-tts"
    else:
        raise HTTPException(status_code=500, detail=f"Unknown TTS provider configured: {provider}")

    ms_elapsed = (time.perf_counter() - t0) * 1000
    logger.info(f"TTS Success | provider={used_provider} | lang={effective_lang} | ms={ms_elapsed:.0f}")

    result = {
        "audio_base64": audio_base64,
        "language_code": effective_lang,
        "ms_elapsed": round(ms_elapsed, 2),
    }
    if audio_base64 and len(_TTS_CACHE) < 500:
        _TTS_CACHE[cache_key] = result
    return result


