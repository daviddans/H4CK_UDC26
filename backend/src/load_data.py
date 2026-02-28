import json
from typing import List, Dict, Any

REQUIRED_FIELDS = {
    "chunk_id": str,
    "doc_id": str,
    "title": str,
    "page_start": int,
    "page_end": int,
    "lang": str,
    "doc_type": str,
    "category": str,
    "tags": list,
    "text": str,
}

def load_chunks(path: str) -> List[Dict[str, Any]]:
    with open(path, "r", encoding="utf-8") as f:
        chunks = json.load(f)

    if not isinstance(chunks, list) or not chunks:
        raise ValueError("mock_chunks.json must be a non-empty list")

    seen = set()
    for i, c in enumerate(chunks):
        if not isinstance(c, dict):
            raise ValueError(f"Chunk at index {i} is not an object")
        for k, t in REQUIRED_FIELDS.items():
            if k not in c:
                raise ValueError(f"Chunk {i} missing field '{k}'")
            if not isinstance(c[k], t):
                raise ValueError(f"Chunk {i} field '{k}' must be {t.__name__}")
        if c["chunk_id"] in seen:
            raise ValueError(f"Duplicate chunk_id: {c['chunk_id']}")
        seen.add(c["chunk_id"])
    return chunks