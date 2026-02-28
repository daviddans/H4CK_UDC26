import re

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel

from ollama_manager import OllamaManager
from opensearch_manager import OpenSearchManager


manager = OpenSearchManager()
ollama_manager = OllamaManager(model="qwen2.5:7b-instruct")
app = FastAPI()

INDEX_NAME = "mi-archivo-inteligente"
MAX_CONTEXT_CHUNKS = 4
MAX_CHARS_PER_CHUNK = 500


class SearchFile(BaseModel):
    path: str


class AddIndexRequest(BaseModel):
    path: str | None = None
    file: SearchFile | None = None


class SearchRequest(BaseModel):
    querry: str | None = None
    query: str | None = None
    q: str | None = None


class AskRequest(BaseModel):
    question: str | None = None
    search_text: str | None = None
    busqueda: str | None = None
    querry: str | None = None
    query: str | None = None
    q: str | None = None


def _get_query_text(payload: SearchRequest | AskRequest):
    if isinstance(payload, AskRequest):
        return payload.question or payload.query or payload.querry or payload.q
    return payload.query or payload.querry or payload.q


def _get_search_text(payload: AskRequest):
    return (
        payload.search_text
        or payload.busqueda
        or payload.query
        or payload.querry
        or payload.q
        or payload.question
    )


def _format_title(source: str):
    base = re.sub(r"\.[a-zA-Z0-9]+$", "", source)
    base = re.sub(r"[_-]+", " ", base).strip()
    if not base:
        return "Indexed Document"
    return re.sub(r"\b\w", lambda m: m.group(0).upper(), base)


def _make_doc_id(source: str):
    slug = re.sub(r"\.[a-zA-Z0-9]+$", "", source.lower())
    slug = re.sub(r"[^a-z0-9]+", "-", slug).strip("-")
    return f"BACK-{slug or 'document'}"


def _make_snippet(content: str, query_text: str, size: int = 260):
    clean = re.sub(r"\s+", " ", content or "").strip()
    if not clean:
        return "<span>No snippet available</span>"

    tokens = []
    for token in query_text.lower().split():
        token = token.strip()
        if len(token) > 1 and token not in tokens:
            tokens.append(token)

    lowered = clean.lower()
    first_pos = -1
    for token in tokens:
        idx = lowered.find(token)
        if idx >= 0 and (first_pos < 0 or idx < first_pos):
            first_pos = idx

    start = max(0, first_pos - 80) if first_pos >= 0 else 0
    text = clean[start : start + size]

    for token in tokens:
        text = re.sub(
            re.escape(token),
            lambda m: f"<mark>{m.group(0)}</mark>",
            text,
            flags=re.IGNORECASE,
        )

    prefix = "..." if start > 0 else ""
    suffix = "..." if start + size < len(clean) else ""
    return f"{prefix}{text}{suffix}"


def _safe_int(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _ensure_index(index_name: str):
    try:
        exists = manager.client.indices.exists(index=index_name)
    except Exception:
        exists = False
    if not exists:
        manager.init_index(index_name)


@app.get("/init")
def init_index():
    manager.init_index(INDEX_NAME)
    return {"estado": "ok", "index": INDEX_NAME}


@app.get("/add-index")
def add_index_get(path: str = Query(..., description="Absolute or relative file path")):
    _ensure_index(INDEX_NAME)
    manager.index_pdf(INDEX_NAME, path)
    return {"estado": "ok", "path": path, "index": INDEX_NAME}


@app.post("/add-index")
def add_index_post(payload: AddIndexRequest):
    file_path = payload.path or (payload.file.path if payload.file else None)
    if not file_path:
        raise HTTPException(status_code=400, detail="Missing file path")

    _ensure_index(INDEX_NAME)
    manager.index_pdf(INDEX_NAME, file_path)
    return {"estado": "ok", "path": file_path, "index": INDEX_NAME}


@app.post("/search")
@app.post("/search ")
def search_file(payload: SearchRequest):
    query_text = _get_query_text(payload)
    if not query_text:
        raise HTTPException(status_code=400, detail="Missing query text")

    result = manager.hybrid_search_rrf(INDEX_NAME, query_text)
    if result is None:
        raise HTTPException(
            status_code=500,
            detail=(
                f"Search failed on index '{INDEX_NAME}'. "
                "Run /init and then /add-index before searching."
            ),
        )
    return result


@app.post("/ask")
@app.post("/ask_ai")
def ask_file(payload: AskRequest):
    search_text = _get_search_text(payload)
    question = payload.question or search_text
    if not question:
        raise HTTPException(status_code=400, detail="Missing question text")
    if not search_text:
        raise HTTPException(status_code=400, detail="Missing search text")

    result = manager.hybrid_search_rrf(
        INDEX_NAME,
        search_text,
        top_k=MAX_CONTEXT_CHUNKS,
    )
    if result is None:
        raise HTTPException(
            status_code=500,
            detail=(
                f"Search failed on index '{INDEX_NAME}'. "
                "Run /init and then /add-index before asking."
            ),
        )

    raw_hits = result.get("hits", {}).get("hits", [])
    if not isinstance(raw_hits, list):
        raw_hits = []

    chunks = []
    citations = []

    for idx, hit in enumerate(raw_hits[:MAX_CONTEXT_CHUNKS]):
        if not isinstance(hit, dict):
            continue
        source_data = hit.get("_source", {})
        if not isinstance(source_data, dict):
            continue

        content = source_data.get("content", "")
        if not isinstance(content, str):
            content = str(content or "")
        metadata = source_data.get("metadata", {})
        if not isinstance(metadata, dict):
            metadata = {}
        source_name = metadata.get("source", "document.txt")
        if not isinstance(source_name, str):
            source_name = str(source_name or "document.txt")
        chunk_id = _safe_int(metadata.get("chunk_id", idx), idx)

        if content:
            chunks.append(content[:MAX_CHARS_PER_CHUNK])
            citations.append(
                {
                    "doc_id": _make_doc_id(source_name),
                    "title": _format_title(source_name),
                    "page": chunk_id + 1,
                    "snippet_html": _make_snippet(content, question),
                }
            )

    if not chunks:
        return {
            "answer": "No se encontró contexto suficiente para responder esa pregunta.",
            "citations": [],
        }

    try:
        # Mismo flujo que main.py: búsqueda híbrida + respuesta LLM con contexto.
        answer = ollama_manager.generate_answer(question, chunks)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Ollama request failed: {exc}",
        )

    return {
        "answer": answer,
        "citations": citations,
    }
