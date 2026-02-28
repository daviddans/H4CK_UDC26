import os
from opensearchpy import OpenSearch, helpers
from sentence_transformers import SentenceTransformer
from readpdf import limpiar
from text_utils import crear_chunks

TOTAL_QUERRY_SIZE = 1000


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
            # Mantenemos el modelo Multilingual E5 Small (384 dim)
            self.model = SentenceTransformer("intfloat/multilingual-e5-small")
            print("Modelo Multilingual E5 cargado.")

            # Actualizamos el pipeline para manejar 3 fuentes de puntuación
            self.create_rrf_pipeline()
        except Exception as e:
            print(f"Error en inicialización: {e}")
            raise

    def create_rrf_pipeline(self, pipeline_id="rrf-hybrid-pipeline"):
        """
        Configura el pipeline con 3 pesos:
        [Match Simple, Frase Exacta, Semántica k-NN]
        """
        pipeline_body = {
            "description": "Pipeline híbrido de 3 vías optimizado para precisión literal",
            "phase_results_processors": [
                {
                    "normalization-processor": {
                        "normalization": {"technique": "min_max"},
                        "combination": {
                            "technique": "harmonic_mean",
                            "parameters": {
                                # 15% Match, 60% Frase Literal, 25% Semántica
                                "weights": [0.15, 0.60, 0.25]
                            },
                        },
                    }
                }
            ],
        }
        try:
            if self.client.search_pipeline.get(id=pipeline_id, ignore=[404]):
                self.client.search_pipeline.delete(id=pipeline_id)

            self.client.search_pipeline.put(id=pipeline_id, body=pipeline_body)
            print(f"Pipeline '{pipeline_id}' configurado (Prioridad: Frase Literal).")
        except Exception as e:
            print(f"Error configurando el pipeline: {e}")

    def init_index(self, index_name):
        """Crea el índice con soporte k-NN y mapeo de texto."""
        index_body = {
            "settings": {
                "index": {"knn": True, "number_of_shards": 1, "number_of_replicas": 0}
            },
            "mappings": {
                "properties": {
                    "content": {"type": "text"},
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
        print(f"Índice '{index_name}' reiniciado correctamente.")

    def index_pdf(self, index_name, file_path):
        """Indexación con prefijo 'passage:' requerido por el modelo E5."""
        if not os.path.exists(file_path):
            return

        texto = limpiar(file_path)
        if not texto:
            return

        chunks = crear_chunks(texto)

        def acciones_bulk():
            for i, chunk in enumerate(chunks):
                # Prefijo 'passage: ' crítico para la calidad del embedding en E5
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

    def hybrid_search_rrf(self, index_name, query_text, top_k=10):
        """Búsqueda de 3 vías para maximizar la precisión literal y semántica."""
        try:
            # Prefijo 'query: ' para búsqueda semántica
            vector_busqueda = self.model.encode(f"query: {query_text}").tolist()

            query_body = {
                "size": TOTAL_QUERRY_SIZE,
                "_source": {"exclude": ["embedding"]},
                "query": {
                    "hybrid": {
                        "queries": [
                            # 1. Coincidencia de palabras sueltas
                            {"match": {"content": {"query": query_text}}},
                            # 2. Coincidencia de FRASE EXACTA (Literalidad)
                            {"match_phrase": {"content": {"query": query_text}}},
                            # 3. Coincidencia Semántica (Vectores)
                            {
                                "knn": {
                                    "embedding": {"vector": vector_busqueda, "k": top_k}
                                }
                            },
                        ]
                    }
                },
            }

            return self.client.search(
                index=index_name,
                body=query_body,
                params={"search_pipeline": "rrf-hybrid-pipeline"},
            )
        except Exception as e:
            print(f"Error en búsqueda híbrida: {e}")
            return None
