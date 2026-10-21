import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { ApiError, GENERIC_ERROR_MESSAGE, SESSION_ENDED_MESSAGE } from '../api'
import { useCurrentUser } from './CurrentUserContext'

type Panel = 'login' | 'signup'

const PANEL_FIELDS: Record<Panel, readonly string[]> = {
  login: ['email', 'password'],
  signup: ['email', 'displayName', 'password'],
}

const PANEL_TEXT: Record<Panel, { title: string; submit: string; busy: string }> = {
  login: { title: 'Log in', submit: 'Log in', busy: 'Logging in…' },
  signup: { title: 'Sign up', submit: 'Sign up', busy: 'Signing up…' },
}

// Splits an error into messages shown next to this panel's fields and one form-level message
function describeError(error: unknown, panel: Panel) {
  if (!(error instanceof ApiError)) return { fieldErrors: {}, formError: GENERIC_ERROR_MESSAGE }
  const fieldErrors: Record<string, string> = {}
  const otherMessages: string[] = []
  for (const [field, message] of Object.entries(error.fieldErrors)) {
    if (PANEL_FIELDS[panel].includes(field)) fieldErrors[field] = message
    else otherMessages.push(message)
  }
  return { fieldErrors, formError: [error.detail, ...otherMessages].join(' ') }
}

export default function AuthPanels() {
  const { user, loading, sessionEnded, login, signup, logout } = useCurrentUser()
  const [panel, setPanel] = useState<Panel | null>(null)
  const [focusOnOpen, setFocusOnOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const pendingRef = useRef(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState<string | null>(null)
  const id = useId()

  // An ended session opens the log-in panel without taking focus from what the user was typing.
  // Adjusted while rendering when the flag changes, not in an effect.
  const [seenSessionEnded, setSeenSessionEnded] = useState(sessionEnded)
  if (seenSessionEnded !== sessionEnded) {
    setSeenSessionEnded(sessionEnded)
    if (sessionEnded) {
      setPanel('login')
      setFocusOnOpen(false)
    }
  }

  function resetFeedback() {
    setFieldErrors({})
    setFormError(null)
    setPassword('')
  }

  function openPanel(next: Panel) {
    resetFeedback()
    setPanel(next)
    setFocusOnOpen(true)
  }

  function closePanel() {
    resetFeedback()
    setPanel(null)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      closePanel()
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    // A ref, not state, so a second click in the same render cannot send a second request
    if (pendingRef.current || panel === null) return
    pendingRef.current = true
    setPending(true)
    setFieldErrors({})
    setFormError(null)
    const submittedPassword = password
    // The password never outlives a submit, whatever the outcome (NFR2.7)
    setPassword('')
    try {
      if (panel === 'login') {
        await login({ email: email.trim(), password: submittedPassword })
      } else {
        await signup({ email: email.trim(), displayName: displayName.trim(), password: submittedPassword })
      }
      setPanel(null)
      setEmail('')
      setDisplayName('')
    } catch (error) {
      // Everything except the password stays in the form
      const described = describeError(error, panel)
      setFieldErrors(described.fieldErrors)
      setFormError(described.formError)
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }

  async function handleLogout() {
    setLoggingOut(true)
    setLogoutError(null)
    try {
      await logout()
    } catch (error) {
      setLogoutError(error instanceof ApiError ? error.detail : GENERIC_ERROR_MESSAGE)
    } finally {
      setLoggingOut(false)
    }
  }

  if (loading) {
    return (
      <div className="auth-bar" data-testid="auth-panels">
        <span className="muted">Checking your session…</span>
      </div>
    )
  }

  if (user) {
    return (
      <div className="auth-bar" data-testid="auth-panels">
        <span data-testid="auth-signed-in">
          Signed in as <strong>{user.displayName}</strong>
        </span>
        <button
          type="button"
          className="secondary"
          onClick={handleLogout}
          disabled={loggingOut}
          data-testid="auth-logout-button"
        >
          {loggingOut ? 'Logging out…' : 'Log out'}
        </button>
        {logoutError && (
          <p role="alert" className="error" data-testid="auth-logout-error">
            {logoutError}
          </p>
        )}
      </div>
    )
  }

  const panelId = `${id}-panel`
  const titleId = `${id}-title`
  const errorId = (field: string) => `${id}-${field}-error`
  const describedBy = (field: string) => (fieldErrors[field] ? errorId(field) : undefined)
  const text = panel ? PANEL_TEXT[panel] : null

  return (
    <div data-testid="auth-panels">
      {sessionEnded && (
        <p role="alert" className="alert" data-testid="auth-session-ended-alert">
          {SESSION_ENDED_MESSAGE}
        </p>
      )}
      <div className="auth-bar">
        <span className="muted">Log in to post or edit your ads.</span>
        <div className="actions">
          <button
            type="button"
            className={panel === 'login' ? undefined : 'secondary'}
            aria-expanded={panel === 'login'}
            aria-controls={panel === 'login' ? panelId : undefined}
            onClick={() => openPanel('login')}
            data-testid="auth-login-open-button"
          >
            Log in
          </button>
          <button
            type="button"
            className={panel === 'signup' ? undefined : 'secondary'}
            aria-expanded={panel === 'signup'}
            aria-controls={panel === 'signup' ? panelId : undefined}
            onClick={() => openPanel('signup')}
            data-testid="auth-signup-open-button"
          >
            Sign up
          </button>
        </div>
      </div>

      {panel && text && (
        <section id={panelId} className="auth-panel" aria-labelledby={titleId} data-testid={`auth-${panel}-panel`}>
          <h2 id={titleId}>{text.title}</h2>
          <form
            className="auth-form"
            onSubmit={handleSubmit}
            onKeyDown={handleKeyDown}
            noValidate
            data-testid="auth-form"
          >
            <div className="field">
              <label htmlFor={`${id}-email`}>Email</label>
              <input
                id={`${id}-email`}
                type="email"
                name="email"
                autoComplete={panel === 'login' ? 'username' : 'email'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={254}
                required
                autoFocus={focusOnOpen}
                aria-invalid={fieldErrors.email ? true : undefined}
                aria-describedby={describedBy('email')}
                data-testid="auth-email-input"
              />
              {fieldErrors.email && (
                <p id={errorId('email')} className="field-error">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            {panel === 'signup' && (
              <div className="field">
                <label htmlFor={`${id}-displayName`}>Display name</label>
                <input
                  id={`${id}-displayName`}
                  type="text"
                  name="displayName"
                  autoComplete="nickname"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={50}
                  required
                  aria-invalid={fieldErrors.displayName ? true : undefined}
                  aria-describedby={describedBy('displayName')}
                  data-testid="auth-display-name-input"
                />
                {fieldErrors.displayName && (
                  <p id={errorId('displayName')} className="field-error">
                    {fieldErrors.displayName}
                  </p>
                )}
              </div>
            )}

            <div className="field">
              <label htmlFor={`${id}-password`}>Password</label>
              <input
                id={`${id}-password`}
                type="password"
                name="password"
                autoComplete={panel === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                maxLength={128}
                required
                aria-invalid={fieldErrors.password ? true : undefined}
                aria-describedby={describedBy('password')}
                data-testid="auth-password-input"
              />
              {fieldErrors.password && (
                <p id={errorId('password')} className="field-error">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {formError && (
              <p role="alert" className="error" data-testid="auth-form-error">
                {formError}
              </p>
            )}

            <div className="actions">
              <button type="submit" disabled={pending} aria-busy={pending} data-testid="auth-submit-button">
                {pending ? text.busy : text.submit}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={closePanel}
                disabled={pending}
                data-testid="auth-cancel-button"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  )
}
