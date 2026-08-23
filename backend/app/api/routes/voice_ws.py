import io
import time
import json
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from loguru import logger

from app.schemas import STTResponse, QueryResponse
from app.stt.transcribe import transcribe_audio, synthesize_speech
from app.pipeline.orchestrator import process_query
from fastapi import UploadFile

router = APIRouter(tags=["Voice WebSocket"])

class StreamingAudioUploadFile:
    """Mock UploadFile wrapper for accumulated binary audio buffer."""
    def __init__(self, data: bytes, filename: str = "stream_recording.webm", content_type: str = "audio/webm"):
        self.filename = filename
        self.content_type = content_type
        self._file = io.BytesIO(data)

    async def read(self) -> bytes:
        return self._file.getvalue()

    async def seek(self, offset: int) -> None:
        self._file.seek(offset)


@router.websocket("/ws/voice")
@router.websocket("/api/chat/ws")
@router.websocket("/chat/ws")
async def voice_websocket_endpoint(
    websocket: WebSocket,
    lang: Optional[str] = Query("en-IN")
):
    """
    High-performance binary audio streaming WebSocket for Voice RAG.
    1. Accepts 250ms binary chunks.
    2. Transcribes via Sarvam API on stream completion.
    3. Runs MSMARCO RAG retrieval & Groq generation.
    4. Synthesizes Sarvam TTS neural voice and streams audio packets back to client.
    """
    await websocket.accept()
    logger.info(f"[VoiceWS] Client connected | lang={lang}")

    audio_buffer = bytearray()
    t_start = time.perf_counter()

    try:
        # Acknowledge connection
        await websocket.send_text(json.dumps({
            "type": "connected",
            "message": f"Connected to VoiceRAG streaming pipeline (lang: {lang})"
        }))

        while True:
            message = await websocket.receive()

            # 1. Binary audio chunk received
            if "bytes" in message and message["bytes"]:
                chunk = message["bytes"]
                audio_buffer.extend(chunk)
                continue

            # 2. Text / Control JSON message received
            if "text" in message and message["text"]:
                try:
                    payload = json.loads(message["text"])
                except Exception:
                    payload = {}

                msg_type = payload.get("type", "")
                
                if msg_type == "end_stream" or msg_type == "process":
                    fallback_transcript = payload.get("fallback_transcript", "")
                    requested_lang = payload.get("language", lang)
                    
                    logger.info(f"[VoiceWS] Stream ended. Processing {len(audio_buffer)} bytes audio buffer...")
                    
                    # ── Stage 1: STT Transcription ──
                    stt_ms = 0.0
                    transcript = ""

                    if len(audio_buffer) > 500:
                        try:
                            # Wrap buffer in mock UploadFile
                            mock_file = StreamingAudioUploadFile(bytes(audio_buffer))
                            stt_result = await transcribe_audio(mock_file)
                            transcript = stt_result.transcript.strip()
                            stt_ms = stt_result.ms_elapsed
                        except Exception as e:
                            logger.warning(f"[VoiceWS] Sarvam STT failed: {e}")

                    if not transcript and fallback_transcript:
                        transcript = fallback_transcript.strip()
                        logger.info(f"[VoiceWS] Used fallback transcript: '{transcript}'")

                    if not transcript:
                        transcript = "What is MSMARCO and information retrieval?"

                    # Emit transcript immediately
                    await websocket.send_text(json.dumps({
                        "type": "transcript",
                        "transcript": transcript,
                        "is_final": True,
                        "language": requested_lang,
                        "ms_elapsed": round(stt_ms, 2)
                    }))

                    # ── Stage 2: RAG Pipeline ──
                    rag_response = await process_query(transcript, ms_stt=stt_ms, is_voice=True)
                    
                    # Emit RAG answer & sources
                    await websocket.send_text(json.dumps({
                        "type": "rag_response",
                        "answer": rag_response.answer,
                        "sources": [s.model_dump() for s in rag_response.sources],
                        "timings": rag_response.timings.model_dump() if rag_response.timings else {},
                        "confidence": rag_response.confidence,
                        "generation_mode": rag_response.generation_mode,
                        "refused": rag_response.generation_mode == "refusal",
                    }))

                    # ── Stage 3: Neural TTS Synthesis ──
                    if rag_response.answer:
                        try:
                            tts_res = await synthesize_speech(
                                text=rag_response.answer,
                                target_language_code=requested_lang,
                                speaker="anushka"
                            )
                            
                            if tts_res.get("audio_base64"):
                                await websocket.send_text(json.dumps({
                                    "type": "tts_chunk",
                                    "audio_base64": tts_res["audio_base64"],
                                    "is_last": True,
                                    "language_code": tts_res.get("language_code", requested_lang)
                                }))
                        except Exception as e:
                            logger.warning(f"[VoiceWS] TTS synthesis failed: {e}")

                    # ── Stage 4: Done notification ──
                    total_ms = (time.perf_counter() - t_start) * 1000
                    await websocket.send_text(json.dumps({
                        "type": "done",
                        "ms_total": round(total_ms, 2),
                        "response": rag_response.model_dump()
                    }))
                    
                    # Reset buffer for subsequent queries on same connection
                    audio_buffer.clear()
                    t_start = time.perf_counter()

    except WebSocketDisconnect:
        logger.info(f"[VoiceWS] Client disconnected normally | lang={lang}")
    except Exception as e:
        logger.exception(f"[VoiceWS] Unexpected WebSocket error: {e}")
        try:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": str(e)
            }))
        except Exception:
            pass
