# Design

## Context

The SPA is a single `App` component with a `fetch` wrapper in `src/api.ts` that targets `/api/ads`. In development, Vite proxies `/api` to `localhost:8080`, so the browser sees one origin; with `VITE_API_BASE_URL` set it is cross-origin. See proposal.md for motivation.

Requirements live in the store change `add-login` (`team-plans`): `specs/user-auth`, and the `ads-api` deltas for write authentication, ownership, `author` and credentialed CORS. This repo only consumes them.

## Goals / Non-Goals

**Goals:**
- The UI reflects session state and never offers an action the API will reject (create when anonymous, edit on someone else's or ownerless ad).
- One place (`api.ts`) owns credentials and CSRF handling, so components cannot forget them.

**Non-Goals:**
- Password reset, roles, "remember me", delete-ad, client-side routing.
- Treating UI hiding as security; the backend remains the enforcer.
- Persisting the user in `localStorage`; the session cookie is the source of truth.

## Decisions

**Auth state in a small React context.** An `AuthProvider` holds `user: {id, username} | null` plus a `loading` flag, and exposes `login`, `register`, `logout`. On mount it calls `GET /api/auth/me`; `401` resolves to `user = null`. Alternative: prop-drilling from `App`, rejected because the form, header and ad cards all need it. No state library is added.

**Always `credentials: "include"` in the shared `request()` wrapper.** Works unchanged for the proxy and for `VITE_API_BASE_URL` cross-origin setups (the latter requires the backend's credentialed CORS).

**CSRF token read per request from `document.cookie`.** For `POST`/`PUT` (excluding `/api/auth/login` and `/api/auth/register`), read `XSRF-TOKEN` at call time and send it as `X-XSRF-TOKEN`; never cache it, because it can rotate on login/logout. Cookies are shared across ports on `localhost`, so this also works for the cross-origin dev setup. If the cookie is absent the header is omitted and the backend decides (`401` for anonymous per the store Clarifications).

**Keep `src/api.ts` as the single client.** Move the base URL to a shared constant and add `getMe`, `login`, `register`, `logout` beside the ad functions. `request()` handles `204` (logout) by not parsing a body, and throws an `ApiError` carrying `status` and the problem `detail` so callers can distinguish `401` from other failures. Alternative: a second client module, rejected as duplicated fetch logic.

**Ownership check by username comparison.** Show Edit when `ad.author !== null && ad.author === user?.username`. Usernames are immutable and unique ignoring case in the contract; the backend echoes the stored username, so compare exact strings.

**Session expiry handling.** If a write returns `401`, clear the auth user (back to anonymous) and show a "please log in again" message; `403` shows the problem detail unchanged.

**Registration does not log in.** The contract says register creates no session, so after a successful register the UI switches to the login form with the username prefilled and a success note. Alternative: auto-login with a second call, rejected as not required and doubling failure modes.

**Generic login failure message.** Show the API's problem detail as-is; the contract guarantees it does not reveal which credential was wrong, so the client must not add distinguishing text.

**Tests.** There is no runner. Add Vitest (Vite-native, no extra bundler config) with `fetch` stubbed, covering `api.ts` credentials/CSRF behavior and the edit-visibility rule. Component tests are limited to what pays for itself.

## Risks / Trade-offs

- [XSRF cookie may not exist right after login, if the backend sets it lazily] → Read at request time; if writes fail with `403` in integration, record the gap in the store design's Clarifications and (if needed) call `GET /api/auth/me` once after login to obtain it.
- [Cookie `SameSite=Lax` breaks if SPA and API end up on different sites in production] → Out of scope; documented in the store design.
- [UI hides controls but a stale `user` could show wrong controls after session expiry] → `401` on a write resets to anonymous.
- [Existing ads show no author and no Edit button] → Intended per the contract; render nothing (or "Unknown author") for `author: null`.
- [Store change `add-login` is not archived, so its specs are not in `references`] → Re-read the store deltas at implementation time in case they change.

## Open Questions

- Display text for ownerless ads (blank vs. "No author"); purely cosmetic.
