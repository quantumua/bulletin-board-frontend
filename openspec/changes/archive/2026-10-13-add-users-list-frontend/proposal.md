# Proposal

## Why

Logged-in users cannot see who else is on the board. The store change `add-users-list` (`team-plans`) adds `GET /api/users` and a "Users" tab for logged-in users; this change plans only the frontend's part of it.

## What Changes

- Add a tab bar with "Ads" and "Users" above the content; the "Users" tab is shown to logged-in users only.
- Add a users list view that fetches `GET /api/users` and shows each user's `username` and registration date (`createdAt`), in the order the API returns (newest first).
- Handle loading, empty (never empty when logged in, since the caller exists), and error states; a `401` ends the session in the UI and returns to the ads view, as ad writes already do.
- Add `listUsers()` and a `ListedUser` type (`id`, `username`, `createdAt`) to the API client.
- No change to ads, login, register or logout behavior.

## Capabilities

### New Capabilities
None locally. `user-directory` is owned by the `team-plans` store (change `add-users-list`, delta `specs/user-directory`).

### Modified Capabilities
None locally. The contract is cited, not copied; this change sets `skip_specs: true` because no spec is authored in this repo.

## Impact

- **Code:** `src/api.ts` (new call and type), `src/App.tsx` (tab state and navigation), new `src/UsersList.tsx`, `src/index.css` (tab styles), new tests, README.
- **Dependencies:** none; the Vitest and Testing Library setup from `add-login-frontend` is reused.
- **Depends on:** the backend change `add-users-list-backend` for end-to-end use. Tests stub `fetch`, so frontend work does not wait for it.
- **Out of scope:** the backend work, contract edits, pagination, search, profiles, store tasks 1.x and 3.x.
