from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel
from opensearchpy import OpenSearch
from opensearch_manager import OpenSearchManager
from ollama_manager import OllamaManager

manager = OpenSearchManager()
app = FastAPI()
index = None

INDEX_NAME = "my-index"


class SearchFile(BaseModel):
    path: str


class Querry(BaseModel):
    querry: str


class Question(BaseModel):
    question: str


client = OpenSearch(
    hosts=[{"host": "localhost", "port": 9200}],
    http_auth=("admin", "ComplexPassword123!"),
    use_ssl=True,
    verify_certs=False,  # Necessary for local self-signed certs
    ssl_show_warn=False,
)


@app.post("/init")
def init_index():
    manager.init_index(INDEX_NAME)
    return {"estado": "ok"}


@app.post("/add-index")
def generate_index(file: SearchFile):
    manager.index_pdf(INDEX_NAME, file)
    return {"estado": "ok"}


@app.post("/search ")
def search_file(query: Querry):
    return manager.hybrid_search_rrf(INDEX_NAME, query)


@app.post("/question")
def question_ollama(question: Question):
    ollama_manager = OllamaManager()

    context = manager.hybrid_search_rrf(INDEX_NAME, question)
    if not context:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Item no encontrado"
        )
    response = ollama_manager.generate_answer(
        question, [hit["_source"]["content"] for hit in context["hits"]["hits"]]
    )

    return {"response": response}
