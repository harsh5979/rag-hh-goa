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

    # Sanitize content-type to remove codec parameters (e.g. 'audio/webm;codecs=opus' -> 'audio/webm')
    # Sarvam AI STT strictly validates content-type and rejects strings with ';codecs=...'
    raw_ct = (audio_file.content_type or "audio/webm").split(";")[0].strip().lower()
    allowed_types = {
        "audio/mpeg": ("audio/mpeg", "mp3"),
        "audio/mp3": ("audio/mp3", "mp3"),
        "audio/wav": ("audio/wav", "wav"),
        "audio/x-wav": ("audio/wav", "wav"),
        "audio/wave": ("audio/wav", "wav"),
        "audio/webm": ("audio/webm", "webm"),
        "video/webm": ("video/webm", "webm"),
        "audio/ogg": ("audio/ogg", "ogg"),
        "audio/opus": ("audio/opus", "opus"),
        "audio/mp4": ("audio/mp4", "mp4"),
        "audio/m4a": ("audio/mp4", "m4a"),
        "audio/x-m4a": ("audio/mp4", "m4a"),
        "audio/aac": ("audio/aac", "aac"),
        "audio/x-aac": ("audio/aac", "aac"),
        "audio/flac": ("audio/flac", "flac"),
    }
    safe_ct, safe_ext = allowed_types.get(raw_ct, ("audio/webm", "webm"))
    safe_filename = f"recording.{safe_ext}"

    files = {
        "file": (safe_filename, content, safe_ct)
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


# Re-export synthesize_speech from dedicated tts module for backwards compatibility
from app.tts.synthesize import synthesize_speech

