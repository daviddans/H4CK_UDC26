import re

_SENT_SPLIT = re.compile(r"(?<=[\.\?\!])\s+")


def crear_chunks(texto: str, max_words: int = 260, overlap_words: int = 50):
    """
    Chunking robusto para textos continuos (PDF):
    1) Intenta segmentar en frases.
    2) Si no, usa palabras.
    """
    if not texto:
        return []

    # limpieza mínima útil en PDF
    texto = re.sub(r"\s+", " ", texto).strip()
    texto = texto.replace(
        "- ", ""
    )  # opcional: arreglar cortes con guion (depende del extractor)

    # 1) Intento por frases
    sentences = _SENT_SPLIT.split(texto)
    sentences = [s.strip() for s in sentences if s.strip()]

    # Si hay pocas frases, el texto viene “raro” => fallback a palabras
    if len(sentences) < 5:
        return _chunks_por_palabras(
            texto, max_words=max_words, overlap_words=overlap_words
        )

    chunks = []
    current = []
    current_words = 0

    def flush():
        nonlocal current, current_words
        if current:
            chunks.append(" ".join(current).strip())
            current = []
            current_words = 0

    for s in sentences:
        w = s.split()
        if not w:
            continue
        if current_words + len(w) <= max_words:
            current.append(s)
            current_words += len(w)
        else:
            flush()
            # si una frase ya es enorme, la partimos por palabras
            if len(w) > max_words:
                sub = _chunks_por_palabras(
                    s, max_words=max_words, overlap_words=overlap_words
                )
                chunks.extend(sub)
            else:
                current.append(s)
                current_words = len(w)

    flush()

    # overlap a nivel palabras (añadimos cola del chunk previo al siguiente)
    if overlap_words > 0 and len(chunks) > 1:
        chunks_ov = []
        prev_tail = []
        for c in chunks:
            words = c.split()
            if prev_tail:
                words = prev_tail + words
            chunks_ov.append(" ".join(words))
            prev_tail = words[-overlap_words:] if len(words) >= overlap_words else words
        chunks = chunks_ov

    return chunks


def _chunks_por_palabras(texto: str, max_words: int, overlap_words: int):
    palabras = texto.split()
    if not palabras:
        return []
    chunks = []
    step = max(1, max_words - overlap_words)
    for i in range(0, len(palabras), step):
        chunk = " ".join(palabras[i : i + max_words]).strip()
        if chunk:
            chunks.append(chunk)
        if i + max_words >= len(palabras):
            break
    return chunks

