from opensearchpy import OpenSearch, helpers
import sys

class PdfDoc(Document):
    
    def __init__(index_name):
        self.index_name = index_name

    authorName = Keyword()
    content = Text()

    class Index:
        name = self.index_name

    def save(self, *args, **kwargs):
        return super(PdfDoc, self).save(*args, **kwargs)


def index_document(client, index_name, document):
    """Indexes a single document."""
    response = client.index(index=index_name, body=document)
    print(f"Indexed document ID: {response['_id']}")