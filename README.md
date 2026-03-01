# 🧙‍♂️ GandalFS

> **G**reat **A**nother **N**on-trivial **D**ynamic **A**mazing **L**ayered **F**ile **S**earcher

**GandalFS** no es solo un buscador; es el guardián de la sabiduría de tu empresa. [cite_start]Es un sistema **RAG (Retrieval-Augmented Generation)** de alto rendimiento diseñado para indexar, buscar y comprender archivos corporativos (PDF, XLSX, CSV, TXT) mediante una arquitectura híbrida que combina lo mejor de la búsqueda clásica y la inteligencia artificial semántica[cite: 1, 2, 3].

---

## ✨ Funcionalidades Mágicas

* [cite_start]**Búsquedas de Élite**: Indexar y buscar archivos con gran velocidad y sencillez, logrando resultados precisos de forma inmediata[cite: 1, 2].
* [cite_start]**Interfaz Reactiva**: Visualizar tus documentos de forma atractiva, con una interfaz veloz que responde en tiempo real a tus interacciones[cite: 1, 2].
* [cite_start]**Gestión de Conocimiento**: Organizar tus documentos, filtrar resultados, crear tags personalizados y etiquetar tus archivos según las necesidades de tu entorno[cite: 1, 2].
* [cite_start]**Asistente de IA**: Un compañero que no solo potencia las búsquedas, sino que resuelve dudas sobre tus archivos y recomienda documentos similares para hacer tus datos más significativos[cite: 1, 2].

---

## 🏗️ Arquitectura: El Concilio de los Módulos

[cite_start]Nuestro proyecto no ha sido concebido como una arquitectura monolítica, sino como una **plataforma expansible y viva**[cite: 1, 2]. [cite_start]El objetivo es dotar al usuario final de flexibilidad y control absoluto sobre la aplicación[cite: 1, 2].

### 🧩 Flexibilidad y Extensibilidad (Addons)
[cite_start]GandalFS está diseñado bajo el principio de **responsabilidad única**[cite: 1, 2]. Esto permite una evolución constante del sistema:
* [cite_start]**Nuevos Formatos**: Añadir compatibilidad con nuevos tipos de archivos (como `.docx`, `.pptx` o `.html`) es tan fácil como integrar un nuevo módulo de procesamiento[cite: 1, 2].
* [cite_start]**Campos Personalizados**: La arquitectura permite añadir campos de metadatos personalizados al buscador para adaptarse a múltiples entornos empresariales[cite: 1, 2].
* [cite_start]**Modelos Intercambiables**: Gracias a la separación clara entre Front y Back (vía FastAPI), es sencillo sustituir o añadir nuevos modelos de lenguaje o motores de embedding[cite: 1, 2].

---

## 🚀 Características Principales

* [cite_start]**Búsqueda Híbrida de 3 Vías (RRF)**: Implementamos *Reciprocal Rank Fusion* (RRF) combinando[cite: 1, 2]:
    1.  **Match Simple**: Búsqueda por palabras clave tradicionales.
    2.  **Frase Exacta**: Para encontrar términos técnicos o nombres específicos.
    3.  **K-NN Semántico**: Entendimiento contextual profundo mediante embeddings.
* [cite_start]**Procesamiento Inteligente de Documentos**: Limpieza automática de ruido en PDFs (headers, footers y artefactos de OCR) para que la IA se centre solo en el contenido relevante[cite: 1, 2].
* [cite_start]**IA "On-Premise" con Ollama**: Consultas inteligentes sobre tus documentos sin que los datos salgan de tu infraestructura, garantizando la máxima privacidad empresarial[cite: 1, 2].
* **Optimización de RI (Retrieval Information)**:
    * [cite_start]**Normalización Min-Max**: Para homogeneizar las puntuaciones de diferentes métodos de búsqueda[cite: 1, 2].
    * [cite_start]**Chunking Robusto**: Segmentación por frases para texto continuo o fallback a palabras para documentos con OCR deficiente[cite: 1, 2].
    * [cite_start]**Prefijos de Modelo E5**: Segmentación con solapamiento (overlap) para localizaciones precisas de segmentos de información[cite: 1, 2].

---

## 🛠️ Stack Tecnológico

| Componente | Tecnología |
| :--- | :--- |
| **Motor de Búsqueda** | [cite_start]**OpenSearch** (con soporte k-NN y Faiss) [cite: 1, 2] |
| **Orquestador AI** | [cite_start]**Ollama** (Modelo Qwen 2.5 7B) [cite: 1, 2] |
| **Embeddings** | [cite_start]**Sentence-Transformers** (Multilingual E5 Small) [cite: 1, 2] |
| **Backend API** | [cite_start]**FastAPI** [cite: 1, 2] |
| **Procesamiento** | [cite_start]**PyMuPDF (fitz)**, **PyPDF2**, **Tesseract (OCR)** [cite: 1, 2] |
| **Lógica de Datos** | [cite_start]**Pandas**, **Openpyxl** [cite: 1, 2] |

---

## 🔧 Instalación y Configuración

### Requisitos
* [cite_start]**Docker** (para OpenSearch) [cite: 1, 2]
* [cite_start]**Ollama** (modelos `qwen2.5:7b-instruct` e `intfloat/multilingual-e5-small`) [cite: 1, 2]
* [cite_start]**Python 3.10+** [cite: 1, 2]
* [cite_start]**Tesseract OCR** [cite: 1, 2]

### Paso a paso
1.  **Levantar el motor de búsqueda**:
    ```bash
    docker run -p 9200:9200 -p 9600:9600 -e "discovery.type=single-node" opensearchproject/opensearch:latest
    ```
2.  **Instalar dependencias**:
    ```bash
    pip install -r requirements.txt
    ```
3.  **Inicializar el sistema**:
    ```bash
    python main.py init
    ```

---

## 🧙‍♂️ Uso de la CLI y GUI

GandalFS ofrece versatilidad total en su interacción:

### Interfaz de Comandos (CLI)
* [cite_start]**Iniciar el índice**: `python cli.py init` [cite: 1, 2]
* [cite_start]**Indexar un documento**: `python cli.py index` [cite: 1, 2]
* [cite_start]**Búsqueda técnica**: `python cli.py search` [cite: 1, 2]
* [cite_start]**Preguntar a la IA**: `python cli.py ask_ai` [cite: 1, 2]

### Interfaz Web (GUI)
[cite_start]La aplicación cuenta con una **interfaz web dedicada**, diseñada para ser el centro de operaciones donde gestionar tus archivos de forma visual y reactiva[cite: 1, 2].

---

## 🛡️ Licencia
[cite_start]Este proyecto es software libre, distribuido bajo la **GNU General Public License v3**[cite: 1, 2, 25]. Consulta el archivo `LICENSE` para más detalles.

---

> *"Un buscador no llega tarde, ni pronto, llega exactamente cuando se le necesita."*