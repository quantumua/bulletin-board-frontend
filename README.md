# Bulletin Board – Frontend

Web UI for the bulletin board: add ads and edit existing ones, and register / sign in with email and password.

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

## Sign-in

Sign-in uses the backend's HTTP-only session cookie; the app sends requests with `credentials: 'include'` and echoes
the `XSRF-TOKEN` cookie back as the `X-XSRF-TOKEN` header on non-GET requests (see `src/api.ts`). Nothing about the
session is stored in JavaScript, so reloading the page keeps you signed in until you sign out or the session expires.

In development the Vite proxy makes the API same-origin, so this works without extra setup. A cross-origin build
(`VITE_API_BASE_URL` pointing at another origin) must be served over HTTPS, the frontend origin must be listed exactly
in the backend's `app.cors.allowed-origins` (wildcards are not allowed with credentials), and the backend's session
cookie must be configured with `SameSite=None; Secure`; otherwise the browser will not send the session cookie.
The app also has to be able to read the `XSRF-TOKEN` cookie, which only works when both are on the same site and the
backend sets that cookie's domain to the shared parent (e.g. `app.example.com` and `api.example.com`).

## Test

```bash
npm test
```

Runs the Vitest + React Testing Library suite in jsdom; API calls are mocked, so the backend is not needed.

## Lint

```bash
npm run lint
```
