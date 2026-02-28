from cmath import phase
from enum import auto
import os
import re
import numpy as np
from opensearchpy import OpenSearch, helpers
from sentence_transformers import SentenceTransformer
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

            # Actualizamos el pipeline para manejar 3 fuentes de puntuación
            self.create_rrf_pipeline()
        except Exception as e:
            raise e

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
                        # Para normalizar los datos se utiliza min_max para escalar
                        # los numeros en un rango de [0,1]
                        "normalization": {"technique": "min_max"},
                        # Permite combinar los distintos resultados obtenidos haciendo una ponderacion
                        # armonica
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
            if self.client.search_pipeline.get(id=pipeline_id):
                self.client.search_pipeline.delete(id=pipeline_id)

            self.client.search_pipeline.put(id=pipeline_id, body=pipeline_body)
        except Exception as e:
            raise e

    def init_index(self, index_name):
        """Crea el índice con soporte k-NN y mapeo de texto."""
        index_body = {
            "settings": {
                "analysis": {
                    "analyzer": {
                        "custom_analyzer": {
                            "type": "custom",
                            "tokenizer": "standard",
                            "filter": [
                                "lowercase", 
                                "asciifolding",
                                "stop",
                                "porter_stem"],
                        }
                    }
                },
                "index": {
                    "knn": True, 
                    "number_of_shards": 1,
                    "number_of_replicas": 0,
                    "similarity": {
                        "default": {
                            "type": "BM25",
                            "b": 0.3, # Reduce la penalización por longitud de documento
                            "k1": 1.2 # Controla la saturación de términos
                        }
                    }
                }
            },
            "mappings": {
                "properties": {
                    "content": {"type": "text"},
                    "embedding": {
                        "type": "knn_vector",
                        "dimension": 384,
                        "method": {
                            "name": "hnsw",
                            # Se compara la diferencia en entre los grados de los vectores
                            "space_type": "cosinesimil",
                            "engine": "faiss",
                        },
                    },
                    "chunk_data": {
                        "properties": {
                            "source": {"type": "keyword"},
                            "chunk_id": {"type": "integer"},
                        }
                    },
                    "metadata": {
                        "properties": {
                            "title": {"type": "keyword"},
                            "author": {"type": "keyword", "index": False},
                            "creation_date": {
                                "type": "date",
                                "format": "yyyy-MM-dd",
                                "index": False,
                            },
                            "type": {"type": "keyword", "index": False},
                            "tags": {"type": "keyword"},
                        }
                    },
                }
            },
        }
        if self.client.indices.exists(index=index_name):
            self.client.indices.delete(index=index_name)
        self.client.indices.create(index=index_name, body=index_body)

    def index_document(
        self, index_name, file_path, texto, autor, creation_date, lang, tags=None
    ):
        """Indexación usando el texto y metadatos ya extraídos."""
        if not texto:
            return

        # Ahora texto es un string, crear_chunks funcionará correctamente
        chunks = crear_chunks(texto)

        # Permite juntar todos los chunks
        def acciones_bulk():
            for i, chunk in enumerate(chunks):
                texto_para_embedding = f"passage: {chunk}"
                vector = self.model.encode(texto_para_embedding).tolist()
                yield {
                    "_index": index_name,
                    "_source": {
                        "content": chunk,
                        "embedding": vector,
                        "chunk_data": {
                            "source": os.path.basename(file_path),
                            "chunk_id": i,
                        },
                        "metadata": {
                            "title": os.path.basename(file_path),
                            "author": autor,
                            "creation_date": creation_date,
                            "type": lang,
                            "tags": tags if isinstance(tags, list) else [],
                        },
                    },
                }

        helpers.bulk(self.client, acciones_bulk())

    def hybrid_search_rrf(self, index_name, query_text, top_k=5):
        """Búsqueda de 3 vías para maximizar la precisión literal y semántica."""
        try:
            # Prefijo 'query: ' para búsqueda semántica
            res = self.client.count(index=index_name)
            doc_count = res['count']
            top_k = top_k + int(max(doc_count, 10000) / 100)
            vector_busqueda = self.model.encode(f"query: {query_text}").tolist()
            length = len(query_text)
            char_target = 200
            sigmoid = 1 / ( 1 + np.pow(np.e,-(length - char_target)) )

            query_body = {
                "size": TOTAL_QUERRY_SIZE,
                "_source": {"exclude": ["embedding"]},
                "query": {
                    "hybrid": {
                        "queries": [
                            # 1. Coincidencia de palabras sueltas
                            {"match": {
                                "content": {
                                    "query": query_text,
                                    "boost": 1 - sigmoid
                                    }
                                }
                            },
                            # 2. Coincidencia de FRASE EXACTA (Literalidad)
                            {"match_phrase": {
                                "content": {
                                    "query": query_text,
                                    "boost": 1 + sigmoid,
                                    }
                                }
                            },
                            # 3. Coincidencia Semántica (Vectores)
                            {
                                "knn": {
                                    "embedding": {
                                        "vector": vector_busqueda, 
                                        "k": top_k,
                                        "boost": 1 + sigmoid,
                                    }    
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
            return e
