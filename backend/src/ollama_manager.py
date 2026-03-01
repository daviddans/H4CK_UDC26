import os
import ollama

class OllamaManager:
    def __init__(self, model="qwen2.5:7b-instruct"):
        self.model = model
        self.num_predict = int(os.getenv("OLLAMA_NUM_PREDICT", "360"))
        self.num_ctx = int(os.getenv("OLLAMA_NUM_CTX", "1024"))
        self.temperature = float(os.getenv("OLLAMA_TEMPERATURE", "0.6"))
        self.keep_alive = os.getenv("OLLAMA_KEEP_ALIVE", "5m")
        self.top_p = float(os.getenv("OLLAMA_TOP_P", "0.8"))
        self.top_k = int(os.getenv("OLLAMA_TOP_K", "50"))
        self.num_batch = int(os.getenv("OLLAMA_NUM_BATCH", "256"))

    def generate_answer(self, query, context_chunks):
        # Keep prompt compact for lower latency.
        context = "Eres un asistente especifico de conocimiento. Tu objetivo es ayudar al usuario con información basada en documentos disponibles.\n"
        context += "Responde las preguntas del usuario con el conocimiento disponible. Siempre y cuando las entradas recuperadas parezcan de buena calidad y tengan relacion con la pregunta del usuario:\n\n"
        context += "Por defecto los campos mas importante son titulo y contenido, pero puedes usar el resto de campos para enriquecer tu respuesta. Sobretodo si es de interes para el usuario.\n\n"
        context += f"-Documentos relevantes recuperados\n"
        for chunk in context_chunks:
            if 'metadata' in chunk and 'content' in chunk:
                metadata = chunk['metadata']  # Accedemos al diccionario 'metadata'
                content = chunk['content']    # Accedemos al contenido
                # Accedemos a las claves dentro del diccionario 'metadata' de forma segura
                name = metadata['name'] if 'name' in metadata else "Desconocido"
                id = metadata['id'] if 'id' in metadata else "Desconocido"
                title = metadata['title'] if 'title' in metadata else "Desconocido"
                date = metadata['creation_date'] if 'creation_date' in metadata else "Desconocido"
                lang = metadata['lang'] if 'lang' in metadata else "Desconocido"
                tags = metadata['tags'] if 'tags' in metadata else []

            context += f"+Archivo: {name} | Chunk ID: {id} | Título: {title} | Fecha: {date} | Idioma: {lang} | Tags: {tags} | \n +Contenido del fragmento: {content}. \n\n\n\n"
        context += f"\n\n{query}\n\n -Procede a responder a la consulta del usuario utilizando el conocimiento disponible."
        context += "Referencia los docuentos relevantes en tu respuesta, indicando claramente a qué documento te refieres. Si no tienes suficiente información para responder a la consulta, indícalo claramente."
        context += " Responde de manera clara y concisa, evitando redundancias y respondiendo con un tono orgánico y humano, sin parecer un robot. No inventes información, responde solo con lo que sabes."
        context += " Si la consulta del usuario no tiene sentido o es ambigua, indícalo claramente y pide más información."
        context += " Por ultimo, si la consulta del usuario no tiene relación con los documentos disponibles, notificalo e ignora el contexto para responder la consulta."
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
