import sys

from ollama_manager import OllamaManager
from opensearch_manager import OpenSearchManager

INDEX_NAME = "mi-archivo-inteligente"

INDEXNAME = "my-index"


def main():
    if len(sys.argv) < 2:
        print("\n--- Mi Archivo Inteligente (Híbrido) ---")
        print("Comandos disponibles:")
        print("  python main.py init              -> Configurar índice y pipeline RRF")
        print("  python main.py index <ruta.pdf>  -> Indexar un PDF")
        print(
            "  python main.py search <query>    -> Búsqueda de alta precisión (3 vías)"
        )
        print(
            "  python main.py ask_ai <query>    -> Búsqueda + Respuesta de IA (RRF + Ollama)"
        )
        return

    manager = OpenSearchManager()
    ollama_manager = OllamaManager()
    comando = sys.argv[1].lower()

    if comando == "init":
        manager.init_index(INDEX_NAME)

    elif comando == "index":
        if len(sys.argv) < 3:
            print("Error: Proporciona la ruta del PDF.")
            return
        else:
            manager.index_pdf(INDEX_NAME, sys.argv[2])

    elif comando == "search":
        if len(sys.argv) < 3:
            print("Error: ¿Qué quieres buscar?")
        else:
            busqueda = " ".join(sys.argv[2:])
            # Llamamos a la nueva función con RRF
            res = manager.hybrid_search_rrf(INDEX_NAME, busqueda)

            if res and res["hits"]["hits"]:
                print(f"\n--- Resultados (RRF Hybrid) para: '{busqueda}' ---")
                for hit in res["hits"]["hits"]:
                    score = hit["_score"]
                    src = hit["_source"]["metadata"]["source"]
                    txt = hit["_source"]["content"][:]
                    print(f"ID: {src} | Score RRF: {score:.6f}")
                    print(f"Texto: {txt}...\n" + "-" * 40)
            else:
                print("No se encontraron resultados.")

            return
    elif comando == "ask_ai":
        question = input("¿Qué quieres preguntarle a la IA? ")
        res = manager.hybrid_search_rrf(INDEX_NAME, question)

        if not res:
            print("No se encontraron resultados para la búsqueda.")
            return -1

        ollama_response = ollama_manager.generate_answer(
            question, [hit["_source"]["content"] for hit in res["hits"]["hits"]]
        )
        print(f"\n--- Respuesta de la IA ---\n{ollama_response}\n" + "-" * 40)


if __name__ == "__main__":
    main()
