import json
import numpy as np
from typing import List, Dict, Any, Optional

from config import EMBEDS_PATH, META_PATH
from embeddings import get_model

def _normalize(v: np.ndarray) -> np.ndarray:
    return v / (np.linalg.norm(v) + 1e-12)

def _load_artifacts():
    emb = np.load(EMBEDS_PATH).astype(np.float32)  # [N, D] ya normalizado
    with open(META_PATH, "r", encoding="utf-8") as f:
        meta = json.load(f)
    return emb, meta

def semantic_search(
    query: str,
    top_k: int = 10,
    doc_type: Optional[str] = None,
    category: Optional[str] = None,
    tags_all: Optional[List[str]] = None,
    lang: Optional[str] = None
) -> List[Dict[str, Any]]:
    emb, meta = _load_artifacts()

    # filtro por metadatos (más adelante esto lo hará OpenSearch)
    mask = np.ones(len(meta), dtype=bool)

    if doc_type:
        mask &= np.array([m["doc_type"] == doc_type for m in meta], dtype=bool)
    if category:
        mask &= np.array([m["category"] == category for m in meta], dtype=bool)
    if lang:
        mask &= np.array([m["lang"] == lang for m in meta], dtype=bool)
    if tags_all:
        tags_all_set = set(tags_all)
        mask &= np.array([tags_all_set.issubset(set(m["tags"])) for m in meta], dtype=bool)

    idx = np.where(mask)[0]
    if idx.size == 0:
        return []

    sub_emb = emb[idx]  # [M, D]

    model = get_model()
    q = model.encode([f"query: {query}"], convert_to_numpy=True).astype(np.float32)[0]
    q = _normalize(q)

    # cosine similarity (dot product porque emb está normalizado)
    scores = sub_emb @ q  # [M]
    order = np.argsort(-scores)[:top_k]
    top_idx = idx[order]

    results = []
    for j in top_idx:
        m = meta[j]
        results.append({
            "score": float((emb[j] @ q)),  # coseno
            "chunk_id": m["chunk_id"],
            "doc_id": m["doc_id"],
            "title": m["title"],
            "page_start": m["page_start"],
            "page_end": m["page_end"],
            "lang": m["lang"],
            "doc_type": m["doc_type"],
            "category": m["category"],
            "tags": m["tags"],
            "text": m["text"],
        })
    return results