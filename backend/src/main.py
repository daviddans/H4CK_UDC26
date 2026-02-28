import sys
import index
import indexer  
from opensearchpy import OpenSearch

#Entry point for the aplication cli
def main(argc, argv):

    # Connect to OpenSearch with SSL and authentication
    client = OpenSearch(
    hosts=[{'host': 'localhost', 'port': 9200}],
    http_auth=('admin', 'ComplexPassword123!'),
    use_ssl=True,
    verify_certs=False,  # Necessary for local self-signed certs
    ssl_show_warn=False
    )   

    print(f"Number of arguments: {argc}")
    print(f"Arguments: {argv}")

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
    if command == "index":
        file = argv[2] if argc > 2 else None
        if not file:
            print("Please provide a file to index. Usage: python main.py index <file>")
            return 0
        print(f"Indexing file: {file}")
    else:
        print(f"Unknown command: {command}. Use 'help' for available commands.")
        return -1

    print("Command executed successfully - none left to do.")
    return 0
if __name__ == "__main__":
    main(len(sys.argv), sys.argv)