from opensearchpy import OpenSearch

# Connect to OpenSearch with SSL and authentication
client = OpenSearch(
    hosts=[{'host': 'localhost', 'port': 9200}],
    http_auth=('admin', 'ComplexPassword123!'),
    use_ssl=True,
    verify_certs=False,  # Necessary for local self-signed certs
    ssl_show_warn=False
)

#Create an index with specific settings and mappings
def create_index(client, index_name):
    """Creates an index with specific settings if it doesn't exist."""
    settings = {
        "settings": {"index": {"number_of_shards": 1, "number_of_replicas": 0}},
        "mappings": {
            "properties": {
                "title": {"type": "text"},
                "tags": {"type": "keyword"},
                "view_count": {"type": "integer"}
            }
        }
    }
    if not client.indices.exists(index=index_name):
        client.indices.create(index=index_name, body=settings)
        print(f"Created index: {index_name}")
        return 0
    else:
        print(f"Index '{index_name}' already exists.")
        return -1
