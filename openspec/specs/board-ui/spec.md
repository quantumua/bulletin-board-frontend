# board-ui Specification

## Purpose

Defines how the bulletin board frontend presents itself: the header, the ad card grid, and the modal dialogs that host creating, editing and logging in. It covers what each kind of visitor sees and how unsaved text is treated.

## Requirements

### Requirement: Header with session controls
The page SHALL show a header above the content containing the board title, a "+ New ad" button, and the session controls. A logged-in user SHALL see "Signed in as <username>" with a "Log out" button and the Ads and Users tabs; an anonymous visitor SHALL see a "Log in" button and no tabs.

#### Scenario: Logged-in header
- **WHEN** a logged-in user opens the board
- **THEN** the header shows their username, "Log out", the "Ads" and "Users" tabs, and "+ New ad"

#### Scenario: Anonymous header
- **WHEN** an anonymous visitor opens the board
- **THEN** the header shows "Log in" and "+ New ad", and no Users tab

### Requirement: Ads shown as a responsive card grid
The ads view SHALL list ads as cards in a grid that fits as many columns as the available width allows and collapses to a single column on narrow screens. Each card SHALL show the title, description, author when known, the updated time, and an "Edit" button only where the user may edit the ad.

#### Scenario: Wide screen
- **WHEN** the viewport is wide enough for several cards
- **THEN** ads appear side by side in multiple columns

#### Scenario: Narrow screen
- **WHEN** the viewport is narrower than one card plus margins allows for two columns
- **THEN** ads appear in a single column

#### Scenario: Anonymous visitors see the board first
- **WHEN** an anonymous visitor opens the board
- **THEN** the ad cards are shown immediately, with no form above them

### Requirement: New ad created in a dialog that keeps its draft
Activating "+ New ad" as a logged-in user SHALL open a modal dialog containing the new-ad form. Closing the dialog without saving (Cancel, Esc, or backdrop click) SHALL keep the typed title and description for the next time it opens; a successful save SHALL close the dialog and clear the draft.

#### Scenario: Draft survives closing
- **WHEN** a logged-in user types a title, closes the new-ad dialog without saving, and opens it again
- **THEN** the title and description are still filled in

#### Scenario: Saving clears the draft
- **WHEN** a logged-in user saves a new ad
- **THEN** the dialog closes, the ad appears in the grid, and reopening the dialog shows an empty form

#### Scenario: Failed save keeps the dialog open
- **WHEN** saving a new ad fails with an error other than an expired session
- **THEN** the dialog stays open with the typed text and shows the error

### Requirement: Editing in a dialog that discards on close
Activating "Edit" on an ad SHALL open the same kind of modal dialog with a form prefilled from that ad. Closing it without saving SHALL discard any changes, so reopening shows the ad's stored values. A successful save SHALL close the dialog and update the card in place.

#### Scenario: Edit prefilled
- **WHEN** the owner of an ad activates "Edit"
- **THEN** a dialog opens with that ad's title and description filled in

#### Scenario: Unsaved edit discarded
- **WHEN** the owner changes the title, closes the dialog without saving, and opens "Edit" again
- **THEN** the form shows the ad's stored title

#### Scenario: Edit does not disturb the new-ad draft
- **WHEN** a draft exists in the new-ad dialog and the user edits and saves another ad
- **THEN** the new-ad draft is unchanged

### Requirement: Login and registration in a dialog
Activating "Log in" SHALL open a modal dialog with the login form, which can switch to registration, shows errors, and shows the account-created notice after registering. A successful login SHALL close the dialog.

#### Scenario: Log in from the header
- **WHEN** an anonymous visitor activates "Log in" and submits valid credentials
- **THEN** the dialog closes and the header shows the signed-in state

#### Scenario: Register then log in
- **WHEN** a visitor registers from the dialog
- **THEN** the dialog stays open on the login form with the "Account created" notice

### Requirement: "+ New ad" for anonymous visitors opens login
When an anonymous visitor activates "+ New ad", the system SHALL open the login dialog instead of the new-ad form, and SHALL NOT open the new-ad form until the visitor is logged in.

#### Scenario: Anonymous clicks New ad
- **WHEN** an anonymous visitor activates "+ New ad"
- **THEN** the login dialog opens and no new-ad form is shown

### Requirement: Expired session while a dialog is open
When a save fails because the session has expired, the system SHALL close any open dialog, return to the anonymous view with the "Your session has ended" message, and keep the unsaved new-ad text so it is available after logging in again.

#### Scenario: Session expires during new ad
- **WHEN** a logged-in user saves a new ad and the server reports the session has expired
- **THEN** the dialog closes, the session-ended message is shown, and after logging in again the new-ad dialog still holds the typed text

### Requirement: Dialog dismissal and focus
Every dialog SHALL be dismissible with the Esc key and a click on its backdrop, SHALL keep keyboard focus inside while open, and SHALL return focus to the control that opened it when closed.

#### Scenario: Esc closes
- **WHEN** a dialog is open and the user presses Esc
- **THEN** the dialog closes and focus returns to the button that opened it

### Requirement: Visual theme unchanged
The restyle SHALL keep the existing color palette. Colors SHALL be defined once as named theme values rather than repeated literals.

#### Scenario: Palette preserved
- **WHEN** the redesigned board is compared with the current one
- **THEN** buttons, borders, text, errors and backgrounds use the same colors as before
