from opensearchpy import OpenSearch, helpers
import sys


def index_document(client, index_name, document):
    """Indexes a single document."""
    response = client.index(index=index_name, body=document)
    print(f"Indexed document ID: {response['_id']}")