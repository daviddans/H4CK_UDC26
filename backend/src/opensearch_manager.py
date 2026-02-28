import os
from opensearchpy import OpenSearch, helpers
from sentence_transformers import SentenceTransformer
from readpdf import limpiar_pdf
from text_utils import crear_chunks

class OpenSearchManager:
    def __init__(self, host='localhost', port=9200, auth=('admin', 'ComplexPassword123!')):
        try:
            self.client = OpenSearch(
                hosts=[{'host': host, 'port': port}],
                http_auth=auth,
                use_ssl=True,
                verify_certs=False,
                ssl_show_warn=False,
                timeout=30
            )
            # Cambiamos al modelo Multilingual E5 Small
            self.model = SentenceTransformer('intfloat/multilingual-e5-small')
            print("Modelo Multilingual E5 cargado correctamente.")
        except Exception as e:
            print(f"Error en inicialización: {e}")
            raise

    def init_index(self, index_name):
        """Crea el índice optimizado para 384 dimensiones (E5 Small)."""
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
                    "embedding": {
                        "type": "knn_vector",
                        "dimension": 384, # El modelo E5-small tiene 384 dimensiones
                        "method": {
                            "name": "hnsw",
                            "space_type": "cosinesimil",
                            "engine": "faiss"
                        }
                    },
                    "metadata": {
                        "properties": {
                            "source": {"type": "keyword"},
                            "chunk_id": {"type": "integer"}
                        }
                    }
                }
            }
        }
        if self.client.indices.exists(index=index_name):
            self.client.indices.delete(index=index_name)
        self.client.indices.create(index=index_name, body=index_body)
        print(f"Índice '{index_name}' reiniciado.")

    def index_pdf(self, index_name, file_path):
        """Indexación con prefijo 'passage:' requerido por E5."""
        if not os.path.exists(file_path):
            print(f"Error: Ruta no encontrada: {file_path}")
            return

        try:
            texto = limpiar_pdf(file_path)
            if not texto: return
            chunks = crear_chunks(texto)

            def acciones_bulk():
                for i, chunk in enumerate(chunks):
                    # IMPORTANTE: E5 requiere el prefijo 'passage: ' para indexar
                    texto_para_embedding = f"passage: {chunk}"
                    vector = self.model.encode(texto_para_embedding).tolist()
                    
                    yield {
                        "_index": index_name,
                        "_source": {
                            "content": chunk,
                            "embedding": vector,
                            "metadata": {
                                "source": os.path.basename(file_path),
                                "chunk_id": i
                            }
                        }
                    }

            helpers.bulk(self.client, acciones_bulk())
            print(f"Documento '{os.path.basename(file_path)}' indexado con E5.")

        except Exception as e:
            print(f"Error indexando: {e}")

    def semantic_search(self, index_name, query_text, top_k=3):
        """Búsqueda con prefijo 'query:' requerido por E5."""
        try:
            # IMPORTANTE: E5 requiere el prefijo 'query: ' para buscar
            texto_busqueda = f"query: {query_text}"
            vector_busqueda = self.model.encode(texto_busqueda).tolist()
            
            query_body = {
                "size": top_k,
                "query": {
                    "knn": {
                        "embedding": {
                            "vector": vector_busqueda,
                            "k": top_k
                        }
                    }
                }
            }
            return self.client.search(index=index_name, body=query_body)
        except Exception as e:
            print(f"Error en búsqueda: {e}")
            return None