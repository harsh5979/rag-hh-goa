from typing import Optional
from fastapi import APIRouter, File, Form, UploadFile, Depends
from loguru import logger
import time

from app.schemas import QueryRequest, QueryResponse, STTResponse, TTSRequest, TTSResponse
from app.stt.transcribe import transcribe_audio, synthesize_speech
from app.language import transliterate_indic_text, detect_language, is_indic_script
from app.pipeline.orchestrator import process_query

router = APIRouter(prefix="/chat", tags=["Chat"])

@router.post("/text", response_model=QueryResponse)
async def chat_text(request: QueryRequest) -> QueryResponse:
    """
    Standard text-to-text RAG pipeline with automatic Indic transliteration.
    """
    query = request.query.strip()
    logger.info(f"Received text query: {query}")
    
    # Transliterate Romanized Gujarati / Hindi to native script (e.g. 'kem chho' -> 'કેમ છો')
    if not is_indic_script(query):
        query = await transliterate_indic_text(query)
        logger.info(f"Native script normalized query: '{query}'")

    detected_lang = detect_language(query)
    response = await process_query(query, detected_lang=detected_lang)
    response.query = query
    response.transcript = query
    response.language = detected_lang
    return response

@router.post("/audio", response_model=QueryResponse)
async def chat_audio(
    audio_file: UploadFile = File(...),
    fallback_transcript: Optional[str] = Form(None),
    language: Optional[str] = Form(None)
) -> QueryResponse:
    """
    Voice-to-text RAG pipeline.
    1. Transcribes audio via Sarvam API (with auto Indic language detection).
    2. Falls back to client-provided interim transcript if STT returns empty/error.
    3. Runs standard RAG pipeline on transcript.
    """
    logger.info(f"Received audio file: {audio_file.filename} (fallback_transcript='{fallback_transcript}', lang='{language}')")
    
    stt_ms = 0.0
    transcript = ""
    detected_lang = language or "unknown"
    
    # Use specified language if provided (e.g. gu-IN, hi-IN), else 'unknown' for Sarvam auto-detect
    stt_lang = language if language and language not in ("unknown", "auto") else "unknown"

    try:
        stt_result = await transcribe_audio(audio_file, language_code=stt_lang)
        transcript = stt_result.transcript.strip()
        stt_ms = stt_result.ms_elapsed
        detected_lang = stt_result.language
    except Exception as e:
        logger.warning(f"Sarvam STT failed: {e}. Checking fallback transcript...")
    
    if not transcript and fallback_transcript:
        transcript = fallback_transcript.strip()
        logger.info(f"Using fallback transcript: '{transcript}'")
        # Ensure native script for fallback transcript
        if not is_indic_script(transcript):
            stt_target = stt_lang if stt_lang != "unknown" else None
            transcript = await transliterate_indic_text(transcript, stt_target)
            detected_lang = detect_language(transcript, default=detected_lang)
        
    if not transcript:
        logger.info("Empty audio input received — returning speech retry prompt")
        return QueryResponse(
            answer="I didn't catch that. Please speak clearly into the microphone or type your question.",
            generation_mode="fallback",
            model_used=None,
            confidence=0.0,
            sources=[],
            guardrails=[],
            transcript="",
            query="",
            language=detected_lang,
            ms_stt=round(stt_ms, 2),
            ms_retrieval=0.0,
            ms_generation=0.0,
            ms_total=round(stt_ms, 2)
        )
        
    # 2. Run RAG Pipeline
    response = await process_query(transcript, ms_stt=stt_ms, is_voice=True, detected_lang=detected_lang)
    response.transcript = transcript
    response.query = transcript
    response.language = detected_lang
    return response

@router.post("/tts", response_model=TTSResponse)
async def chat_tts(request: TTSRequest) -> TTSResponse:
    """
    Sarvam AI bulbul:v2 studio-quality Text-to-Speech synthesis (Gujarati, Hindi, English).
    """
    logger.info(f"Received TTS request for: {request.text[:40]}...")
    result = await synthesize_speech(
        text=request.text,
        target_language_code=request.target_language_code,
        speaker=request.speaker or "anushka"
    )
    return TTSResponse(
        audio_base64=result["audio_base64"],
        language_code=result["language_code"],
        ms_elapsed=result["ms_elapsed"]
    )


