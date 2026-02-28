import os
import numpy as np
from opensearchpy import OpenSearch, helpers
from sentence_transformers import SentenceTransformer

from readpdf import limpiar_pdf
from text_utils import crear_chunks

def l2_normalize(v: np.ndarray) -> np.ndarray:
    if v.ndim == 1:
        return v / (np.linalg.norm(v) + 1e-12)
    return v / (np.linalg.norm(v, axis=1, keepdims=True) + 1e-12)

class OpenSearchManager:
    def __init__(
        self,
        host: str = "localhost",
        port: int = 9200,
        auth=("admin", "ComplexPassword123!"),
        use_ssl: bool = True,
        verify_certs: bool = False,
        device: str = "cuda"
    ):
        self.client = OpenSearch(
            hosts=[{"host": host, "port": port}],
            http_auth=auth,
            use_ssl=use_ssl,
            verify_certs=verify_certs,
            ssl_show_warn=False,
            timeout=60
        )

        self.model = SentenceTransformer("intfloat/multilingual-e5-small", device=device)
        self.dim = 384
        print("E5-small cargado (384 dims)")

    def init_index(self, index_name: str):
        """
        Crea índice con knn_vector (HNSW) + campos para filtros.
        """
        index_body = {
            "settings": {
                "index": {
                    "knn": True,
                    "number_of_shards": 1,
                    "number_of_replicas": 0
                }
            },
            "mappings": {
                "properties": {
                    "content": {"type": "text"},
                    "doc_id": {"type": "keyword"},
                    "chunk_index": {"type": "integer"},
                    "lang": {"type": "keyword"},
                    "doc_type": {"type": "keyword"},
                    "category": {"type": "keyword"},
                    "tags": {"type": "keyword"},
                    "page_start": {"type": "integer"},
                    "page_end": {"type": "integer"},
                    "embedding": {
                        "type": "knn_vector",
                        "dimension": self.dim,
                        "method": {
                            "name": "hnsw",
                            "space_type": "cosinesimil",
                            "engine": "faiss"
                        }
                    }
                }
            }
        }

        if self.client.indices.exists(index=index_name):
            self.client.indices.delete(index=index_name)
        self.client.indices.create(index=index_name, body=index_body)
        print(f"Índice '{index_name}' creado/reiniciado")

    def _encode_passages(self, chunks: list[str], batch_size: int = 32) -> list[list[float]]:
        """
        Batch embeddings + normalización.
        E5 recomienda prefijo passage:
        """
        passages = [f"passage: {c}" for c in chunks]
        vecs = self.model.encode(passages, batch_size=batch_size, convert_to_numpy=True, show_progress_bar=False)
        vecs = vecs.astype(np.float32)
        vecs = l2_normalize(vecs)
        return vecs.tolist()

    def _encode_query(self, query_text: str) -> list[float]:
        """
        Query embedding + normalización.
        E5 recomienda prefijo query:
        """
        q = self.model.encode([f"query: {query_text}"], convert_to_numpy=True, show_progress_bar=False).astype(np.float32)[0]
        q = l2_normalize(q)
        return q.tolist()

    def index_pdf(
        self,
        index_name: str,
        file_path: str,
        doc_type: str = "contract",
        category: str = "legal",
        tags: list[str] | None = None,
        lang: str = "auto",
        max_words: int = 260,
        overlap_words: int = 50
    ):
        """
        Indexa PDF: extrae texto -> chunking -> embeddings batch -> bulk.
        """
        if tags is None:
            tags = []

        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Ruta no encontrada: {file_path}")

        texto = limpiar_pdf(file_path)
        if not texto:
            print("PDF sin texto (o extracción vacía).")
            return

        chunks = crear_chunks(texto, max_words=max_words, overlap_words=overlap_words)
        if not chunks:
            print("No se pudieron generar chunks.")
            return

        doc_id = os.path.basename(file_path)
        vectors = self._encode_passages(chunks, batch_size=32)

        def acciones():
            for i, (chunk, vec) in enumerate(zip(chunks, vectors)):
                yield {
                    "_index": index_name,
                    "_id": f"{doc_id}:{i}",
                    "_source": {
                        "doc_id": doc_id,
                        "chunk_index": i,
                        "lang": lang,
                        "doc_type": doc_type,
                        "category": category,
                        "tags": tags,
                        "page_start": None,
                        "page_end": None,
                        "content": chunk,
                        "embedding": vec
                    }
                }

        helpers.bulk(self.client, acciones())
        print(f"Indexado '{doc_id}' con {len(chunks)} chunks")

    def semantic_search(
        self,
        index_name: str,
        query_text: str,
        size: int = 10,
        knn_k: int = 50,
        filters: dict | None = None
    ):
        """
        kNN search + filtros:
        filters puede incluir: doc_type, category, lang, doc_id, tags (lista)
        """
        if knn_k < size:
            knn_k = size

        if filters is None:
            filters = {}

        qvec = self._encode_query(query_text)

        filter_clauses = []
        for key in ["doc_type", "category", "lang", "doc_id"]:
            if filters.get(key):
                filter_clauses.append({"term": {key: filters[key]}})
        if filters.get("tags"):
            filter_clauses.append({"terms": {"tags": filters["tags"]}})

        query_body = {
            "size": size,
            "query": {
                "bool": {
                    "filter": filter_clauses,
                    "must": [
                        {
                            "knn": {
                                "embedding": {
                                    "vector": qvec,
                                    "k": knn_k
                                }
                            }
                        }
                    ]
                }
            }
        }

        return self.client.search(index=index_name, body=query_body)