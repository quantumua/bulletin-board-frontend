# Bulletin Board – Frontend

Web UI for the bulletin board: sign up, log in and out, browse ads, post ads and edit your own.

**Stack:** React 19, TypeScript, Vite. Tests: Vitest with React Testing Library.

## Run

Requires Node.js 20.19+ and the [backend](../bulletin-board-backend) running on http://localhost:8080.
The frontend uses the backend's `/api/v1` API (`/api/v1/auth/*` and `/api/v1/ads`), so it needs a
backend version that provides it.

```bash
npm install
npm run dev
```

Open http://localhost:5173. In development, `/api` requests are proxied to the backend (see `vite.config.ts`),
so the page and the API share one origin.

## Logging in

- Anyone can browse ads and see who posted each one.
- **Sign up** (email, display name, password of at least 8 characters) creates an account and logs you in.
- **Log in** with your email and password. After 5 wrong passwords in a row the account is locked for 15 minutes.
- When logged in, the bar at the top shows "Signed in as …" with a **Log out** button. Only logged-in users see the
  **New ad** form, and **Edit** appears only on your own ads. The backend enforces the same rules.
- A login lasts until you log out or close the browser; reloading the page keeps you logged in.
- If your session ends (for example you logged out in another tab), your next save is refused, the log-in panel
  opens, and the text you typed stays in the form.

The session cookie is `HttpOnly` and never touched by the frontend. Every `POST`/`PUT` sends the `XSRF-TOKEN`
cookie value in the `X-XSRF-TOKEN` header; the token is issued by `GET /api/v1/auth/me` on page load. Nothing about
the user is stored in `localStorage` or `sessionStorage`.

## Build

```bash
npm run build
```

Output goes to `dist/`. Serve it from the **same origin** as the API (for example behind one reverse proxy that
routes `/api` to the backend). `VITE_API_BASE_URL` may be set at build time, but it must point to that same origin:
the session and anti-forgery cookies only work same-origin, so a cross-origin API is not supported in this version.

## Test

```bash
npm test
```

Runs the whole suite once (Vitest, jsdom). No backend is needed: `fetch` is mocked. To run single files from the
workspace root, pass the frontend as the Vitest root:

```bash
npm --prefix bulletin-board-frontend exec -- vitest run --root bulletin-board-frontend src/api.test.ts
```

## Lint

```bash
npm run lint
```
