import os
import json
import faiss
import pickle
from loguru import logger
from datasets import load_dataset
from sentence_transformers import SentenceTransformer
from rank_bm25 import BM25Okapi
import numpy as np

# Adjust based on where script is run from
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX_DIR = os.path.join(BASE_DIR, "indexes")

def build_index():
    os.makedirs(INDEX_DIR, exist_ok=True)
    
    logger.info("Loading dataset: mteb/msmarco (subset)")
    # Just grab a small chunk for the hackathon (e.g., 5000 records) using streaming
    dataset = load_dataset("mteb/msmarco", "corpus", split="corpus", streaming=True)
    
    logger.info("Extracting texts...")
    texts = []
    ids = []
    for i, doc in enumerate(dataset):
        if i >= 5000:
            break
        texts.append(doc["text"])
        ids.append(doc["_id"])
    
    # Optional: Apply chunking strategy here.
    # For now, MSMARCO passages are already short enough, so we can index them directly.
    
    logger.info("Building BM25 Index (Sparse)...")
    tokenized_corpus = [doc.lower().split() for doc in texts]
    bm25 = BM25Okapi(tokenized_corpus)
    
    bm25_path = os.path.join(INDEX_DIR, "msmarco.bm25")
    with open(bm25_path, "wb") as f:
        pickle.dump(bm25, f)
    logger.info(f"Saved BM25 to {bm25_path}")
    
    logger.info("Building FAISS Index (Dense)...")
    model = SentenceTransformer("BAAI/bge-small-en-v1.5")
    
    logger.info("Encoding documents...")
    embeddings = model.encode(texts, show_progress_bar=True, normalize_embeddings=True)
    
    dimension = embeddings.shape[1]
    faiss_index = faiss.IndexFlatIP(dimension) # Inner Product is cosine sim since normalized
    faiss_index.add(embeddings)
    
    faiss_path = os.path.join(INDEX_DIR, "msmarco.faiss")
    faiss.write_index(faiss_index, faiss_path)
    logger.info(f"Saved FAISS to {faiss_path}")
    
    logger.info("Saving metadata...")
    metadata_path = os.path.join(INDEX_DIR, "metadata.jsonl")
    with open(metadata_path, "w", encoding="utf-8") as f:
        for i, text in enumerate(texts):
            doc = {
                "id": ids[i],
                "text": text
            }
            f.write(json.dumps(doc) + "\n")
    logger.info(f"Saved metadata to {metadata_path}")
    
    logger.info("Indexing complete! 🎉")

if __name__ == "__main__":
    build_index()
