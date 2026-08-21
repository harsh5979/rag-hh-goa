import torch
from typing import List, Dict, Any
from sentence_transformers import CrossEncoder

# Optimize PyTorch CPU inference threads
torch.set_num_threads(4)

class Reranker:
    def __init__(self, model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"):
        self.model = CrossEncoder(model_name)

    def rerank(self, query: str, documents: List[Dict[str, Any]], top_k: int = 3) -> List[Dict[str, Any]]:
        """
        Reranks a list of documents using a Cross-Encoder.
        Keeps candidates lean to maintain sub-30ms reranking latency.
        """
        if not documents:
            return []

        # Rerank top 3-4 candidate chunks for optimal speed-accuracy tradeoff
        candidates = documents[:4]

        # Truncate pair text to first 250 characters for fast evaluation
        pairs = [[query, doc.get("text", "")[:250]] for doc in candidates]
        
        # Predict scores
        scores = self.model.predict(pairs)
        
        # Add scores to documents and sort
        for i, doc in enumerate(candidates):
            doc["cross_encoder_score"] = float(scores[i])
            
        ranked_docs = sorted(candidates, key=lambda x: x["cross_encoder_score"], reverse=True)
        return ranked_docs[:top_k]

# Singleton instance
_reranker = None

def init_reranker():
    global _reranker
    _reranker = Reranker()

def get_reranker() -> Reranker:
    if _reranker is None:
        raise RuntimeError("Reranker not initialized. Call init_reranker() first.")
    return _reranker
