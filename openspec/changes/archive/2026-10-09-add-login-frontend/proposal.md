# Proposal

## Why

The backend is adding cookie-session login, CSRF protection and ad ownership (store change `add-login` in `team-plans`). Without frontend work, every create and edit request would be rejected (`401`/`403`), and users would have no way to register, log in, or see which ads they own. This change is the frontend half of that contract.

## What Changes

- Add register and login forms, a logout control, and a "signed in as" indicator.
- Load the current user from `GET /api/auth/me` on startup; treat `401` as anonymous, not as an error.
- Send `credentials: "include"` on every API request so the session cookie is used.
- Echo the `XSRF-TOKEN` cookie in an `X-XSRF-TOKEN` header on every `POST`/`PUT` to `/api/**` (login and register are exempt).
- Show the "New ad" form only to logged-in users, with a prompt to log in otherwise.
- Show "Edit" only on ads whose `author` equals the current username; ownerless ads (`author: null`) are never editable.
- Show the ad `author` on each card.
- Surface `401`/`403`/`409`/`400` problem details from the API as user-facing messages; on a `401` from a write, return the UI to the anonymous state.
- Configure the dev setup so cookies work through the Vite proxy (same-origin from the browser's view).

No spec changes in this repo: behavior is defined by the store's `user-auth` and `ads-api` deltas (`skip_specs: true`).

## Capabilities

### New Capabilities
<!-- None: this repo only implements the contract owned by the team-plans store. -->

### Modified Capabilities
<!-- None locally. Implements `user-auth` (new) and `ads-api` (modified: authentication for writes, ownership, `author` field, credentialed CORS) from store change `add-login`. -->

## Impact

- Code: `src/api.ts` (credentialed requests, CSRF header, auth endpoints, `author` on `Ad`), `src/App.tsx` (auth state, conditional controls), new auth form component(s), `src/index.css`, possibly `vite.config.ts`.
- Dependencies: none required; there is no test runner yet, so tests (if planned) need a test setup task first.
- Depends on the backend change `add-login-backend`; integration is verified in store task group 3.
- Store change `add-login` has an empty `proposal.md`, so the motivation above is derived from its design and specs.
