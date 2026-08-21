import json
import faiss
import pickle
import torch
import numpy as np
from typing import List, Dict, Any, Tuple
from loguru import logger
from sentence_transformers import SentenceTransformer

from app.config import get_settings

# Optimize PyTorch CPU inference threads
torch.set_num_threads(4)

class VectorDB:
    def __init__(self):
        self.settings = get_settings()
        self.encoder = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
        
        # Load indexes (built by scripts/build_index.py or scripts/build_multilingual_index.py)
        try:
            self.faiss_index = faiss.read_index(self.settings.faiss_index_path)
            logger.info(f"Loaded FAISS index from {self.settings.faiss_index_path}")
        except Exception as e:
            logger.warning(f"Could not load FAISS index: {e}. Running in degraded mode.")
            self.faiss_index = None

        try:
            with open(self.settings.bm25_index_path, "rb") as f:
                self.bm25 = pickle.load(f)
            logger.info(f"Loaded BM25 index from {self.settings.bm25_index_path}")
        except Exception as e:
            logger.warning(f"Could not load BM25 index: {e}.")
            self.bm25 = None

        try:
            self.metadata = []
            with open(self.settings.metadata_path, "r", encoding="utf-8") as f:
                for line in f:
                    self.metadata.append(json.loads(line))
            logger.info(f"Loaded {len(self.metadata)} metadata records.")
        except Exception as e:
            logger.warning(f"Could not load metadata: {e}.")
            self.metadata = []

    def dense_search(self, query: str, top_k: int = 6) -> List[Dict[str, Any]]:
        """Search using FAISS (dense embeddings)"""
        if not self.faiss_index or not self.metadata:
            return []
            
        q_emb = self.encoder.encode([query], normalize_embeddings=True)
        scores, indices = self.faiss_index.search(q_emb, top_k)
        
        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx != -1 and idx < len(self.metadata):
                item = dict(self.metadata[idx])
                item["score"] = float(score)
                item["method"] = "faiss"
                results.append(item)
        return results

    def sparse_search(self, query: str, top_k: int = 6) -> List[Dict[str, Any]]:
        """Search using BM25 (keyword matching)"""
        if not self.bm25 or not self.metadata:
            return []
            
        tokenized_query = query.lower().split()
        scores = self.bm25.get_scores(tokenized_query)
        
        top_indices = np.argsort(scores)[::-1][:top_k]
        
        results = []
        for idx in top_indices:
            if scores[idx] > 0:
                item = dict(self.metadata[idx])
                item["score"] = float(scores[idx])
                item["method"] = "bm25"
                results.append(item)
        return results

    def hybrid_search(self, query: str, top_k: int = 6) -> List[Dict[str, Any]]:
        """Combine results from Dense and Sparse, ready for reranking"""
        dense_results = self.dense_search(query, top_k=min(self.settings.top_k_dense, 6))
        sparse_results = self.sparse_search(query, top_k=min(self.settings.top_k_sparse, 6))
        
        seen_texts = set()
        combined = []
        
        for item in dense_results + sparse_results:
            text = item.get("text", "")
            if text not in seen_texts:
                seen_texts.add(text)
                combined.append(item)
                
        return combined[:top_k]

# Singleton
_db = None

def init_db():
    global _db
    _db = VectorDB()

def get_db() -> VectorDB:
    if _db is None:
        raise RuntimeError("VectorDB not initialized. Call init_db() first.")
    return _db
