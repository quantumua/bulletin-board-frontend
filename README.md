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

## Login

Reading ads is open to everyone. Creating and editing ads needs an account: register, then log in (registering does
not log you in). The session lives in an `HttpOnly` cookie set by the backend, and every request is sent with
`credentials: "include"`. State-changing requests echo the readable `XSRF-TOKEN` cookie in an `X-XSRF-TOKEN` header
(`src/api.ts`). Only the author of an ad sees its Edit button; ads without an author are read-only.

## Test

```bash
npm test
```

Runs the Vitest unit tests (API client, auth state, edit-visibility rule) with `fetch` stubbed, so no backend is needed.

## Lint

```bash
npm run lint
```

## Shared API contract

The API contract is specified in the [bulletin-board-plans](https://github.com/quantumua/bulletin-board-plans)
OpenSpec store (register it as `team-plans`, see its README). Contract changes are planned there; this repo plans
its own part in a local change named `<store-change>-<repo>`, for example `add-login-frontend`.

```bash
openspec show <store-change> --store team-plans   # read the contract change and its spec deltas
```

Cross-origin note: with `VITE_API_BASE_URL` set (instead of the dev proxy), cookie-based login also needs the
backend's `app.cors.allowed-origins` to include this frontend's origin, and requests sent with `credentials: "include"`.
