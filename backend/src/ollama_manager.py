from ctypes.wintypes import tagSIZE
import os

import ollama
from torch import chunk


class OllamaManager:
    def __init__(self, model="qwen2.5:7b-instruct"):
        self.model = model
        self.num_predict = int(os.getenv("OLLAMA_NUM_PREDICT", "360"))
        self.num_ctx = int(os.getenv("OLLAMA_NUM_CTX", "2048"))
        self.temperature = float(os.getenv("OLLAMA_TEMPERATURE", "0.4"))
        self.keep_alive = os.getenv("OLLAMA_KEEP_ALIVE", "5m")
        self.top_p = float(os.getenv("OLLAMA_TOP_P", "0.8"))
        self.top_k = int(os.getenv("OLLAMA_TOP_K", "50"))
        self.num_batch = int(os.getenv("OLLAMA_NUM_BATCH", "512"))

    def generate_answer(self, query, context_chunks):
        # Keep prompt compact for lower latency.
        context = "Eres un asistente especifico de conocimiento. (Embedido en el software de busqueda de ficheros empresarial GandalFS)\n"
        context += " Responde las preguntas del usuario con el conocimiento disponible:\n\n"
        context += "Documentos relevantes recuperados:\n"
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
        context += f"-Consulta del usuario: {query}\n\n -Procede a responder a la consulta del usuario utilizando el conocimiento disponible."
        context += "Referencia los docuentos relevantes en tu respuesta, indicando claramente a qué documento te refieres. Si no tienes suficiente información para responder a la consulta, indícalo claramente."
        context += " Responde de manera clara y concisa, evitando redundancias y respondiendo con un tono similar al de la pregunta.."
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
