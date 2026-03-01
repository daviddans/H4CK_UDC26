import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from opensearch_manager import OpenSearchManager
from ollama_manager import OllamaManager
from parser import limpiar

app = FastAPI()

search_manager = OpenSearchManager()
ai_manager = OllamaManager(model="qwen2.5:7b-instruct")

INDEX_NAME = "index"


class FilePath(BaseModel):
    path: str


class QueryRequest(BaseModel):
    query: str


@app.post("/init")
def init():
    """Reinicia o crea el índice de búsqueda."""
    search_manager.init_index(INDEX_NAME)
    return {"status": "Indice inicializado", "index": INDEX_NAME}


@app.post("/index-file")
def index_file(payload: FilePath):
    """Extrae texto de un archivo y lo mete en OpenSearch."""
    if not os.path.exists(payload.path):
        raise HTTPException(status_code=404, detail="Archivo no encontrado")

    extracted = limpiar(payload.path)
    if not extracted.get("text"):
        raise HTTPException(status_code=400, detail="No se pudo extraer texto")

    search_manager.index_document(
        index_name=INDEX_NAME,
        file_path=payload.path,
        texto=extracted["text"],
        autor=extracted.get("autor", "Desconocido"),
        creation_date=extracted.get("creation_date", "1970-01-01"),
        lang=extracted.get("lang", "es"),
    )
    return {"status": "ok", "indexed_file": payload.path}


@app.post("/search")
def search(payload: QueryRequest):
    """Buscamos dentro el cacho de pdf que nos piden"""
    results = search_manager.hybrid_search_rrf(INDEX_NAME, payload.query)
    if isinstance(results, Exception):
        raise HTTPException(status_code=500, detail=str(results))

    return results


@app.post("/ask")
def ask_ai(payload: QueryRequest):
    """Busca contexto y genera una respuesta con la IA."""
    # 1. Buscar los 4 fragmentos más relevantes
    search_result = search_manager.hybrid_search_rrf(INDEX_NAME, payload.query, top_k=5)
    if isinstance(search_result, Exception):
        raise HTTPException(status_code=500, detail=f"Search failed: {search_result}")

    hits = search_result.get("hits", {}).get("hits", [])
    if not hits:
        return {"answer": "No encontré información sobre eso.", "sources": []}

    # 2. Extraer solo el contenido de texto para la IA
    context_data = [hit["_source"] for hit in hits]

    # 3. Generar respuesta con Ollama
    try:
        answer = ai_manager.generate_answer(payload.query, context_data)
    except Exception as error:
        raise HTTPException(status_code=502, detail=f"LLM generation failed: {error}") from error

    # 4. Preparar fuentes simplificadas
    sources = []
    for hit in hits:
        meta = hit["_source"].get("chunk_data", {})
        sources.append({"file": meta.get("source"), "chunk": meta.get("chunk_id")})

    return {"answer": answer, "sources": sources}
