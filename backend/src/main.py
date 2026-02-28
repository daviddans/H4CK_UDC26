import sys
from opensearch_manager import OpenSearchManager

INDEX_NAME = "mi-archivo-inteligente"


def main():
    if len(sys.argv) < 2:
        print("\nComandos disponibles:")
        print("  python main.py init              -> Configurar índice")
        print("  python main.py index <ruta.pdf>  -> Indexar un PDF")
        print("  python main.py search <texto>    -> Buscar")
        return

    try:
        manager = OpenSearchManager()
    except:
        return

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


if __name__ == "__main__":
    main()
