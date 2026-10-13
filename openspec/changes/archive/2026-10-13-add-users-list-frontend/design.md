# Design

## Context

Observed: `App.tsx` is a single view (new-ad form plus ad list) under `AuthBar`. Auth state comes from `AuthProvider` (`user`, `sessionExpired`, `expireSession`), and `api.ts` wraps `fetch` with `credentials: 'include'`, a CSRF header on `POST`/`PUT`, and `ApiError` carrying the HTTP status. A write that gets `401` already calls `expireSession()`. There is no router and no navigation. Vitest, jsdom and Testing Library are set up (`api.test.ts`, `auth.test.tsx`, `permissions.test.ts`); `fetch` is stubbed, and no component tests exist yet.

Requirements come from the store spec `user-directory` (change `add-users-list`, read with `openspec show add-users-list --store team-plans`); they are not restated here. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- A "Users" tab, visible only when logged in, listing username and registration date in API order.
- The UI never shows the tab or user data to an anonymous visitor, including after a session expires.

**Non-Goals:**
- A router, deep links to a tab, pagination, search, sorting or user profiles.
- Changing the existing ads view or auth flows.

## Decisions

**Tab as local state in `App`, no router.** A `tab: 'ads' | 'users'` state with two buttons. The store design says no router is required; a router would add a dependency and URL handling for one extra view. The effective view is the ads view whenever `user` is null, and the tab state resets to `'ads'` when the user becomes null (logout or expired session), so logging in again starts on Ads.

**Dedicated `UsersList` component that owns its fetch.** It calls `listUsers()` when mounted, so each visit to the tab reloads the list and new registrations show up without a manual refresh. It takes an `onUnauthorized` callback; on `401` `App` calls `expireSession()`, which hides the tab and shows the existing "Your session has ended" message. Other failures show an inline error and keep the tab. Alternative: fetch in `App` and pass the data down; rejected because it would load users for people who never open the tab.

**Separate `ListedUser` type, not `User`.** `User` is the login identity (`id`, `username`) used by auth state; the directory entry adds `createdAt`. Keeping them apart avoids making `createdAt` look present on `/api/auth/me` responses.

**Render in API order.** The contract guarantees newest first, so the client does not re-sort. A test pins this by feeding an unsorted-looking array and asserting the rendered order matches it.

**Date display like ads.** `new Date(createdAt).toLocaleString()`, matching how ads show `updatedAt`, so the two views look consistent.

**Tests use the existing `fetch` stub approach.** `listUsers` is covered in `api.test.ts` (URL, credentials, no CSRF header on `GET`, `401` becomes `ApiError`); `UsersList` and the tab behavior get component tests with Testing Library. Vitest globals are not enabled, so component tests call `cleanup` in `afterEach`.

## Risks / Trade-offs

- [The backend endpoint may not exist yet when this is built] → Tests stub `fetch`; the end-to-end check is the store's integration task 3.1 once both repos are done.
- [Any logged-in user sees all usernames] → Accepted in the store design; the frontend only hides the tab from anonymous visitors, and the backend enforces access.
- [Tab state is lost on reload] → Acceptable without a router; the app starts on Ads.
- [A stale list if users register while the tab stays open] → Reloaded on every visit to the tab; no polling.

## Clarifications

No contract gaps found while planning; none to record in the store.
