import sys

from opensearch_dsl import query
import index
import indexer
import search
from opensearchpy import OpenSearch

INDEXNAME = "my-index"


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
    else:
        print(f"Unknown command: {command}. Use 'help' for available commands.")
        return -1

    print("Command executed successfully - none left to do.")
    return status


if __name__ == "__main__":
    main(len(sys.argv), sys.argv)

