import time
from typing import Optional
import httpx
from loguru import logger
from fastapi import UploadFile, HTTPException

from app.config import get_settings
from app.schemas import STTResponse
from app.language import (
    detect_language,
    is_indic_script,
    transliterate_indic_text,
    get_language_detector,
)

SARVAM_STT_URL = "https://api.sarvam.ai/speech-to-text"
SARVAM_STT_TRANSLATE_URL = "https://api.sarvam.ai/speech-to-text-translate"
SARVAM_TTS_URL = "https://api.sarvam.ai/text-to-speech"


async def transcribe_audio(
    audio_file: UploadFile,
    language_code: Optional[str] = None,
    translate_to_en: bool = False
) -> STTResponse:
    """
    Calls Sarvam AI STT API (saaras:v2.5) to convert Indic/English speech to accurate native text.
    """
    t0 = time.perf_counter()
    settings = get_settings()
    
    if not settings.sarvam_api_key:
        raise HTTPException(status_code=500, detail="Sarvam API key not configured")

    headers = {
        "api-subscription-key": settings.sarvam_api_key
    }
    
    content = await audio_file.read()
    await audio_file.seek(0)
    
    files = {
        "file": (audio_file.filename or "recording.webm", content, audio_file.content_type or "audio/webm")
    }

    url = SARVAM_STT_TRANSLATE_URL if translate_to_en else SARVAM_STT_URL

    data = {
        "model": "saarika:v2.5"
    }
    if language_code and language_code != "unknown":
        data["language_code"] = language_code
    elif not translate_to_en:
        data["language_code"] = "unknown"

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            logger.debug(f"Calling Sarvam STT ({len(content)} bytes, lang={data.get('language_code')})")
            
            response = await client.post(
                url,
                headers=headers,
                files=files,
                data=data
            )
            response.raise_for_status()
            result = response.json()
            
            transcript = result.get("transcript", "").strip()
            
            # If user explicitly passed a specific language, respect it 100%
            is_explicit_selection = language_code and language_code not in ("auto", "unknown")
            
            if is_explicit_selection:
                detected_lang = language_code
            else:
                # In Auto-Detect mode: map any misrecognized Dravidian greetings to standard English
                dravidian_greetings = {"హలో", "ஹலோ", "ಹಲೋ", "ഹലോ"}
                if transcript in dravidian_greetings:
                    transcript = "Hello"
                    detected_lang = "en-IN"
                else:
                    # Constrain Auto-Detect to the 4 fast core targets: gu-IN, hi-IN, mr-IN, en-IN
                    detected_lang = detect_language(transcript, default="en-IN" if not is_indic_script(transcript) else "hi-IN")
                    if detected_lang not in ("gu-IN", "hi-IN", "mr-IN", "en-IN"):
                        detected_lang = "en-IN" if not is_indic_script(transcript) else "hi-IN"

            # Ensure native script for Indic queries
            if transcript and not is_indic_script(transcript):
                target_lang = detected_lang if detected_lang in ("gu-IN", "hi-IN", "mr-IN", "bn-IN", "ta-IN", "te-IN") else None
                if target_lang:
                    transcript = await transliterate_indic_text(transcript, target_lang)
            
            ms_elapsed = (time.perf_counter() - t0) * 1000
            logger.info(f"STT Success | ms={ms_elapsed:.0f} | lang={detected_lang} | transcript='{transcript[:40]}...'")
            
            return STTResponse(
                transcript=transcript.strip(),
                confidence=0.95,
                language=detected_lang,
                ms_elapsed=round(ms_elapsed, 2)
            )
            
        except httpx.HTTPStatusError as e:
            logger.error(f"Sarvam STT API Error: {e.response.status_code} - {e.response.text}")
            raise HTTPException(status_code=502, detail="Speech-to-Text provider error")
        except Exception as e:
            logger.exception("STT Request failed")
            raise HTTPException(status_code=500, detail="Failed to process audio")


_TTS_CACHE: dict[str, dict] = {}
_TTS_CLIENT: Optional[httpx.AsyncClient] = None

def _get_tts_client() -> httpx.AsyncClient:
    global _TTS_CLIENT
    if _TTS_CLIENT is None or _TTS_CLIENT.is_closed:
        _TTS_CLIENT = httpx.AsyncClient(timeout=12.0, limits=httpx.Limits(max_keepalive_connections=20, max_connections=50))
    return _TTS_CLIENT

async def synthesize_speech(text: str, target_language_code: Optional[str] = None, speaker: str = "anushka") -> dict:
    """
    Calls Sarvam AI bulbul:v2 Text-to-Speech API with in-memory caching for instant audio delivery.
    Supports all 11 Indic languages with accurate Unicode script mapping.
    """
    t0 = time.perf_counter()
    settings = get_settings()
    
    if not settings.sarvam_api_key:
        raise HTTPException(status_code=500, detail="Sarvam API key not configured")

    # Auto detect Indic language code from Unicode script ranges & lexical markers
    if not target_language_code or target_language_code in ("auto", "unknown"):
        target_language_code = detect_language(text, default="en-IN")

    # Sarvam TTS uses 'od-IN' or 'or-IN'
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
        "Content-Type": "application/json"
    }
    
    payload = {
        "inputs": [text[:500]],
        "target_language_code": target_language_code,
        "speaker": speaker or "anushka",
        "model": "bulbul:v2"
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
            "ms_elapsed": round(ms_elapsed, 2)
        }
        if audios and len(_TTS_CACHE) < 500:
            _TTS_CACHE[cache_key] = result
        return result
    except Exception as e:
        logger.warning(f"Sarvam TTS Error: {e}")
        raise HTTPException(status_code=500, detail=f"TTS synthesis error: {str(e)}")
