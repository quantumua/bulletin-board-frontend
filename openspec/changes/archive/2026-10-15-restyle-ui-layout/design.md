# Design

## Context

See proposal.md for motivation and specs/board-ui for the required behavior. Today `App.tsx` owns everything: ads, `editingId`, tab, and layout. It keeps the new-ad form mounted but `hidden` so a draft survives tab switches and an expired session (`App.tsx:65-78`). The edit form replaces the card in place, `AuthBar` renders `AuthForm` inline when anonymous, and `index.css` uses hardcoded hex values with element selectors. Tests render `App` inside `AuthProvider` with `fetch` stubbed and query by role and text; vitest runs under jsdom (`vite.config.ts`). No API client, permission or auth-context code changes.

## Goals / Non-Goals

**Goals:**
- One dialog mechanism reused by new ad, edit and login.
- Drafts keep the guarantees `App.tsx` gives today (survive close, tab switch, session expiry) without the `hidden` wrappers.
- Existing tests keep passing except the one asserting the removed copy.

**Non-Goals:**
- Splitting `App.tsx` into routes or adding a state library.
- Animations, a new palette, or any CSS tooling.

## Decisions

**1. Native `<dialog>` in a small `Dialog` component.** It takes `open` and `onClose`, calls `showModal()` / `close()` from an effect (guarded by `el.open` so a re-render never throws `InvalidStateError`), and maps the dialog's `close` event back to `onClose`, which covers Esc. A click whose target is the `<dialog>` itself (inner content sits in a padded wrapper) closes it as a backdrop click. The browser supplies the focus trap and returns focus to the opener on close, which satisfies the focus requirement. Alternative: a hand-rolled overlay with ARIA and focus code, rejected as more code to get wrong; a library is excluded by the proposal.

**2. One `dialog` state in `App`: `'new' | 'login' | { editId } | null`.** Only one dialog is ever open, which makes "edit does not disturb the new-ad draft" and "one dialog at a time" structural rather than tested-for. Header "+ New ad" sets `user ? 'new' : 'login'`. Like the existing `if (!user && tab !== 'ads') setTab('ads')`, state is corrected during render: no user closes `'new'` and edit; a user closes `'login'`. This also implements "session expired closes any open dialog" with no extra effect.

**3. Draft lifetime comes from what stays mounted.** A closed `<dialog>` keeps its children in the DOM, so the new-ad `AdForm` is rendered once, always, inside its dialog and keeps its own state; Cancel/Esc/backdrop only toggle `dialog` and never reset the form. `AdForm` already clears itself after a successful create. Edit renders `AdForm` only while `{ editId }` is set, keyed by ad id, so every open is a fresh form seeded from the ad and close discards it. The always-mounted new-ad form replaces today's `hidden` section, so a draft also survives an expired session and re-login. The Users tab no longer needs the ads area hidden, so the grid renders only on the Ads tab.

**4. Login moves to the header and a dialog; `AuthForm` is untouched.** `AuthBar` becomes the header's session controls ("Signed in as X" + "Log out", or "Log in", or the existing "Checking session…" text). `AuthForm` renders inside the login dialog only while it is open, so a half-typed password does not linger after close. Closing on success follows from decision 2.

**5. Theme via CSS custom properties in `:root`, grid via `auto-fill`.** The existing hexes become named variables (background, surface, border, text, muted, accent, danger) with identical values. Shared card styling for `.ad-card` and `.user-row` is merged. The grid is `repeat(auto-fill, minmax(260px, 1fr))` in a container capped around 1100px, so there are no media queries. Alternative: media-query breakpoints, rejected as unnecessary.

**6. jsdom `<dialog>` stub in a shared test setup.** jsdom does not implement `showModal()`/`close()`, so a setup file (registered under `test.setupFiles`) defines them to toggle `open` and fire `close`. It is the only config change. Tests then assert through roles (`dialog`, buttons) as they do now. Alternative: a stub inside each test file, rejected as duplication.

## Risks / Trade-offs

- [jsdom stub drifts from real browser dialog behavior (focus return, Esc, backdrop)] → Unit tests cover state and drafts; run the app in a browser once at the end for Esc, backdrop click and focus return.
- [Render-time state correction for `dialog` could loop or warn] → Mirror the guarded pattern already used for `tab`, and only set when the value actually changes.
- [Always-mounted new-ad form means closed-dialog content stays in the DOM and accessibility tree] → A closed `<dialog>` is not rendered and not exposed, so this is acceptable.
- [Edit no longer inline, so edit-in-progress is lost on accidental backdrop click] → Accepted by the user: unsaved edits are discarded on close.
- [Header gets crowded on narrow screens] → Let the header wrap (flex-wrap); no hamburger menu.

## Migration Plan

Frontend-only; no data or API migration. Ships as one deploy, and rollback is reverting the commit.
