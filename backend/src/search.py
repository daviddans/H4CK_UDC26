from opensearchpy import OpenSearch, helpers
import sys
from opensearch_dsl import Document, Text, Keyword, document, Search

def search(client, index_name, query):
    """Searches the index for the given query."""
    s = Search(using=client, index=index_name) \
        .query('match', content=query)
    response = s.execute()
    for hit in response:
        print(hit.meta.score, hit.content)