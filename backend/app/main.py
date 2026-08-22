import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from loguru import logger
from dotenv import load_dotenv

from app.retrieval.vector_db import init_db
from app.retrieval.rerank import init_reranker
from app.guardrails.checker import init_guardrails
from app.generation.generator import init_generator
from app.api.routes import chat

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing VoiceRAG Backend singletons...")
    
    logger.info("1. Initializing Guardrails...")
    init_guardrails()
    
    logger.info("2. Initializing Vector DB...")
    init_db()
    
    logger.info("3. Initializing Reranker...")
    init_reranker()
    
    logger.info("4. Initializing Groq Generator...")
    init_generator()

    logger.info("5. Warming up neural encoders for instant sub-200ms latency...")
    try:
        from app.retrieval.vector_db import get_db
        from app.retrieval.rerank import get_reranker
        db = get_db()
        db.encoder.encode(["warmup"], normalize_embeddings=True)
        reranker = get_reranker()
        reranker.model.predict([["warmup", "warmup text"]])
        logger.info("Model warmup complete — zero cold-start latency!")
    except Exception as e:
        logger.warning(f"Warmup warning: {e}")
    
    logger.info("Backend initialization complete!")
    yield
    logger.info("Shutting down backend...")

app = FastAPI(
    title="VoiceRAG API",
    description="Backend for Voice-Enabled RAG System (HH Goa 2026)",
    version="1.0.0",
    lifespan=lifespan
)

# CORS (allow all for hackathon dev)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routes - mount at both /api and root to prevent any 404 routing mismatches
app.include_router(chat.router, prefix="/api")
app.include_router(chat.router, prefix="")

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "Backend scaffolded, API routes coming next!"}

@app.get("/")
async def root():
    return {"message": "VoiceRAG API is running"}
