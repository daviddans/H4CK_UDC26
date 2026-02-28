from opensearchpy import OpenSearch, helpers
import sys



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

def index_document(client,index_name, document):
    """Indexes a single document."""
    response = client.index(index=index_name, body=document)
    print(f"Indexed document ID: {response['_id']}")