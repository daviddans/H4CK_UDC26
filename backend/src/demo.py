import os

from config import DATA_PATH, EMBEDS_PATH, META_PATH
from embedding_cache import build_embedding_cache
from semantic_search import semantic_search
from embeddings import get_model
from ask_llm import ask_llm_mock

def ensure_cache():
    if os.path.exists(EMBEDS_PATH) and os.path.exists(META_PATH):
        print("[OK] Using cached embeddings:", EMBEDS_PATH)
        return
    build_embedding_cache(DATA_PATH)

def main():
    ensure_cache()

    # --- SEARCH (sin LLM) ---
    q = "plazo de deliver"
    hits = semantic_search(q, top_k=5)
    hits = [h for h in hits if h["score"] >= 0.82]

    print("\n=== SEARCH RESULTS ===")
    for h in hits:
        print(f"- score={h['score']:.4f} {h['title']} (p{h['page_start']}) [{h['chunk_id']}]")
        print(f"  {h['text'][:160]}...\n")

    # --- ASK (mock LLM de momento) ---
    question = "¿Qué penalización se aplica si hay retraso en la entrega?"
    context_chunks = semantic_search(question, top_k=10)

    # Recorta a 8 chunks (luego meteremos diversidad por doc si quieres)
    context_chunks = context_chunks[:8]

    ans = ask_llm_mock(question, context_chunks)
    print("\n=== ASK ANSWER (MOCK LLM) ===")
    print(ans)

if __name__ == "__main__":
    main()
    get_model()