import os

import ollama


class OllamaManager:
    def __init__(self, model="qwen2.5:7b-instruct"):
        self.model = model
        self.num_predict = int(os.getenv("OLLAMA_NUM_PREDICT", "360"))
        self.num_ctx = int(os.getenv("OLLAMA_NUM_CTX", "8192"))
        self.temperature = float(os.getenv("OLLAMA_TEMPERATURE", "0.4"))
        self.keep_alive = self._normalize_keep_alive(
            os.getenv("OLLAMA_KEEP_ALIVE", "30m")
        )
        self.top_p = float(os.getenv("OLLAMA_TOP_P", "0.8"))
        self.top_k = int(os.getenv("OLLAMA_TOP_K", "50"))
        self.num_batch = int(os.getenv("OLLAMA_NUM_BATCH", "128"))

    @staticmethod
    def _normalize_keep_alive(value: str) -> str:
        normalized = (value or "").strip().lower()
        if not normalized:
            return "30m"
        # Ollama expects duration with units (e.g. 30s, 5m, 1h).
        if normalized.isdigit():
            return f"{normalized}m"
        return normalized

    def generate_answer(self, query, context_chunks):
        # Keep prompt compact for lower latency.
        context = "Eres un asistente especifico de conocimiento. (Embedido en el software de busqueda de ficheros empresarial GandalFS)\n"
        context += " Responde las preguntas del usuario con el conocimiento disponible:\n\n"
        context += "Documentos relevantes recuperados:\n"
        for chunk in context_chunks:
            name = chunk.get("chunk_data", {}).get("source", "Desconocido")
            id = chunk.get("chunk_data", {}).get("chunk_id", "Desconocido")
            title = chunk.get("metadata", {}).get("title", "Desconocido")
            date = chunk.get("metadata", {}).get("creation_date", "Desconocido")
            lang = chunk.get("metadata", {}).get("lang", "Desconocido")
            tags = chunk.get("metadata", {}).get("tags", [])
            content = chunk.get("content", "")
            context += f"+Archivo: {name} | Chunk ID: {id} | Título: {title} | Fecha: {date} | Idioma: {lang} | Tags: {tags} | \n +Contenido del fragmento: {content}. \n\n\n\n"
        context += f"-Consulta del usuario: {query}\n\n -Procede a responder a la consulta del usuario utilizando el conocimiento disponible."
        context += "Referencia los docuentos relevantes en tu respuesta, indicando claramente a qué documento te refieres. Si no tienes suficiente información para responder a la consulta, indícalo claramente."
        context += " Responde de manera clara y concisa, evitando redundancias y respondiendo con un tono similar al de la pregunta.."
        try:
            response = ollama.generate(
                model=self.model,
                prompt=context,
                options={
                    "num_predict": self.num_predict,
                    "num_ctx": self.num_ctx,
                    "temperature": self.temperature,
                },
                keep_alive=self.keep_alive,
            )
            return response.get("response", "")
        except Exception as error:
            raise RuntimeError(f"Ollama generate failed: {error}") from error
