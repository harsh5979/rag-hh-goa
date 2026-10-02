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


# ── module-level connection pool ──────────────────────────────────────────────
_STT_CLIENT: Optional[httpx.AsyncClient] = None

def _get_stt_client() -> httpx.AsyncClient:
    global _STT_CLIENT
    if _STT_CLIENT is None or _STT_CLIENT.is_closed:
        _STT_CLIENT = httpx.AsyncClient(
            timeout=15.0,
            limits=httpx.Limits(max_keepalive_connections=30, max_connections=100, keepalive_expiry=30.0),
        )
    return _STT_CLIENT


ALLOWED_AUDIO_TYPES = {
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

WHISPER_LANG_MAP = {
    "gujarati": "gu-IN",
    "hindi": "hi-IN",
    "marathi": "mr-IN",
    "bengali": "bn-IN",
    "tamil": "ta-IN",
    "telugu": "te-IN",
    "kannada": "kn-IN",
    "malayalam": "ml-IN",
    "punjabi": "pa-IN",
    "urdu": "ur-IN",
    "english": "en-IN",
}


async def _transcribe_sarvam(
    client: httpx.AsyncClient,
    content: bytes,
    safe_filename: str,
    safe_ct: str,
    language_code: Optional[str],
    translate_to_en: bool,
    api_key: str,
) -> tuple[str, str]:
    """Calls Sarvam AI STT API (saaras:v2.5) and returns (transcript, detected_language)."""
    headers = {"api-subscription-key": api_key}
    files = {"file": (safe_filename, content, safe_ct)}
    url = SARVAM_STT_TRANSLATE_URL if translate_to_en else SARVAM_STT_URL

    data = {"model": "saarika:v2.5"}
    if language_code and language_code not in ("unknown", "auto"):
        data["language_code"] = language_code
    elif not translate_to_en:
        data["language_code"] = "unknown"

    logger.debug(f"Calling Sarvam STT ({len(content)} bytes, lang={data.get('language_code')})")
    response = await client.post(url, headers=headers, files=files, data=data)
    response.raise_for_status()
    result = response.json()
    transcript = result.get("transcript", "").strip()
    detected_lang = result.get("language_code", "")
    return transcript, detected_lang


async def _transcribe_groq_whisper(
    content: bytes,
    safe_filename: str,
    language_code: Optional[str],
) -> tuple[str, str]:
    """
    Transcribes audio using Groq Cloud Whisper API (whisper-large-v3-turbo).
    Returns (transcript, detected_language).
    """
    settings = get_settings()

    if not settings.groq_api_key:
        raise HTTPException(
            status_code=500,
            detail="Neither Sarvam nor Groq API key is configured for Speech-to-Text"
        )

    from groq import AsyncGroq
    groq_client = AsyncGroq(api_key=settings.groq_api_key)
    whisper_lang = language_code.split("-")[0] if language_code and language_code not in ("auto", "unknown") else None

    logger.info(f"Calling Groq Whisper STT (model={settings.groq_whisper_model}, lang={whisper_lang})")
    transcription = await groq_client.audio.transcriptions.create(
        file=(safe_filename, content),
        model=settings.groq_whisper_model or "whisper-large-v3-turbo",
        response_format="verbose_json",
        language=whisper_lang,
    )
    transcript = getattr(transcription, "text", str(transcription)).strip()
    whisper_detected = getattr(transcription, "language", "").lower()
    detected_lang = WHISPER_LANG_MAP.get(whisper_detected, "en-IN")
    return transcript, detected_lang


async def _post_process_transcript(
    raw_transcript: str,
    language_code: Optional[str],
    provider_lang: Optional[str] = None
) -> tuple[str, str]:
    """
    Detects/maps language and ensures Indic speech stays in its native Indic script.
    Guarantees Gujarati speech -> Gujarati, Hindi speech -> Hindi, etc.
    """
    transcript = raw_transcript.strip()
    is_explicit_selection = language_code and language_code not in ("auto", "unknown")

    if is_explicit_selection:
        detected_lang = language_code
    else:
        # Check if the transcript contains native script characters
        script_lang = detect_language(transcript, default="")
        if script_lang and is_indic_script(transcript):
            detected_lang = script_lang
        elif provider_lang and provider_lang not in ("auto", "unknown", ""):
            detected_lang = provider_lang
        else:
            detected_lang = script_lang or "en-IN"

    # If transcript is in Romanized Latin script but language is Indic (e.g. Gujarati/Hindi/Marathi):
    # Transliterate it to native script so downstream RAG and TTS respect the native language
    if transcript and not is_indic_script(transcript):
        target_lang = detected_lang if detected_lang in ("gu-IN", "hi-IN", "mr-IN", "bn-IN", "ta-IN", "te-IN") else None
        if target_lang:
            transliterated = await transliterate_indic_text(transcript, target_lang)
            if transliterated and is_indic_script(transliterated):
                transcript = transliterated

    return transcript, detected_lang


async def transcribe_audio(
    audio_file: UploadFile,
    language_code: Optional[str] = None,
    translate_to_en: bool = False
) -> STTResponse:
    """
    Transcribes audio using configured provider (Sarvam primary, Groq Whisper fallback, or Auto).
    """
    t0 = time.perf_counter()
    settings = get_settings()

    content = await audio_file.read()
    await audio_file.seek(0)

    raw_ct = (audio_file.content_type or "audio/webm").split(";")[0].strip().lower()
    safe_ct, safe_ext = ALLOWED_AUDIO_TYPES.get(raw_ct, ("audio/webm", "webm"))
    safe_filename = f"recording.{safe_ext}"

    provider = settings.stt_provider.lower().strip()
    client = _get_stt_client()
    raw_transcript = ""
    provider_detected_lang = ""
    used_provider = provider

    if provider in ("sarvam", "auto"):
        try:
            if not settings.sarvam_api_key:
                raise ValueError("Sarvam API key is not configured")
            raw_transcript, provider_detected_lang = await _transcribe_sarvam(
                client=client,
                content=content,
                safe_filename=safe_filename,
                safe_ct=safe_ct,
                language_code=language_code,
                translate_to_en=translate_to_en,
                api_key=settings.sarvam_api_key,
            )
            used_provider = "sarvam"
        except Exception as e:
            if provider == "auto":
                logger.warning(f"[STT] Sarvam failed ({e}), automatically falling back to Groq Whisper...")
                raw_transcript, provider_detected_lang = await _transcribe_groq_whisper(content, safe_filename, language_code)
                used_provider = "groq-whisper-fallback"
            else:
                logger.error(f"[STT] Sarvam STT Error: {e}")
                raise HTTPException(status_code=502, detail=f"Sarvam STT provider error: {e}")

    elif provider in ("groq", "whisper"):
        logger.info(f"[STT] Direct Groq Whisper mode active (model={settings.groq_whisper_model})")
        raw_transcript, provider_detected_lang = await _transcribe_groq_whisper(content, safe_filename, language_code)
        used_provider = "groq-whisper"
    else:
        raise HTTPException(status_code=500, detail=f"Unknown STT provider configured: {provider}")

    transcript, detected_lang = await _post_process_transcript(
        raw_transcript=raw_transcript,
        language_code=language_code,
        provider_lang=provider_detected_lang
    )
    ms_elapsed = (time.perf_counter() - t0) * 1000

    logger.info(
        f"STT Success | provider={used_provider} | ms={ms_elapsed:.0f} | "
        f"lang={detected_lang} | transcript='{transcript[:40]}...'"
    )

    return STTResponse(
        transcript=transcript.strip(),
        confidence=0.95,
        language=detected_lang,
        ms_elapsed=round(ms_elapsed, 2)
    )



# Re-export synthesize_speech from dedicated tts module for backwards compatibility
from app.tts.synthesize import synthesize_speech

