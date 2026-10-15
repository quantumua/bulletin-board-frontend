# Tasks

Frontend-only work for store change `add-users-list` (`team-plans`). Requirements: `user-directory` in that change (`openspec show add-users-list --store team-plans`). Backend and contract tasks live elsewhere.

## 1. API client

- [x] 1.1 Add the `ListedUser` type (`id`, `username`, `createdAt`) and `listUsers()` calling `GET /api/users` to `src/api.ts`; verify `api.test.ts` covers the URL, `credentials: 'include'`, no `X-XSRF-TOKEN` header on `GET`, the parsed array, and a `401` surfacing as `ApiError` with status 401

## 2. Users list view

- [x] 2.1 Add `src/UsersList.tsx`: fetch on mount, show loading, an inline error for non-401 failures, and each user's `username` and `toLocaleString()` registration date in the order returned; verify component tests for the rendered rows and order (no client-side sorting), the loading state, and the error state
- [x] 2.2 Call an `onUnauthorized` prop on a `401` and render no user data; verify a component test that a `401` response invokes the callback and shows no usernames

## 3. Tabs and visibility

- [x] 3.1 Add the "Ads" and "Users" tab bar to `src/App.tsx` with tab styles in `src/index.css`, showing "Users" only when logged in and resetting to Ads when the user becomes null; verify App-level tests (stubbed `fetch`) for anonymous (no Users tab), logged in (tab shown, opens the list), and logout (back on Ads, tab gone)
- [x] 3.2 Wire the `401` path: `UsersList` `onUnauthorized` calls `expireSession()`; verify an App-level test that a `401` from `/api/users` returns to the ads view, hides the tab and shows "Your session has ended"
- [x] 3.3 Verify the ads view is unchanged: the existing `auth`, `api` and `permissions` tests still pass, and an App-level test checks the ad list still renders for anonymous visitors

## 4. Docs and checks

- [x] 4.1 Update the README with the Users tab (logged-in only, username and registration date) and note the dependency on the backend `GET /api/users`; verify the `npm test` description lists the new tests
- [x] 4.2 Run `npm test`, `npm run lint` and `npm run build` and verify all pass, then run `openspec validate add-users-list-frontend --strict` and verify it passes
