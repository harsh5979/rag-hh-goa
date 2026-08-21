import re
from typing import List, Dict, Any, Optional
from sentence_transformers import SentenceTransformer
import numpy as np

def split_by_sentences(text: str) -> List[str]:
    """
    Multilingual sentence splitter supporting English (. ! ?), 
    Devanagari/Indic danda (। ॥), and newline splits.
    """
    # Split on English punctuation, Indic purna viram (। / ॥), newlines
    sentences = re.split(r'(?<=[.!?।॥])\s+|\n+', text.strip())
    return [s.strip() for s in sentences if len(s.strip()) > 3]

class BaseChunker:
    def chunk(self, text: str, metadata: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        raise NotImplementedError

class FixedWindowChunker(BaseChunker):
    """
    Chunks text into fixed size windows of sentences with a specific overlap.
    """
    def __init__(self, window_size: int = 3, overlap: int = 1):
        self.window_size = window_size
        self.overlap = overlap

    def chunk(self, text: str, metadata: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        sentences = split_by_sentences(text)
        chunks = []
        
        if not sentences:
            return chunks

        i = 0
        chunk_idx = 0
        while i < len(sentences):
            window = sentences[i : i + self.window_size]
            chunk_text = " ".join(window)
            
            if chunk_text.strip():
                meta = dict(metadata or {})
                meta["chunk_id"] = chunk_idx
                meta["strategy"] = "fixed_window"
                chunks.append({
                    "text": chunk_text,
                    "metadata": meta,
                    "strategy": "fixed_window"
                })
                chunk_idx += 1
            
            step = self.window_size - self.overlap
            if step <= 0:
                step = 1
            i += step
            
        return chunks

class SemanticChunker(BaseChunker):
    """
    Dynamically groups sentences based on cosine similarity of their embeddings.
    If similarity between sentence N and N+1 drops below a threshold, a new chunk starts.
    """
    def __init__(self, model_name: str = "BAAI/bge-small-en-v1.5", similarity_threshold: float = 0.5):
        self.model = SentenceTransformer(model_name)
        self.threshold = similarity_threshold

    def chunk(self, text: str, metadata: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        sentences = split_by_sentences(text)
        if not sentences:
            return []
            
        meta = dict(metadata or {})
        if len(sentences) == 1:
            meta["chunk_id"] = 0
            meta["strategy"] = "semantic"
            return [{"text": sentences[0], "metadata": meta, "strategy": "semantic"}]

        embeddings = self.model.encode(sentences, normalize_embeddings=True)
        
        chunks = []
        current_chunk_sentences = [sentences[0]]
        chunk_idx = 0
        
        for i in range(1, len(sentences)):
            sim = np.dot(embeddings[i], embeddings[i-1])
            
            if sim >= self.threshold:
                current_chunk_sentences.append(sentences[i])
            else:
                c_meta = dict(metadata or {})
                c_meta["chunk_id"] = chunk_idx
                c_meta["strategy"] = "semantic"
                chunks.append({
                    "text": " ".join(current_chunk_sentences),
                    "metadata": c_meta,
                    "strategy": "semantic"
                })
                chunk_idx += 1
                current_chunk_sentences = [sentences[i]]
                
        if current_chunk_sentences:
            c_meta = dict(metadata or {})
            c_meta["chunk_id"] = chunk_idx
            c_meta["strategy"] = "semantic"
            chunks.append({
                "text": " ".join(current_chunk_sentences),
                "metadata": c_meta,
                "strategy": "semantic"
            })
            
        return chunks

class RecursiveCharacterChunker(BaseChunker):
    """
    Splits text recursively based on character limits, snapping to word boundaries.
    """
    def __init__(self, chunk_size: int = 500, chunk_overlap: int = 50):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        
    def chunk(self, text: str, metadata: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        chunks = []
        start = 0
        text_len = len(text)
        chunk_idx = 0
        
        while start < text_len:
            end = start + self.chunk_size
            if end >= text_len:
                chunk_text = text[start:]
            else:
                space_idx = text.rfind(" ", start, end)
                if space_idx != -1 and space_idx > start + self.chunk_size // 2:
                    end = space_idx
                chunk_text = text[start:end]
                
            meta = dict(metadata or {})
            meta["chunk_id"] = chunk_idx
            meta["strategy"] = "recursive"
            chunks.append({
                "text": chunk_text.strip(),
                "metadata": meta,
                "strategy": "recursive"
            })
            chunk_idx += 1
            
            start = end - self.chunk_overlap
            if start >= text_len:
                break
                
        return chunks

class MetadataAwareChunker(BaseChunker):
    """
    Wraps any chunker to enforce rich metadata (doc_id, lang, source, passage_id)
    and handles parent-child passage linkages.
    """
    def __init__(self, primary_chunker: Optional[BaseChunker] = None):
        self.primary_chunker = primary_chunker or FixedWindowChunker(window_size=3, overlap=1)

    def chunk(self, text: str, metadata: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        meta = metadata or {}
        chunks = self.primary_chunker.chunk(text, metadata=meta)
        for c in chunks:
            c["metadata"]["parent_text"] = text[:300]
            c["metadata"]["lang"] = meta.get("lang", "en")
            c["metadata"]["doc_id"] = meta.get("doc_id", "unknown")
        return chunks
