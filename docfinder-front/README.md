# DocFinder Frontend

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
# opcional, para persistir ficheros subidos antes de indexar
BACKEND_UPLOAD_DIR=/tmp/docfinder_uploads
```

## Contratos usados

- `GET /init` (vía `POST /api/init` en frontend) para inicializar índice/pipeline.
- `POST /search` (o `POST /search `):
  - payload: `{ "querry": "texto" }` (también soporta `query` y `q`)
- `GET /add-index?path=/ruta/al/fichero`
- `POST /add-index` con `{ "path": "/ruta" }` o `{ "file": { "path": "/ruta" } }`

## Parámetros: backend vs frontend

- `search`:
  - Backend real: `querry` (también `query` y `q` por compatibilidad).
  - Frontend: `page`, `pageSize`, `filters`, `sort` se aplican en frontend sobre los hits recibidos.
- `upload`:
  - Backend real: solo necesita la `path` del fichero para indexar.
  - Frontend: `doc_type`, `category`, `tags`, `lang` se guardan en un registro local para enriquecer resultados y filtros.
- `ask`:
  - Si existe backend `/ask` o `/ask_ai`, se usa directamente.
  - Si no existe, frontend usa `/search` para generar respuesta+fuentes (RAG ligero).
- `init`:
  - Backend real: sin parámetros (`GET /init`).

## Estado actual

- `search`: conectado a backend real (sin fallback mock).
- `upload`: guarda archivo localmente y luego indexa en backend (`/add-index`).
- `init`: botón en Upload modal que ejecuta `/init` para preparar índice/pipeline.
- `ask`: intenta `/ask` o `/ask_ai`; si no existen, usa retrieval desde `/search` para responder con citas.
- `document detail`: usa resultados cacheados de búsqueda backend.
- `open/download`: para docs subidos desde la app, detalle expone `/api/files/[docId]` con preview (`inline`) y descarga (`attachment`).
