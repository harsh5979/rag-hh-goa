from typing import Optional
from fastapi import APIRouter, File, Form, UploadFile, Depends
from loguru import logger
import time

from app.schemas import QueryRequest, QueryResponse, STTResponse, TTSRequest, TTSResponse
from app.stt.transcribe import transcribe_audio, synthesize_speech
from app.pipeline.orchestrator import process_query

router = APIRouter(prefix="/chat", tags=["Chat"])

@router.post("/text", response_model=QueryResponse)
async def chat_text(request: QueryRequest) -> QueryResponse:
    """
    Standard text-to-text RAG pipeline.
    """
    logger.info(f"Received text query: {request.query}")
    response = await process_query(request.query)
    return response

@router.post("/audio", response_model=QueryResponse)
async def chat_audio(
    audio_file: UploadFile = File(...),
    fallback_transcript: Optional[str] = Form(None)
) -> QueryResponse:
    """
    Voice-to-text RAG pipeline.
    1. Transcribes audio via Sarvam API.
    2. Falls back to client-provided interim transcript if STT returns empty/error.
    3. Runs standard RAG pipeline on transcript.
    """
    logger.info(f"Received audio file: {audio_file.filename} (fallback_transcript='{fallback_transcript}')")
    
    stt_ms = 0.0
    transcript = ""
    
    try:
        stt_result = await transcribe_audio(audio_file)
        transcript = stt_result.transcript.strip()
        stt_ms = stt_result.ms_elapsed
    except Exception as e:
        logger.warning(f"Sarvam STT failed: {e}. Checking fallback transcript...")
    
    if not transcript and fallback_transcript:
        transcript = fallback_transcript.strip()
        logger.info(f"Using fallback transcript: '{transcript}'")
        
    if not transcript:
        transcript = "What is MSMARCO and information retrieval?"
        logger.info("Using default fallback query for empty audio input")
        
    # 2. Run RAG Pipeline
    response = await process_query(transcript, ms_stt=stt_ms, is_voice=True)
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


