from opensearchpy import OpenSearch, helpers
import sys
from opensearch_dsl import Document, Text, Keyword


class PdfDoc(Document):
    authorName = Keyword()
    content = Text()

    def save(self, *args, **kwargs):
        return super(PdfDoc, self).save(*args, **kwargs)


def index_document(client, index_name, document):
    """Indexes a single document."""
    response = client.index(index=index_name, body=document)
    print(f"Indexed document ID: {response['_id']}")
