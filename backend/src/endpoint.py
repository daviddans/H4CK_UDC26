from fastapi import FastAPI
from pydantic import BaseModel
from opensearchpy import OpenSearch
from opensearch_manager import OpenSearchManager


manager = OpenSearchManager()
app = FastAPI()
index = None

INDEX_NAME = "my-index"


class SearchFile(BaseModel):
    path: str


class Querry(BaseModel):
    querry: str


client = OpenSearch(
    hosts=[{"host": "localhost", "port": 9200}],
    http_auth=("admin", "ComplexPassword123!"),
    use_ssl=True,
    verify_certs=False,  # Necessary for local self-signed certs
    ssl_show_warn=False,
)


@app.get("/init")
def init_index():
    manager.init_index(INDEX_NAME)
    return {"estado": "ok"}


@app.get("/add-index")
def generate_index(file: SearchFile):
    manager.index_pdf(INDEX_NAME, file)
    return {"estado": "ok"}


@app.post("/search ")
def search_file(query: Querry):
    return manager.hybrid_search_rrf(INDEX_NAME, query)
