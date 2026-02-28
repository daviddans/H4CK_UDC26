from fastapi import FastAPI
from pydantic import BaseModel
import index
import search
from opensearchpy import OpenSearch

app = FastAPI()
INDEXNAME = "my-index"


class SearchFile(BaseModel):
    path: str


client = OpenSearch(
    hosts=[{"host": "localhost", "port": 9200}],
    http_auth=("admin", "ComplexPassword123!"),
    use_ssl=True,
    verify_certs=False,  # Necessary for local self-signed certs
    ssl_show_warn=False,
)


@app.get("/index")
def generate_index():
    status = index.create_index(client, INDEXNAME)
    return {"estado": "ok"}


@app.post("/search ")
def search_file(query: SearchFile):
    return search.search(client, INDEXNAME, query)
