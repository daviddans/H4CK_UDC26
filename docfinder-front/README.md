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

- `POST /search` (o `POST /search `):
  - payload: `{ "querry": "texto" }` (también soporta `query` y `q`)
- `GET /add-index?path=/ruta/al/fichero`
- `POST /add-index` con `{ "path": "/ruta" }` o `{ "file": { "path": "/ruta" } }`

## Estado actual

- `search`: conectado a backend real (sin fallback mock).
- `upload`: guarda archivo localmente y luego indexa en backend.
- `ask`: devuelve error `501` porque backend no expone `/ask`.
- `document detail`: usa resultados cacheados de búsqueda backend.
