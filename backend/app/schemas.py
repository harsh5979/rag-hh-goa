from pydantic import BaseModel, Field
from typing import List, Optional, Literal

class QueryRequest(BaseModel):
    query: str = Field(..., description="The user query (text)")

class SourceChunk(BaseModel):
    text: str
    metadata: dict = Field(default_factory=dict)
    score: float = Field(..., description="Retrieval or Rerank score")
    method: str = Field(..., description="e.g. 'faiss', 'bm25', 'cross-encoder'")

class GuardrailResult(BaseModel):
    passed: bool
    reason: Optional[str] = None
    type: str = Field(..., description="e.g. 'off-topic', 'toxicity', 'pii'")

class QueryResponse(BaseModel):
    answer: str
    generation_mode: Literal["groq", "extractive", "fallback", "refusal"]
    model_used: Optional[str] = None
    confidence: float
    sources: List[SourceChunk]
    guardrails: List[GuardrailResult]
    transcript: Optional[str] = None
    query: Optional[str] = None
    language: Optional[str] = None
    
    # Latency tracking (waterfall model)
    ms_stt: float = 0.0
    ms_retrieval: float = 0.0
    ms_generation: float = 0.0
    ms_total: float = 0.0

class STTResponse(BaseModel):
    transcript: str
    confidence: float
    language: str
    ms_elapsed: float

class TTSRequest(BaseModel):
    text: str = Field(..., description="Text to synthesize to speech")
    target_language_code: Optional[str] = Field(None, description="'gu-IN', 'hi-IN', 'en-IN'")
    speaker: Optional[str] = Field("anushka", description="Voice speaker name")

class TTSResponse(BaseModel):
    audio_base64: str = Field(..., description="Base64 encoded WAV audio")
    language_code: str = Field(..., description="Target language code used")
    ms_elapsed: float = 0.0

