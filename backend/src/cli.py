import sys
import os
from ollama_manager import OllamaManager
from opensearch_manager import OpenSearchManager
from readpdf import limpiar  # Importamos la función que extrae texto y metadatos

INDEX_NAME = "mi-archivo-inteligente"


def main():
    if len(sys.argv) < 2:
        print("\n--- Mi Archivo Inteligente (Híbrido + Metadatos) ---")
        print("Comandos disponibles:")
        print(
            "  python main.py init                       -> Configurar índice y pipeline"
        )
        print(
            "  python main.py index <ruta> [tag1 tag2]   -> Indexar archivo con metadatos"
        )
        print(
            "  python main.py search <query>             -> Búsqueda de alta precisión"
        )
        print(
            "  python main.py ask_ai <query>             -> RAG: Búsqueda + Respuesta de IA"
        )
        return

    manager = OpenSearchManager()
    ollama_manager = OllamaManager()
    comando = sys.argv[1].lower()

    if comando == "init":
        manager.init_index(INDEX_NAME)

    elif comando == "index":
        if len(sys.argv) < 3:
            print("Error: Proporciona la ruta del archivo.")
            return

        file_path = sys.argv[2]
        # Cualquier argumento después de la ruta se guarda como etiqueta
        tags = sys.argv[3:] if len(sys.argv) > 3 else []

        if not os.path.exists(file_path):
            print(f"Error: El archivo '{file_path}' no existe.")
            return

        try:
            print(f"Procesando archivo y metadatos: {file_path}...")
            # 'limpiar' ahora devuelve un dict: {"autor": ..., "creation_date": ..., "lang": ..., "text": ...}
            data_extraida = limpiar(file_path)

            # Pasamos los datos individualmente al manager
            # IMPORTANTE: Asegúrate de que index_pdf en opensearch_manager.py acepte estos argumentos
            manager.index_pdf(
                index_name=INDEX_NAME,
                file_path=file_path,
                texto=data_extraida.get(
                    "text"
                ),  # Enviamos el string puro para evitar errores de tipo
                autor=data_extraida.get("autor", "Desconocido"),
                creation_date=data_extraida.get("creation_date", "1970-01-01"),
                lang=data_extraida.get("lang", "es"),
                tags=tags,
            )
            print(f"Éxito: '{os.path.basename(file_path)}' indexado con éxito.")

        except Exception as e:
            print(f"Error crítico en la indexación: {e}")

    elif comando == "search":
        if len(sys.argv) < 3:
            print("Error: ¿Qué quieres buscar?")
        else:
            busqueda = " ".join(sys.argv[2:])
            res = manager.hybrid_search_rrf(INDEX_NAME, busqueda)

            if res and res["hits"]["hits"]:
                print(f"\n--- Resultados para: '{busqueda}' ---")
                for hit in res["hits"]["hits"]:
                    score = hit["_score"]
                    meta = hit["_source"]["metadata"]
                    nombre_archivo = hit["_source"]["chunk_data"]["source"]
                    txt = hit["_source"]["content"][:150]

                    print(f"Archivo: {nombre_archivo} | Score: {score:.4f}")
                    print(
                        f"Autor: {meta.get('author')} | Fecha: {meta.get('creation_date')}"
                    )
                    print(f"Texto: {txt}...\n" + "-" * 50)
            else:
                print("No se encontraron resultados.")

    elif comando == "ask_ai":
        query = (
            " ".join(sys.argv[2:])
            if len(sys.argv) > 2
            else input("¿Qué quieres preguntar a la IA? ")
        )

        if not query:
            return

        res = manager.hybrid_search_rrf(INDEX_NAME, query)

        if not res or not res["hits"]["hits"]:
            print("No hay contexto suficiente para responder.")
            return

        # Recuperamos solo el contenido de texto para el contexto de la IA
        context_chunks = [hit["_source"]["content"] for hit in res["hits"]["hits"]]
        respuesta = ollama_manager.generate_answer(query, context_chunks)

        print(f"\n--- Respuesta de la IA ---\n{respuesta}\n" + "-" * 50)


if __name__ == "__main__":
    main()
