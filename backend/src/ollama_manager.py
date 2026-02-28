import os

import ollama


class OllamaManager:
    def __init__(self, model="qwen2.5:7b-instruct"):
        self.model = model
        self.num_predict = int(os.getenv("OLLAMA_NUM_PREDICT", "120"))
        self.num_ctx = int(os.getenv("OLLAMA_NUM_CTX", "2048"))
        self.temperature = float(os.getenv("OLLAMA_TEMPERATURE", "0.2"))
        self.keep_alive = os.getenv("OLLAMA_KEEP_ALIVE", "30m")

    def generate_answer(self, query, context_chunks):
        # Keep prompt compact for lower latency.
        compact_chunks = [chunk for chunk in context_chunks[:4] if chunk]
        context = "\n\n---\n\n".join(compact_chunks)

        prompt = f"""
        Eres un asistente experto. Responde de forma breve y directa
        basándote solo en el contexto. Si no está, di que no lo sabes.

        CONTEXTO:
        {context}

        PREGUNTA:
        {query}

        RESPUESTA:
        """

        response = ollama.generate(
            model=self.model,
            prompt=prompt,
            options={
                "num_predict": self.num_predict,
                "num_ctx": self.num_ctx,
                "temperature": self.temperature,
            },
            keep_alive=self.keep_alive,
        )
        return response.get("response", "")
