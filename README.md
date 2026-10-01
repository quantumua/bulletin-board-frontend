# Bulletin Board – Frontend

Web UI for the bulletin board: add ads and edit existing ones.

**Stack:** React 19, TypeScript, Vite.

## Run

Requires Node.js 20.19+ and the [backend](../bulletin-board-backend) running on http://localhost:8080.

```bash
npm install
npm run dev
```

Open http://localhost:5173. In development, `/api` requests are proxied to the backend (see `vite.config.ts`).

## Build

```bash
npm run build
```

Output goes to `dist/`. If the API is served from a different origin, set `VITE_API_BASE_URL`
at build time (e.g. `VITE_API_BASE_URL=https://api.example.com npm run build`) and add that frontend origin
to the backend's `app.cors.allowed-origins`.

## Lint

```bash
npm run lint
```
