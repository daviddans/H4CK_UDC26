import os

from config import DATA_PATH, EMBEDS_PATH, META_PATH
from embedding_cache import build_embedding_cache
from semantic_search import semantic_search
from select_context import select_context
from ask_llm import ask_llm_ollama  
# from ask_llm import ask_llm_mock 

def ensure_cache():
    if os.path.exists(EMBEDS_PATH) and os.path.exists(META_PATH):
        print("[OK] Using cached embeddings:", EMBEDS_PATH)
        return
    build_embedding_cache(DATA_PATH)

def main():
    ensure_cache()

    # --- SEARCH (sin LLM) ---
    q = "Presupuesto total"
    hits = semantic_search(q, top_k=8)

    print("\n=== SEARCH RESULTS ===")
    for h in hits:
        print(f"- score={h['score']:.4f} {h['title']} (p{h['page_start']}) [{h['chunk_id']}]")
        print(f"  {h['text'][:160]}...\n")

    # --- ASK (con LLM real) ---
    question = "Presupuesto total"
    hits_for_ask = semantic_search(question, top_k=20)

    # Selección de contexto: 10 chunks, máx 2 por doc, umbral opcional
    context_chunks = select_context(hits_for_ask, max_chunks=10, max_per_doc=2, min_score=0.78)

    res = ask_llm_ollama(question, context_chunks)

    # Construir citas con metadatos (doc/página)
    citations = []
    for n in res["cited_numbers"]:
        c = context_chunks[n - 1]  # porque [1] refiere al primer chunk del contexto
        citations.append({
            "n": n,
            "doc_id": c["doc_id"],
            "chunk_id": c["chunk_id"],
            "page_start": c["page_start"],
            "page_end": c["page_end"],
            "title": c["title"],
            "snippet": c["text"][:220]
        })

    print("\n=== ASK ANSWER (LLM) ===")
    print(res["answer"])
    print("\n=== CITATIONS ===")
    for c in citations:
        print(f"[{c['n']}] {c['title']} pág {c['page_start']}-{c['page_end']} ({c['chunk_id']})")
        print(f"    {c['snippet']}...\n")

if __name__ == "__main__":
    main()