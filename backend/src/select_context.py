from typing import List, Dict, Any

def select_context(hits: List[Dict[str, Any]], max_chunks: int = 10, max_per_doc: int = 2, min_score: float = 0.0) -> List[Dict[str, Any]]:
    """
    - hits: lista ya ordenada por score desc
    - max_per_doc: evita que todo sea del mismo doc
    - min_score: umbral para limpiar ruido
    """
    selected = []
    per_doc = {}

    for h in hits:
        if h.get("score", 0.0) < min_score:
            continue

        doc_id = h["doc_id"]
        per_doc.setdefault(doc_id, 0)
        if per_doc[doc_id] >= max_per_doc:
            continue

        selected.append(h)
        per_doc[doc_id] += 1

        if len(selected) >= max_chunks:
            break

    return selected