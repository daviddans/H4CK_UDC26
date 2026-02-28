import os
import json
import numpy as np

from config import DATA_PATH, ARTIFACTS_DIR, EMBEDS_PATH, META_PATH
from load_data import load_chunks
from embeddings import get_model

def _l2_normalize(mat: np.ndarray) -> np.ndarray:
    return mat / (np.linalg.norm(mat, axis=1, keepdims=True) + 1e-12)

def build_embedding_cache(mock_path: str = DATA_PATH):
    os.makedirs(ARTIFACTS_DIR, exist_ok=True)

    chunks = load_chunks(mock_path)
    model = get_model()

    passages = [f"passage: {c['text']}" for c in chunks]
    emb = model.encode(
        passages,
        batch_size=32,
        show_progress_bar=True,
        convert_to_numpy=True
    ).astype(np.float32)

    # Normalizamos => cosine similarity = dot product
    emb = _l2_normalize(emb)

    np.save(EMBEDS_PATH, emb)

    meta = [
        {
            "chunk_id": c["chunk_id"],
            "doc_id": c["doc_id"],
            "title": c["title"],
            "page_start": c["page_start"],
            "page_end": c["page_end"],
            "lang": c["lang"],
            "doc_type": c["doc_type"],
            "category": c["category"],
            "tags": c["tags"],
            "text": c["text"],
        }
        for c in chunks
    ]
    with open(META_PATH, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    print(f"[OK] Embedding cache built: {EMBEDS_PATH} shape={emb.shape}, meta={META_PATH} items={len(meta)}")





























































































