# DocFinder Frontend

Next.js 14 + React + TypeScript + Tailwind + shadcn-style components.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Backend integration

Set backend URL in `.env.local`:

```bash
BACKEND_URL=http://localhost:8000
```

Frontend integration currently available:
- `GET /api/search`: tries backend (`POST /search` and fallback `POST /search%20`) and normalizes to UI hits.
- `POST /api/ask`: tries backend `POST /ask` if exists; otherwise mock fallback.
- Upload remains simulated because current backend has no upload endpoint.

When backend fails, UI continues with mock data and displays warning badge/state.
