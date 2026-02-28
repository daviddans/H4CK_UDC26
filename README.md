# 🧙‍♂️ GandalFS

> **G**reat **A**nother **N**on-trivial **D**ynamic **A**mazing **L**ayered **F**ile **S**earcher

**GandalFS** no es solo un buscador; es el guardián de la sabiduría de tu empresa. Es un sistema RAG (Retrieval-Augmented Generation) de alto rendimiento diseñado para indexar, buscar y comprender archivos corporativos (PDF, XLSX, CSV, TXT) mediante una arquitectura híbrida que combina lo mejor de la búsqueda clásica y la inteligencia artificial semántica.

## 🚀 Características Principales

* **Búsqueda Híbrida de 3 Vías (RRF):** No nos la jugamos a una sola carta. Implementamos *Reciprocal Rank Fusion* (RRF) combinando:
1. **Match Simple:** Búsqueda por palabras clave.
2. **Frase Exacta:** Para encontrar términos técnicos o nombres específicos.
3. **K-NN Semántico:** Entendimiento contextual mediante embeddings.


* **Procesamiento Inteligente de Documentos:** Limpieza automática de ruido en PDFs (headers, footers y artefactos de OCR) para que la IA solo lea contenido relevante.
* **IA "On-Premise" con Ollama:** Consultas inteligentes sobre tus documentos sin que los datos salgan de tu infraestructura, garantizando la privacidad empresarial.
* **Arquitectura Modular y Extensible:** Diseñado bajo el principio de responsabilidad única. Añadir un nuevo tipo de archivo o un nuevo modelo de lenguaje es tan fácil como añadir un módulo.
* **Separación Clara Front/Back:** API robusta construida con FastAPI, lista para ser consumida por cualquier interfaz moderna.

## 🛠️ Stack Tecnológico

| Componente | Tecnología |
| --- | --- |
| **Motor de Búsqueda** | **OpenSearch** (con soporte k-NN y Faiss) |
| **Orquestador AI** | **Ollama** (Modelo Qwen 2.5 7B) |
| **Embeddings** | **Sentence-Transformers** (Multilingual E5 Small) |
| **Backend API** | **FastAPI** |
| **Procesamiento de Texto** | **PyMuPDF (fitz)**, **PyPDF2**, **Pytesseract (OCR)** |
| **Lógica de Datos** | **Pandas**, **Openpyxl** |

---

## 🏗️ Arquitectura del Sistema

Nuestro proyecto no esta pensado como una arquitectura monolitica. Sino como una plataforma expansible, buscando dotar al usuario final de flexibilidad y control de la aplicación, y la posibilidad de añadir nuevos modulos facilmente para expandir la compatibilidad con nuevos tipos de archivos, añadir campos personalizados al buscador. Permitiendo así que se adapte nuestra plataforma a multiples entornos.
---

## 🔧 Instalación Manual y Configuración

### Dependencias

* Docker (para OpenSearch)
* Ollama (con el modelo `qwen2.5:7b-instruct` y `intfloat/multilingual-e5-small`)
* Python 3.10+
* Teseract

### Paso a paso

1. **Levantar el motor de búsqueda:**
```bash
# Ejemplo rápido con Docker
docker run -p 9200:9200 -p 9600:9600 -e "discovery.type=single-node" opensearchproject/opensearch:latest

```

2. **Instalar dependencias:**
```bash
pip install -r requirements.txt

```

3. **Inicializar el sistema:**
```bash
python main.py init

```

---

## 🛡️ Técnicas de Optimización de RI (Retrieval Information)

Para destacar en esta hackaton, hemos implementado:

* **Normalización Min-Max:** Para homogeneizar las puntuaciones de diferentes métodos de búsqueda.
* **Chunking Robusto:** Si el texto es continuo, segmentamos por frases; si viene "roto" (mal OCR), hacemos fallback a palabras.
* **Prefijos de Modelo E5:** Segmentacion de archivos con solapamiento, para mejorar la precisión de las queries y hacer localizaciones precisas de segmentos.

---

## 🧙‍♂️ Uso de la CLI

GandalFS permite interactuar directamente desde la terminal para tareas de administración:

* **Indexar un documento:** `python main.py index ruta/al/archivo.pdf`
* **Búsqueda técnica:** `python main.py search "presupuesto marketing 2025"`
* **Preguntar a la IA:** `python main.py ask_ai "¿Cual es el total del presupuesto?"`

---

> *"Un buscador no llega tarde, ni pronto, llega exactamente cuando se le necesita."*

## INSTALACION CON DOCKER

Para una instalación rapida, sencilla, sin problemas, y adaptada a las necesidades de los entornos modermos, proveemos una instalacion completa embedida en un contenedor de docker. 