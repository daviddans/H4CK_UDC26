import ollama

class OllamaManager:
    def __init__(self, model="qwen2.5:7b-instruct"):
        self.model = model

    def generate_answer(self, query, context_chunks):
        # Combine the retrieved chunks into one context block
        context = "\n\n---\n\n".join(context_chunks)
        
        prompt = f"""
        Eres un asistente experto. Responde a la pregunta del usuario basándote únicamente en el contexto proporcionado.
        Si la información no está en el contexto, di que no lo sabes.

        CONTEXTO:
        {context}

        PREGUNTA:
        {query}

        RESPUESTA:
        """

        response = ollama.generate(model=self.model, prompt=prompt)
        return response['response']