from opensearchpy import OpenSearch, client


# Create an index with specific settings and mappings
def create_index(client, index_name):
    """Creates an index with specific settings if it doesn't exist."""
    index_body = {
      'settings': {
        'index': {
          'number_of_shards': 4
        }
      }
    }
     
    if not client.indices.exists(index=index_name):
        client.indices.create(index=index_name, body=index_body)
        print(f"Created index: {index_name}")
        return 0
    else:
        print(f"Index '{index_name}' already exists.")
        return -1
