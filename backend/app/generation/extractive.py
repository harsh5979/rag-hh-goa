"""
Extractive Generation — TF-IDF sentence ranking over retrieved chunks.

This is the ALWAYS-AVAILABLE fallback (no API, ~5ms, zero failure rate).
Selects the most query-relevant sentence span from the top-ranked chunk.
"""
import re
import time
from typing import List, Tuple
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np


def _split_sentences(text: str) -> List[str]:
    """Split text into sentences, keeping non-empty ones."""
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    return [s.strip() for s in sentences if len(s.strip()) > 20]


def _score_sentences(query: str, sentences: List[str]) -> List[float]:
    """TF-IDF cosine similarity between query and each sentence."""
    if not sentences:
        return []
    try:
        corpus = [query] + sentences
        vec = TfidfVectorizer(ngram_range=(1, 2), stop_words="english")
        tfidf = vec.fit_transform(corpus)
        scores = cosine_similarity(tfidf[0:1], tfidf[1:]).flatten()
        return scores.tolist()
    except Exception:
        # Fallback: return uniform scores
        return [1.0 / len(sentences)] * len(sentences)


def extractive_answer(
    query: str,
    chunks: List[str],
    max_sentences: int = 3,
) -> Tuple[str, float, float]:
    """
    Extract the most query-relevant sentences from the top chunks.

    Returns:
        (answer_text, confidence_score, elapsed_ms)
    """
    t0 = time.perf_counter()

    if not chunks:
        return "No relevant passages found.", 0.0, 0.0

    # Score each sentence in each chunk (check top-3 chunks)
    best_sentences: List[Tuple[float, str]] = []

    for chunk_text in chunks[:3]:
        sentences = _split_sentences(chunk_text)
        if not sentences:
            continue
        scores = _score_sentences(query, sentences)
        for score, sent in zip(scores, sentences):
            best_sentences.append((score, sent))

    if not best_sentences:
        # Last resort: return first 200 chars of top chunk
        return chunks[0][:200].strip() + "…", 0.1, (time.perf_counter() - t0) * 1000

    # Sort by score, pick top N, restore original order
    best_sentences.sort(key=lambda x: x[0], reverse=True)
    top_n = best_sentences[:max_sentences]
    top_n_sorted = sorted(top_n, key=lambda x: chunks[0].find(x[1]))

    answer = " ".join(s for _, s in top_n_sorted)
    confidence = float(np.mean([s for s, _ in top_n]))

    elapsed_ms = (time.perf_counter() - t0) * 1000
    return answer.strip(), round(confidence, 3), round(elapsed_ms, 2)
