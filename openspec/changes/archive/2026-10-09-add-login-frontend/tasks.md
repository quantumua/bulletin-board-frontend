# Tasks

## 1. Test setup

- [x] 1.1 Add Vitest (and `jsdom` plus `@testing-library/react` only if a component test is written) as devDependencies, add a `test` script to `package.json`, and verify `npm test` runs a trivial passing test
- [x] 1.2 Include the test files in the TypeScript config if needed and verify `npm run build` and `npm run lint` still pass

## 2. API client

- [x] 2.1 Add `author: string | null` to `Ad`, add a `User` type, and share the base URL constant between ad and auth endpoints; verify `npm run build` passes
- [x] 2.2 In `request()`, send `credentials: "include"`, handle `204` without parsing a body, and throw an `ApiError` carrying `status` and the problem `detail`; verify with unit tests using a stubbed `fetch`
- [x] 2.3 Read the `XSRF-TOKEN` cookie per call and send it as `X-XSRF-TOKEN` on `POST`/`PUT`, except `/api/auth/login` and `/api/auth/register`; verify unit tests cover header present, header omitted for login/register, and omitted for `GET`
- [x] 2.4 Add `getMe`, `login`, `register` and `logout` calling `/api/auth/me`, `/login`, `/register` and `/logout`; verify unit tests cover each URL, method and body, and that `getMe` surfaces a `401` as `ApiError` with `status === 401`

## 3. Auth state and UI

- [x] 3.1 Add an `AuthProvider`/`useAuth` that calls `getMe` on mount (a `401` means anonymous) and exposes `user`, `loading`, `login`, `register`, `logout`; verify with a test that `401` yields `user === null` and a `200` yields the user
- [x] 3.2 Add a login/register form component showing API problem details (`401`, `409`, `400`), switching to login with the username prefilled after a successful register; verify manually against the running backend for a taken username and a wrong password
- [x] 3.3 Add a header showing "Signed in as <username>" with a Logout button, or the auth form when anonymous, and style it in `src/index.css`; verify logout returns the page to the anonymous state

## 4. Ad controls

- [x] 4.1 Show the "New ad" form only when logged in, with a prompt to log in otherwise; verify manually that an anonymous visitor still sees the ad list
- [x] 4.2 Display `author` on each ad card and show Edit only when `ad.author` equals the current username (never for `null`); verify with a unit test of the visibility rule covering owner, other user, anonymous and ownerless ads
- [x] 4.3 On a `401` from create or update, reset to anonymous and show a "please log in again" message; verify the form text is kept and the message appears when the session cookie is cleared in devtools

## 5. Integration and docs

- [x] 5.1 Verify cookies work through the Vite proxy; if `vite.config.ts` needs changes (for example cookie handling), make them and verify register, login, create, edit and logout against the running backend
- [x] 5.2 Walk through store tasks 3.1 and 3.2 in the browser (anonymous read, second user cannot edit, CSRF behavior) with both apps running, and note any contract gap to add to the store design's Clarifications by pull request
- [x] 5.3 Document the login flow, the `npm test` command and the `VITE_API_BASE_URL` cross-origin requirement in `README.md`, and verify the documented commands run as written
