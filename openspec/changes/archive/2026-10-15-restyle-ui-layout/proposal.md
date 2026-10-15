# Proposal

## Why

The UI is a single 720px column where the "New ad" form (or, for anonymous visitors, the login form) sits above the ads, so every visit scrolls past a form to reach the board. Session info, tabs and actions are separate stacked blocks rather than one header, and the card styling is duplicated with hardcoded colors. A header-and-grid layout fixes the first screen and fits the bulletin-board metaphor.

## What Changes

- Add an app header holding the title, the Ads / Users tabs (logged-in only), a "+ New ad" button, and either "Signed in as X" with "Log out" or a "Log in" button.
- Replace the stacked ad list with a responsive card grid (`repeat(auto-fill, minmax(~260px, 1fr))`) in a container wider than 720px; it collapses to one column on narrow screens. The Users tab keeps its list.
- Move the "New ad" form into a native `<dialog>`. Closing the dialog keeps the typed draft; saving an ad clears it, as today.
- Move editing into the same dialog: "Edit" opens it with that ad prefilled in a fresh form; closing discards unsaved edits. Ads are no longer edited in place.
- Move login and registration into a dialog opened from the header's "Log in". The existing `AuthForm` (login/register toggle, errors, "Account created" notice) is reused unchanged.
- Show "+ New ad" to anonymous visitors; it opens the login dialog. The "Log in to post an ad." line goes away.
- Add one shared dialog wrapper component so Esc, backdrop click, focus handling and close behavior live in a single place.
- Move hardcoded colors in `src/index.css` into CSS custom properties, keeping the current palette. No intended visual change to colors.
- No change to the API client, ad permissions, session handling, or the Users tab data flow.

## Capabilities

### New Capabilities
- `board-ui`: how the bulletin board presents itself: header contents, the ad card grid, and which dialog hosts new-ad, edit and login, including draft behavior and what anonymous visitors see.

### Modified Capabilities
None. This repo has no local specs yet, and the `team-plans` store specs (`ads-api`, `user-auth`, `user-directory`) define only the HTTP contract, which does not change.

## Impact

- **Code:** `src/App.tsx` (header, grid, dialog state), new shared dialog component, `src/AuthBar.tsx` (becomes header session controls), `src/AdForm.tsx` (cancel and close wiring only), `src/index.css` (variables, header, grid, dialog styles), README.
- **Tests:** `src/App.test.tsx` (the "Log in to post an ad." assertion at line 54 changes; new tests for dialogs, drafts, anonymous "+ New ad"); `src/auth.test.tsx` and the API tests should be unaffected. jsdom only partly implements `<dialog>`, so tests may need a `showModal` / `close` stub.
- **Dependencies:** none.
- **Not store-driven:** there is no `team-plans` change for this, so the `<store-change>-frontend` naming and "cite the store spec" convention do not apply; the contract is untouched.
- **Out of scope:** new palette, dark mode, a UI library, animations, pagination or search, and any backend or contract change.
