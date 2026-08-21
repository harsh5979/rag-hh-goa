import time
from loguru import logger

from app.schemas import QueryResponse, SourceChunk, GuardrailResult
from app.guardrails.checker import get_guardrails
from app.retrieval.vector_db import get_db
from app.retrieval.rerank import get_reranker
from app.generation.generator import get_generator

# Minimum threshold for cross-encoder reranker (raw logits)
# Set to -11.5 to properly accommodate multilingual & cross-lingual queries (Hindi, Gujarati, English)
MIN_RELEVANCE_SCORE = -11.5


async def process_query(query: str, ms_stt: float = 0.0, is_voice: bool = False) -> QueryResponse:
    """
    Main orchestration pipeline for a user query.
    1. Guardrails (toxicity / PII / off-topic / greetings fast-path)
    2. Retrieval  (Hybrid FAISS + BM25)
    3. Reranking  (CrossEncoder)
    4. Relevance gate (refuse if no match at all)
    5. Generation (Groq waterfall → extractive fallback with multilingual awareness)
    """
    t0_total = time.perf_counter()

    # ── 1. Guardrails ────────────────────────────────────────────────────
    guardrails_engine = get_guardrails()
    guardrail_results = guardrails_engine.run_all(query, is_voice=is_voice)

    failed = [r for r in guardrail_results if not r.passed]
    if failed:
        first_fail = failed[0]
        ms_total = (time.perf_counter() - t0_total) * 1000

        if first_fail.type == "greeting":
            # Detect language for greeting response
            is_hindi = any('\u0900' <= char <= '\u097F' for char in query)
            is_gujarati = any('\u0A80' <= char <= '\u0AFF' for char in query)
            
            if is_hindi:
                greeting_text = "नमस्ते! आप MS MARCO डॉक्यूमेंट्स से संबंधित तथ्यात्मक प्रश्न पूछ सकते हैं — जैसे 'मैनहट्टन प्रोजेक्ट क्या था?'"
            elif is_gujarati:
                greeting_text = "નમસ્તે! તમે MS MARCO ડૉક્યુમેન્ટ્સ વિશે કોઈ પણ પ્રશ્ન પૂછી શકો છો — જેમ કે 'ક્વોન્ટમ કમ્પ્યુટિંગ એટલે શું?'"
            else:
                greeting_text = "Hello! Ask me a factual question about the indexed document corpus — for example: 'What was the Manhattan Project?' or 'Who was Robert Oppenheimer?'"

            return QueryResponse(
                answer=greeting_text,
                generation_mode="extractive",
                confidence=1.0,
                sources=[],
                guardrails=guardrail_results,
                ms_stt=ms_stt,
                ms_retrieval=0.0,
                ms_generation=0.0,
                ms_total=round(ms_total, 2),
            )

        is_hindi = any('\u0900' <= char <= '\u097F' for char in query)
        is_gujarati = any('\u0A80' <= char <= '\u0AFF' for char in query)

        if is_gujarati:
            refusal_text = "આ સિસ્ટમ દસ્તાવેજો આધારિત તથ્યો માટે છે. પ્રોગ્રામિંગ, કોડિંગ અથવા અન્ય બહારના વિષયો ઉપલબ્ધ નથી."
        elif is_hindi:
            refusal_text = "यह प्रणाली दस्तावेज़ आधारित तथ्यों के लिए है। प्रोग्रामिंग, कोडिंग या अन्य बाहरी विषय यहाँ उपलब्ध नहीं हैं।"
        else:
            refusal_text = "This system is built for document knowledge retrieval. Programming, code generation, and external chit-chat are restricted."

        logger.warning(f"Query blocked by guardrails: {first_fail.reason}")
        return QueryResponse(
            answer=refusal_text,
            generation_mode="refusal",
            confidence=1.0,
            sources=[],
            guardrails=guardrail_results,
            ms_stt=ms_stt,
            ms_retrieval=0.0,
            ms_generation=0.0,
            ms_total=round(ms_total, 2),
        )

    # ── 2. Retrieval ─────────────────────────────────────────────────────
    t0_retrieval = time.perf_counter()
    db = get_db()
    hybrid_docs = db.hybrid_search(query, top_k=6)

    # ── 3. Reranking ──────────────────────────────────────────────────────
    reranker = get_reranker()
    ranked_docs = reranker.rerank(query, hybrid_docs, top_k=4)

    sources: list[SourceChunk] = []
    context_chunks: list[str] = []
    scores: list[float] = []

    for doc in ranked_docs:
        score = doc.get("cross_encoder_score", 0.0)
        text  = doc.get("text", "").strip()
        sources.append(
            SourceChunk(
                text=text,
                metadata={
                    k: v
                    for k, v in doc.items()
                    if k not in ("text", "score", "method", "cross_encoder_score")
                },
                score=score,
                method="cross-encoder",
            )
        )
        context_chunks.append(text)
        scores.append(float(score))

    ms_retrieval = (time.perf_counter() - t0_retrieval) * 1000
    logger.info(f"Retrieval done in {ms_retrieval:.1f}ms — {len(sources)} chunks")

    # ── 4. Relevance gate ────────────────────────────────────────────────
    # If no chunks retrieved or best score is extremely low noise
    if not scores or (max(scores) < MIN_RELEVANCE_SCORE and len(context_chunks) == 0):
        ms_total = (time.perf_counter() - t0_total) * 1000
        logger.warning(
            f"Relevance gate blocked query — best_score={max(scores, default='n/a'):.3f}"
        )
        
        is_hindi = any('\u0900' <= char <= '\u097F' for char in query)
        is_gujarati = any('\u0A80' <= char <= '\u0AFF' for char in query)
        if is_hindi:
            refusal_msg = "दिए गए कॉर्पस में इस प्रश्न का उत्तर देने के लिए पर्याप्त प्रासंगिक जानकारी नहीं मिली।"
        elif is_gujarati:
            refusal_msg = "આપેલા ડેટાસેટમાં આ પ્રશ્નનો જવાબ આપવા માટે પૂરતી માહિતી મળી નથી."
        else:
            refusal_msg = "The MS MARCO corpus does not contain passages relevant enough to answer this question confidently."

        return QueryResponse(
            answer=refusal_msg,
            generation_mode="refusal",
            confidence=0.0,
            sources=sources,
            guardrails=guardrail_results,
            ms_stt=ms_stt,
            ms_retrieval=round(ms_retrieval, 2),
            ms_generation=0.0,
            ms_total=round(ms_total, 2),
        )

    # ── 5. Generation ─────────────────────────────────────────────────────
    t0_gen = time.perf_counter()
    generator = get_generator()
    gen_result = await generator.generate(query, context_chunks, chunk_scores=scores)
    ms_generation = (time.perf_counter() - t0_gen) * 1000
    logger.info(f"Generation done in {ms_generation:.1f}ms via {gen_result.mode}")

    ms_total = (time.perf_counter() - t0_total) * 1000 + ms_stt

    return QueryResponse(
        answer=gen_result.answer,
        generation_mode=gen_result.mode,
        model_used=gen_result.model_used,
        confidence=gen_result.confidence,
        sources=sources,
        guardrails=guardrail_results,
        ms_stt=round(ms_stt, 2),
        ms_retrieval=round(ms_retrieval, 2),
        ms_generation=round(ms_generation, 2),
        ms_total=round(ms_total, 2),
    )
