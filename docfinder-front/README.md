# GandalFS Frontend

Frontend en Next.js para búsqueda y carga de documentos contra backend FastAPI.

## Ejecutar

```bash
npm install
npm run dev
```

App: `http://localhost:3000`

## Configuración backend

Crear `docfinder-front/.env.local`:

```bash
BACKEND_URL=http://127.0.0.1:8000
# opcional, ruta persistente para ficheros subidos antes de indexar
# por defecto: ../backend/data/uploads
BACKEND_UPLOAD_DIR=/home/fer/Documents/H4CK_UDC26/backend/data/uploads

uvicorn endpoint:app --reload --port 8000 
```

## Contratos usados

- `POST /init` para inicializar índice.
- `POST /index-file` con payload `{ "path": "/ruta/al/fichero" }`.
- `POST /search` con payload `{ "query": "texto" }`.
- `POST /ask` con payload `{ "query": "pregunta" }`.

Notas de compatibilidad en frontend:
- Upload mantiene fallback a `/add-index` (GET/POST) para entornos backend antiguos.
- Search mantiene fallback de keys `q`/`querry` por compatibilidad.

## Parámetros: backend vs frontend

- `search`:
  - Backend real: `query` (frontend mantiene compatibilidad con `q` y `querry`).
  - Frontend: `page`, `pageSize`, `filters`, `sort` se aplican en frontend sobre los hits recibidos.
- `upload`:
  - Backend real: `POST /index-file` con `path`.
  - Frontend: `doc_type`, `category`, `tags`, `lang` se guardan en un registro local para enriquecer resultados y filtros.
- `ask`:
  - Backend real: `POST /ask` con `query`.
  - Si existe backend `/ask_ai` o `/question`, frontend puede usarlo como fallback de compatibilidad.
  - Si no existe, frontend usa `/search` para generar respuesta+fuentes (RAG ligero).
- `init`:
  - Backend real: sin parámetros (`POST /init`).

## Estado actual

- `search`: conectado a backend real (sin fallback mock).
- `upload`: guarda archivo localmente y luego indexa en backend (`/add-index`).
- `init`: botón en Upload modal que ejecuta `/init` para preparar índice/pipeline.
- `ask`: intenta `/ask` o `/ask_ai`; si no existen, usa retrieval desde `/search` para responder con citas.
- `document detail`: usa resultados cacheados de búsqueda backend.
- `open/download`: para docs subidos desde la app, detalle expone `/api/files/[docId]` con preview (`inline`) y descarga (`attachment`).
