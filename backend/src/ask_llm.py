import re
import requests
from typing import Dict, Any, List

from config import OLLAMA_URL, OLLAMA_MODEL
from prompt import SYSTEM, build_user_prompt

CIT_RE = re.compile(r"\[(\d+)\]")

def _parse_citations(text: str, max_n: int) -> List[int]:
    # extrae [1], [2]... y los devuelve como ints únicos en orden
    seen = set()
    out = []
    for m in CIT_RE.finditer(text):
        n = int(m.group(1))
        if 1 <= n <= max_n and n not in seen:
            seen.add(n)
            out.append(n)
    return out

def ask_llm_ollama(question: str, chunks: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Devuelve:
      - answer: str
      - cited_numbers: [int]  (referencias [n])
    """
    user_prompt = build_user_prompt(question, chunks)
    full_prompt = f"{SYSTEM}\n\n{user_prompt}"

    payload = {
        "model": OLLAMA_MODEL,
        "prompt": full_prompt,
        "stream": False,
        "options": {
            "temperature": 0.2,
            "num_predict": 280
        }
    }

    r = requests.post(OLLAMA_URL, json=payload, timeout=120)
    r.raise_for_status()
    data = r.json()
    raw = (data.get("response") or "").strip()

    cited_numbers = _parse_citations(raw, max_n=len(chunks))
    return {"answer": raw, "cited_numbers": cited_numbers}

def ask_llm_mock(question: str, chunks: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not chunks:
        return {"answer": "No consta en los fragmentos proporcionados.", "cited_numbers": []}
    return {"answer": f"Según los fragmentos, lo más relevante es: {chunks[0]['text'][:220]}... [1]", "cited_numbers": [1]}