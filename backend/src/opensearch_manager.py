import os
from opensearchpy import OpenSearch, helpers
from sentence_transformers import SentenceTransformer
from readpdf import limpiar
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

            # Creamos/Actualizamos el pipeline híbrido al iniciar
            self.create_rrf_pipeline()
        except Exception as e:
            print(f"Error en inicialización: {e}")
            raise

    def create_rrf_pipeline(self, pipeline_id="rrf-hybrid-pipeline"):
        """
        Configura un Pipeline Híbrido con normalización Min-Max y pesos.
        Se usa arithmetic_mean para evitar errores de compatibilidad con RRF directo.
        """
        pipeline_body = {
            "description": "Pipeline para combinar BM25 y k-NN con pesos optimizados",
            "phase_results_processors": [
                {
                    "normalization-processor": {
                        "normalization": {"technique": "min_max"},
                        "combination": {
                            "technique": "arithmetic_mean",
                            "parameters": {
                                "weights": [0.7, 0.3]  # 30% Léxico, 70% Semántico
                            },
                        },
                    }
                }
            ],
        }
        try:
            # Intentamos eliminar el pipeline previo si existe para asegurar la actualización
            if self.client.search_pipeline.get(id=pipeline_id, ignore=[404]):
                self.client.search_pipeline.delete(id=pipeline_id)

            self.client.search_pipeline.put(id=pipeline_id, body=pipeline_body)
            print(f"Pipeline '{pipeline_id}' configurado con éxito (Pesos: 0.3/0.7).")
        except Exception as e:
            print(f"Error configurando el pipeline: {e}")

    def init_index(self, index_name):
        """Crea el índice optimizado para vectores de 384 dimensiones."""
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
        print(f"Índice '{index_name}' reiniciado.")

    def index_pdf(self, index_name, file_path):
        """Indexación con prefijo 'passage:' para E5."""
        if not os.path.exists(file_path):
            print(f"Error: No se encuentra el archivo {file_path}")
            return

        texto = limpiar(file_path)
        if not texto:
            print("El PDF está vacío o no se pudo limpiar.")
            return

        chunks = crear_chunks(texto)

        def acciones_bulk():
            for i, chunk in enumerate(chunks):
                # E5 requiere el prefijo 'passage: ' para indexar
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
        print(f"Documento '{os.path.basename(file_path)}' indexado correctamente.")

    def hybrid_search_rrf(self, index_name, query_text, top_k=5):
        """Búsqueda híbrida usando el pipeline configurado."""
        try:
            # E5 requiere el prefijo 'query: ' para buscar
            vector_busqueda = self.model.encode(f"query: {query_text}").tolist()

            query_body = {
                "size": top_k,
                "_source": {"exclude": ["embedding"]},
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

            return self.client.search(
                index=index_name,
                body=query_body,
                params={"search_pipeline": "rrf-hybrid-pipeline"},
            )
        except Exception as e:
            print(f"Error en búsqueda híbrida: {e}")
            return None
