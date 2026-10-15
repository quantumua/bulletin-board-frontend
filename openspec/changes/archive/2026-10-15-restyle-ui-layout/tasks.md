# Tasks

Frontend-only; no API or contract change. Behavior: `board-ui` in this change's `specs/`. Approach: `design.md`.

## 1. Theme variables and test setup

- [x] 1.1 In `src/index.css`, define the existing palette once as CSS custom properties on `:root` (background, surface, border, text, muted, accent, danger) with identical values, replace every hardcoded hex with them, and merge the duplicated `.ad-card` / `.user-row` card styling; verify `grep -nE "#[0-9a-fA-F]{3,6}" src/index.css` matches only the variable definitions and `npm run build` succeeds
- [x] 1.2 Add a vitest setup file that stubs `HTMLDialogElement.prototype.showModal` and `close` (toggle `open`, fire `close` on close), register it under `test.setupFiles` in `vite.config.ts`, and verify with a small test that `showModal()` sets `open` and `close()` clears it and dispatches `close`

## 2. Dialog component

- [x] 2.1 Add `src/Dialog.tsx` (native `<dialog>` with `open` and `onClose` props, `showModal()`/`close()` guarded by `el.open`, `close` event mapped to `onClose`, backdrop click closes via a padded inner wrapper) and its dialog styles including `::backdrop` in `src/index.css`; verify component tests that opening shows content, Esc/`close` calls `onClose`, a backdrop click calls `onClose`, a click inside the content does not, and children stay mounted while closed

## 3. Header, grid and login dialog

- [x] 3.1 Rework `src/AuthBar.tsx` into the header's session controls ("Signed in as X" + "Log out", "Log in" button, or "Checking session…") and add the header to `src/App.tsx` with the title, Ads/Users tabs (logged-in only) and "+ New ad"; verify App tests for the logged-in header (username, Log out, both tabs, New ad) and the anonymous header (Log in, New ad, no Users tab)
- [x] 3.2 Add the `dialog` state to `App.tsx` (`'new' | 'login' | { editId } | null`, with the render-time corrections from design decision 2) and open `AuthForm` in a `Dialog` from "Log in"; verify tests that "Log in" opens the login/register form, a successful login closes it and shows the signed-in header, and registering keeps it open on login with the "Account created" notice
- [x] 3.3 Render ads as the responsive card grid in a wider container (`repeat(auto-fill, minmax(260px, 1fr))`, header wrapping on narrow screens) and render the grid only on the Ads tab; verify the anonymous test now expects ads visible with no form above them, and replace the "Log in to post an ad." assertion at `src/App.test.tsx:54` accordingly

## 4. New ad and edit dialogs

- [x] 4.1 Put the always-mounted new-ad `AdForm` in a `Dialog` opened by "+ New ad" (logged in), with Cancel closing without resetting; make anonymous "+ New ad" open the login dialog instead; verify tests that the draft survives close and reopen, a successful save closes the dialog, clears the draft and adds the card, a failed save keeps the dialog open with the error, and anonymous "+ New ad" opens login and no new-ad form
- [x] 4.2 Move edit into a `Dialog` that renders `AdForm` only while `{ editId }` is set, keyed by ad id, remove the in-place edit from the card, and close on save; verify tests that "Edit" opens a prefilled form, an unsaved edit is discarded on reopen, saving updates the card, and a new-ad draft is unchanged after editing another ad
- [x] 4.3 Route the `401` write path through the dialogs so an expired session closes any open dialog, shows "Your session has ended" and keeps the new-ad text for after re-login; verify an App test that stubs a `401` on create and then logs in again to find the draft still filled in

## 5. Docs and final checks

- [x] 5.1 Update the README intro and the Login and Users tab sections for the header, dialogs and card grid, and the Test section for the dialog tests; verify the README no longer describes inline login or inline editing
- [x] 5.2 Run `npm test`, `npm run lint` and `npm run build` and verify all pass, then run `openspec validate restyle-ui-layout --strict` and verify it passes
- [x] 5.3 Run `npm run dev` against a stubbed or real backend and check in a browser that Esc and backdrop click close each dialog, focus returns to the opening button, and the grid is one column on a narrow window and several on a wide one
