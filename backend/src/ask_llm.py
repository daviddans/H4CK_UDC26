from typing import Dict, Any, List

def ask_llm_mock(question: str, chunks: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not chunks:
        return {"answer": "No consta en los fragmentos proporcionados.", "sources": []}

    # mock: devuelve el primer chunk como evidencia
    return {
        "answer": f"Según los fragmentos, lo más relevante es: {chunks[0]['text'][:220]}... [1]",
        "sources": ["[1]"]
    }