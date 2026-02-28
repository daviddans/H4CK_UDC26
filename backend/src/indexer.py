from opensearchpy import OpenSearch, helpers
import sys
from opensearch_dsl import Document, Text, Keyword, document
from readpdf import limpiar_pdf


class PdfDoc(Document):
    content = Text()
    
    def save(self, *args, **kwargs):
        return super(PdfDoc, self).save(*args, **kwargs)


def index_document(client, index_name, path):
    content = limpiar_pdf(path)

    PdfDoc.init(using=client, index=index_name)
    documento = PdfDoc(content=content)
    documento.save()
