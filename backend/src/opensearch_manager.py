import os
from opensearchpy import OpenSearch, helpers
from sentence_transformers import SentenceTransformer
from readpdf import limpiar_pdf
from text_utils import crear_chunks


class OpenSearchManager:
    def __init__(
        self, host="localhost", port=9200, auth=("admin", "ComplexPassword123!")
    ):
        try:
            self.client = OpenSearch(
                hosts=[{"host": host, "port": port}],
                http_auth=auth,
                use_ssl=True,
                verify_certs=False,
                ssl_show_warn=False,
                timeout=30,
            )
            # Mantenemos el modelo Multilingual E5 Small
            self.model = SentenceTransformer("intfloat/multilingual-e5-small")
            print("Modelo Multilingual E5 cargado.")

            # Intentamos crear el pipeline de RRF al iniciar
            self.create_rrf_pipeline()
        except Exception as e:
            print(f"Error en inicialización: {e}")
            raise

    def create_rrf_pipeline(self, pipeline_id="rrf-hybrid-pipeline"):
        """Configura un Search Pipeline con técnica RRF en OpenSearch."""
        pipeline_body = {
            "description": "Pipeline para combinar BM25 y k-NN usando RRF",
            "phase_results_processors": [
                {
                    "normalization-processor": {
                        "normalization": {"technique": "min_max"},
                        "combination": {
                            "technique": "rrf",
                            "parameters": {
                                "rank_constant": 60
                            },  # Valor estándar para RRF
                        },
                    }
                }
            ],
        }
        try:
            self.client.search_pipeline.put(id=pipeline_id, body=pipeline_body)
            print(f"Pipeline '{pipeline_id}' configurado correctamente.")
        except Exception as e:
            print(
                f"Aviso: No se pudo crear el pipeline (puede que ya exista o falte el plugin): {e}"
            )

    def init_index(self, index_name):
        """Crea el índice optimizado para vectores de 384 dimensiones."""
        index_body = {
            "settings": {
                "index": {"knn": True, "number_of_shards": 1, "number_of_replicas": 0}
            },
            "mappings": {
                "properties": {
                    "content": {"type": "text"},  # Necesario para la búsqueda clásica
                    "embedding": {
                        "type": "knn_vector",
                        "dimension": 384,
                        "method": {
                            "name": "hnsw",
                            "space_type": "cosinesimil",
                            "engine": "faiss",
                        },
                    },
                    "metadata": {
                        "properties": {
                            "source": {"type": "keyword"},
                            "chunk_id": {"type": "integer"},
                        }
                    },
                }
            },
        }
        if self.client.indices.exists(index=index_name):
            self.client.indices.delete(index=index_name)
        self.client.indices.create(index=index_name, body=index_body)
        print(f"Índice '{index_name}' reiniciado.")

    def index_pdf(self, index_name, file_path):
        """Indexación con prefijo 'passage:' para E5."""
        # ... (La lógica de indexación se mantiene igual que en tu archivo original)
        if not os.path.exists(file_path):
            return
        texto = limpiar_pdf(file_path)
        if not texto:
            return
        chunks = crear_chunks(texto)

        def acciones_bulk():
            for i, chunk in enumerate(chunks):
                texto_para_embedding = f"passage: {chunk}"
                vector = self.model.encode(texto_para_embedding).tolist()
                yield {
                    "_index": index_name,
                    "_source": {
                        "content": chunk,
                        "embedding": vector,
                        "metadata": {
                            "source": os.path.basename(file_path),
                            "chunk_id": i,
                        },
                    },
                }

        helpers.bulk(self.client, acciones_bulk())
        print(f"Documento '{os.path.basename(file_path)}' indexado.")

    def hybrid_search_rrf(self, index_name, query_text, top_k=5):
        """Búsqueda híbrida usando el pipeline RRF."""
        try:
            # Prefijo 'query:' para la parte semántica con E5
            vector_busqueda = self.model.encode(f"query: {query_text}").tolist()

            query_body = {
                "size": top_k,
                "_source": {"exclude": ["embedding"]},  # Ahorrar ancho de banda
                "query": {
                    "hybrid": {
                        "queries": [
                            # Sub-consulta 1: Léxica (BM25)
                            {"match": {"content": query_text}},
                            # Sub-consulta 2: Semántica (k-NN)
                            {
                                "knn": {
                                    "embedding": {"vector": vector_busqueda, "k": top_k}
                                }
                            },
                        ]
                    }
                },
            }
            # Es vital pasar el parámetro search_pipeline
            return self.client.search(
                index=index_name,
                body=query_body,
                params={"search_pipeline": "rrf-hybrid-pipeline"},
            )
        except Exception as e:
            print(f"Error en búsqueda RRF: {e}")
            return None

