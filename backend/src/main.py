import sys
from opensearch_manager import OpenSearchManager

<<<<<<< HEAD
INDEX_NAME = "mi-archivo-inteligente"
=======
from opensearch_dsl import query
import index
import indexer
import search
from opensearchpy import OpenSearch
>>>>>>> edfd73c278aaa050dc70048aa59c543693661776

def main():
    if len(sys.argv) < 2:
        print("\nComandos disponibles:")
        print("  python main.py init              -> Configurar índice")
        print("  python main.py index <ruta.pdf>  -> Indexar un PDF")
        print("  python main.py search <texto>    -> Buscar")
        return

<<<<<<< HEAD
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

=======

# Entry point for the aplication cli
def main(argc, argv):
    status = 0

    # Connect to OpenSearch with SSL and authentication
    try:
        client = OpenSearch(
            hosts=[{"host": "localhost", "port": 9200}],
            http_auth=("admin", "ComplexPassword123!"),
            use_ssl=True,
            verify_certs=False,  # Necessary for local self-signed certs
            ssl_show_warn=False,
        )
    except Exception as e:
        print(f"Error connecting to OpenSearch: {e}")
        return -1

    # Comand line interface for the application
    if argc < 2:
        print("Usage: python main.py help for more info")
        return 0
    command = argv[1].lower()
    if command == "help":
        print("Available commands:")
        print("  help -> Show this help message")
        print("  init -> Initialize the index")
        print("  index <file> -> to index")
    if command == "init":
        print("Initializing index...")
        status = index.create_index(client, INDEXNAME)
    if command == "index":
        file_path = argv[2] if argc > 2 else None
        if not file_path:
            print("Please provide a file to index. Usage: python main.py index <file>")
            return -1
        print(f"Indexing file: {file_path}")
        status = indexer.index_document(client, INDEXNAME, file_path)
    if command == "search":
        query = argv[2] if argc > 2 else None
        if not query:
            print(
                "Please provide a query to search. Usage: python main.py search <query>"
            )
            return -1
        search.search(client, INDEXNAME, query)
>>>>>>> edfd73c278aaa050dc70048aa59c543693661776
    else:
        print("Comando no reconocido.")

<<<<<<< HEAD
if __name__ == "__main__":
    main()
=======
    print("Command executed successfully - none left to do.")
    return status


if __name__ == "__main__":
    main(len(sys.argv), sys.argv)

>>>>>>> edfd73c278aaa050dc70048aa59c543693661776
