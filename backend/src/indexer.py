from opensearchpy import OpenSearch, helpers
import sys

# 1. Connection Setup
# Note: Using 'admin' password from our Docker Compose
client = OpenSearch(
    hosts=[{'host': 'localhost', 'port': 9200}],
    http_auth=('admin', 'ComplexPassword123!'),
    use_ssl=True,
    verify_certs=False,  # Necessary for local self-signed certs
    ssl_show_warn=False
)

def create_index(index_name):
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

def bulk_ingest(index_name):
    """Uses a generator to yield data for the Bulk API."""
    
    # Sample dataset
    data = [
        {"title": "OpenSearch on Arch Linux", "tags": ["linux", "search"], "view_count": 150},
        {"title": "Python Client Basics", "tags": ["python", "coding"], "view_count": 85},
        {"title": "Docker for Developers", "tags": ["docker", "devops"], "view_count": 320},
    ]

    def generate_actions():
        for doc in data:
            yield {
                "_index": index_name,
                "_source": doc
            }

    # helpers.bulk handles the batching and error checking for you
    success, failed = helpers.bulk(client, generate_actions())
    print(f"Successfully indexed {success} documents. Failures: {len(failed) if isinstance(failed, list) else failed}")

if __name__ == "__main__":
    MY_INDEX = "tutorial-index"
    try:
        create_index(MY_INDEX)
        bulk_ingest(MY_INDEX)
        
        # Verify with a quick count
        client.indices.refresh(index=MY_INDEX)
        count = client.count(index=MY_INDEX)['count']
        print(f"Total documents in {MY_INDEX}: {count}")
        
    except Exception as e:
        print(f"Error: {e}")