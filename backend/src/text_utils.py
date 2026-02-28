import re

def crear_chunks(texto, tamano_chunk=500, solapamiento=50):
    """
    Divide el texto en fragmentos. 
    'tamano_chunk' es el número de palabras por fragmento.
    'solapamiento' repite palabras del final de un chunk en el inicio del siguiente.
    """
    if not texto:
        return []
        
    palabras = texto.split()
    chunks = []
    
    # Avanzamos por el texto saltando (tamaño - solapamiento)
    for i in range(0, len(palabras), tamano_chunk - solapamiento):
        chunk = " ".join(palabras[i:i + tamano_chunk])
        chunks.append(chunk)
        
        # Si ya llegamos al final, salimos
        if i + tamano_chunk >= len(palabras):
            break
            
    return chunks