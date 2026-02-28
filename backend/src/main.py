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
            return
        
        query = " ".join(sys.argv[2:])
        res = manager.semantic_search(INDEX_NAME, query, size=5, knn_k=50)

        print(f"\n--- Resultados para: '{query}' ---")
        for hit in res["hits"]["hits"]:
            score = hit.get("_score", 0.0)
            src = hit["_source"]
            doc_id = src.get("doc_id")
            chunk_index = src.get("chunk_index")
            txt = src.get("content", "")[:220]
            print(f"Doc: {doc_id} | chunk={chunk_index} | score={score:.4f}")
            print(f"Texto: {txt}...\n")

    else:
        print("Comando no reconocido.")

if __name__ == "__main__":
    main()