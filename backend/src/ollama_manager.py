from ctypes.wintypes import tagSIZE
import os

import ollama


class OllamaManager:
    def __init__(self, model="qwen2.5:7b-instruct"):
        self.model = model
        self.num_predict = int(os.getenv("OLLAMA_NUM_PREDICT", "240"))
        self.num_ctx = int(os.getenv("OLLAMA_NUM_CTX", "4096"))
        self.temperature = float(os.getenv("OLLAMA_TEMPERATURE", "0.4"))
        self.keep_alive = os.getenv("OLLAMA_KEEP_ALIVE", "30")
        self.top_p = float(os.getenv("OLLAMA_TOP_P", "0.8"))
        self.top_k = int(os.getenv("OLLAMA_TOP_K", "50"))
        self.num_batch = int(os.getenv("OLLAMA_NUM_BATCH", "128"))
    def generate_answer(self, query, context_chunks):
        # Keep prompt compact for lower latency.
        context = "Eres un asistente especifico de conocimiento. (Embedido en el software de busqueda de ficheros empresarial GandalFS)\n"
        context += " Responde las preguntas del usuario con el conocimiento disponible:\n\n"
        context += "-BASE DE CONOCIMIENTO (indice invertido):\n\n"
        context += "Documentos relevantes recuperados:\n"
        for chunk in context_chunks:
            name = chunk['chunk_data:source']
            chunk = chunk['chunk_data:chunk_id']
            title = chunk['metadata:title']
            date = chunk['metadata:creation_date']
            lang = chunk['metadata:lang']
            tags = chunk['metadata:tags']
            content = chunk['content']
            context += f"Archivo: {name}, Chunk ID: {chunk}, Título: {title}, Fecha: {date}, Idioma: {lang}, Tags: {tags}\nContenido: {content}. \n\n\n\n"
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
