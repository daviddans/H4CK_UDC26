from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel

from opensearch_manager import OpenSearchManager


manager = OpenSearchManager()
app = FastAPI()

INDEX_NAME = "my-index"


class SearchFile(BaseModel):
    path: str


class AddIndexRequest(BaseModel):
    path: str | None = None
    file: SearchFile | None = None


class SearchRequest(BaseModel):
    querry: str | None = None
    query: str | None = None
    q: str | None = None


@app.get("/init")
def init_index():
    manager.init_index(INDEX_NAME)
    return {"estado": "ok"}


@app.get("/add-index")
def add_index_get(path: str = Query(..., description="Absolute or relative file path")):
    manager.index_pdf(INDEX_NAME, path)
    return {"estado": "ok", "path": path}


@app.post("/add-index")
def add_index_post(payload: AddIndexRequest):
    file_path = payload.path or (payload.file.path if payload.file else None)
    if not file_path:
        raise HTTPException(status_code=400, detail="Missing file path")

    manager.index_pdf(INDEX_NAME, file_path)
    return {"estado": "ok", "path": file_path}


@app.post("/search")
@app.post("/search ")
def search_file(payload: SearchRequest):
    query_text = payload.query or payload.querry or payload.q
    if not query_text:
        raise HTTPException(status_code=400, detail="Missing query text")

    result = manager.hybrid_search_rrf(INDEX_NAME, query_text)
    if result is None:
        raise HTTPException(status_code=500, detail="Search failed")
    return result
