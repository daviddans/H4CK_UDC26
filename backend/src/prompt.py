from typing import List, Dict, Any

SYSTEM = (
    "Eres un asistente que responde usando SOLO el CONTEXTO proporcionado.\n"
    "Reglas:\n"
    "1) No inventes datos. Si el contexto no contiene la respuesta, di: 'No consta en los fragmentos proporcionados'.\n"
    "2) Cita siempre las fuentes usando [n] donde n es el número del fragmento.\n"
    "3) Si hay números/porcentajes/fechas, copia exactamente lo que aparece en el contexto.\n"
    "4) Responde en español de España.\n"
)

def build_context(chunks: List[Dict[str, Any]]) -> str:
    lines = []
    for i, c in enumerate(chunks, start=1):
        ref = f"[{i}] doc_id={c['doc_id']} chunk_id={c['chunk_id']} pág={c['page_start']}-{c['page_end']}"
        lines.append(ref + "\n" + c["text"])
    return "\n\n".join(lines)

def build_user_prompt(question: str, chunks: List[Dict[str, Any]]) -> str:
    context = build_context(chunks)
    return (
        f"CONTEXTO:\n{context}\n\n"
        f"PREGUNTA:\n{question}\n\n"
        "Devuelve:\n"
        "- Respuesta (2–8 líneas)\n"
        "- Fuentes: lista de referencias [n]\n"
    )