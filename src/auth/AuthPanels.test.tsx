import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, getMe, login, logout, signup, type CurrentUser } from '../api'
import AuthPanels from './AuthPanels'
import CurrentUserProvider from './CurrentUserContext'

const sessionListeners = vi.hoisted(() => new Set<() => void>())

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>()
  return {
    ...actual,
    getMe: vi.fn(),
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
    onSessionEnded: vi.fn((listener: () => void) => {
      sessionListeners.add(listener)
      return () => {
        sessionListeners.delete(listener)
      }
    }),
  }
})

const MARKER_PASSWORD = 'Marker-P4ss-123'

function makeUser(overrides: Partial<CurrentUser> = {}): CurrentUser {
  return { id: 7, email: 'ann@example.com', displayName: 'Ann', ...overrides }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

async function renderPanels() {
  const user = userEvent.setup()
  render(
    <CurrentUserProvider>
      <AuthPanels />
    </CurrentUserProvider>,
  )
  await waitFor(() => expect(screen.queryByText('Checking your session…')).not.toBeInTheDocument())
  return user
}

async function openSignup(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId('auth-signup-open-button'))
  return screen.getByTestId('auth-signup-panel')
}

async function openLogin(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId('auth-login-open-button'))
  return screen.getByTestId('auth-login-panel')
}

beforeEach(() => {
  vi.mocked(getMe).mockResolvedValue({ user: null })
})

afterEach(() => {
  vi.mocked(getMe).mockReset()
  vi.mocked(login).mockReset()
  vi.mocked(signup).mockReset()
  vi.mocked(logout).mockReset()
  sessionListeners.clear()
})

describe('AuthPanels sign-up', () => {
  it('completes sign-up with the keyboard alone and shows the signed-in name', async () => {
    vi.mocked(signup).mockResolvedValue(makeUser())
    const user = await renderPanels()

    await user.tab()
    expect(screen.getByTestId('auth-login-open-button')).toHaveFocus()
    await user.tab()
    expect(screen.getByTestId('auth-signup-open-button')).toHaveFocus()
    await user.keyboard('{Enter}')

    const panel = screen.getByTestId('auth-signup-panel')
    expect(within(panel).getByLabelText('Email')).toHaveFocus()
    await user.keyboard('ann@example.com')
    await user.tab()
    expect(within(panel).getByLabelText('Display name')).toHaveFocus()
    await user.keyboard('Ann')
    await user.tab()
    expect(within(panel).getByLabelText('Password')).toHaveFocus()
    await user.keyboard(`${MARKER_PASSWORD}{Enter}`)

    await waitFor(() => expect(screen.getByTestId('auth-signed-in')).toHaveTextContent('Signed in as Ann'))
    expect(signup).toHaveBeenCalledWith({ email: 'ann@example.com', displayName: 'Ann', password: MARKER_PASSWORD })
    expect(screen.queryByTestId('auth-signup-panel')).not.toBeInTheDocument()
  })

  it('shows email_taken and keeps email and name while clearing the password', async () => {
    vi.mocked(signup).mockRejectedValue(new ApiError(409, { code: 'email_taken', detail: 'Email already registered' }))
    const user = await renderPanels()
    const panel = await openSignup(user)

    await user.type(within(panel).getByLabelText('Email'), 'Ann@Example.com')
    await user.type(within(panel).getByLabelText('Display name'), 'Ann')
    await user.type(within(panel).getByLabelText('Password'), MARKER_PASSWORD)
    await user.click(screen.getByTestId('auth-submit-button'))

    expect(await screen.findByRole('alert')).toHaveTextContent('Email already registered')
    expect(within(panel).getByLabelText('Email')).toHaveValue('Ann@Example.com')
    expect(within(panel).getByLabelText('Display name')).toHaveValue('Ann')
    expect(within(panel).getByLabelText('Password')).toHaveValue('')
    expect(signup).toHaveBeenCalledWith({ email: 'Ann@Example.com', displayName: 'Ann', password: MARKER_PASSWORD })
  })

  it('links validation messages to their fields with aria-describedby', async () => {
    vi.mocked(signup).mockRejectedValue(
      new ApiError(400, {
        code: 'validation_failed',
        detail: 'One or more fields are invalid',
        fieldErrors: { password: 'must be at least 8 characters', displayName: 'must not be blank' },
      }),
    )
    const user = await renderPanels()
    const panel = await openSignup(user)

    await user.type(within(panel).getByLabelText('Email'), 'ann@example.com')
    await user.type(within(panel).getByLabelText('Display name'), '   ')
    await user.type(within(panel).getByLabelText('Password'), 'short12')
    await user.click(screen.getByTestId('auth-submit-button'))

    const password = await within(panel).findByLabelText('Password')
    await waitFor(() => expect(password).toHaveAccessibleDescription('must be at least 8 characters'))
    expect(password).toHaveAttribute('aria-invalid', 'true')
    expect(within(panel).getByLabelText('Display name')).toHaveAccessibleDescription('must not be blank')
    expect(within(panel).getByLabelText('Email')).not.toHaveAttribute('aria-describedby')
    expect(screen.getByRole('alert')).toHaveTextContent('One or more fields are invalid')
  })
})

describe('AuthPanels log-in', () => {
  it('logs in with labelled fields and Enter, then shows the display name', async () => {
    vi.mocked(login).mockResolvedValue(makeUser({ displayName: 'Ann' }))
    const user = await renderPanels()
    const panel = await openLogin(user)

    const email = within(panel).getByLabelText('Email')
    const password = within(panel).getByLabelText('Password')
    expect(email).toHaveAttribute('type', 'email')
    expect(email).toHaveAttribute('autocomplete', 'username')
    expect(password).toHaveAttribute('type', 'password')
    expect(password).toHaveAttribute('autocomplete', 'current-password')

    await user.type(email, 'ann@example.com')
    await user.type(password, `${MARKER_PASSWORD}{Enter}`)

    await waitFor(() => expect(screen.getByTestId('auth-signed-in')).toHaveTextContent('Signed in as Ann'))
    expect(login).toHaveBeenCalledWith({ email: 'ann@example.com', password: MARKER_PASSWORD })
  })

  it('shows bad_credentials in an alert and clears the password', async () => {
    vi.mocked(login).mockRejectedValue(
      new ApiError(401, { code: 'bad_credentials', detail: 'Email or password is incorrect' }),
    )
    const user = await renderPanels()
    const panel = await openLogin(user)

    await user.type(within(panel).getByLabelText('Email'), 'nobody@example.com')
    await user.type(within(panel).getByLabelText('Password'), `${MARKER_PASSWORD}{Enter}`)

    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect')
    expect(within(panel).getByLabelText('Password')).toHaveValue('')
    expect(within(panel).getByLabelText('Email')).toHaveValue('nobody@example.com')
    expect(screen.queryByTestId('auth-signed-in')).not.toBeInTheDocument()
  })

  it('shows the account_locked message', async () => {
    vi.mocked(login).mockRejectedValue(
      new ApiError(423, { code: 'account_locked', detail: 'Account temporarily locked. Try again in 15 minutes.' }),
    )
    const user = await renderPanels()
    const panel = await openLogin(user)

    await user.type(within(panel).getByLabelText('Email'), 'ann@example.com')
    await user.type(within(panel).getByLabelText('Password'), `${MARKER_PASSWORD}{Enter}`)

    expect(await screen.findByRole('alert')).toHaveTextContent('Account temporarily locked')
  })

  it('sends one request when submit is clicked twice while pending', async () => {
    const pending = deferred<CurrentUser>()
    vi.mocked(login).mockReturnValue(pending.promise)
    const user = await renderPanels()
    const panel = await openLogin(user)
    await user.type(within(panel).getByLabelText('Email'), 'ann@example.com')
    await user.type(within(panel).getByLabelText('Password'), MARKER_PASSWORD)

    const submit = screen.getByTestId('auth-submit-button')
    await user.click(submit)
    await user.click(submit)

    expect(submit).toBeDisabled()
    expect(submit).toHaveTextContent('Logging in…')
    expect(login).toHaveBeenCalledTimes(1)

    await act(async () => pending.resolve(makeUser()))
    await waitFor(() => expect(screen.getByTestId('auth-signed-in')).toBeInTheDocument())
  })

  it('closes the panel with Escape and with Cancel', async () => {
    const user = await renderPanels()
    const panel = await openLogin(user)

    await user.type(within(panel).getByLabelText('Email'), '{Escape}')
    expect(screen.queryByTestId('auth-login-panel')).not.toBeInTheDocument()

    await openLogin(user)
    await user.click(screen.getByTestId('auth-cancel-button'))
    expect(screen.queryByTestId('auth-login-panel')).not.toBeInTheDocument()
  })
})

describe('AuthPanels session', () => {
  it('logs out back to the logged-out view', async () => {
    vi.mocked(getMe).mockResolvedValue({ user: makeUser() })
    vi.mocked(logout).mockResolvedValue(undefined)
    const user = await renderPanels()
    expect(screen.getByTestId('auth-signed-in')).toHaveTextContent('Signed in as Ann')

    await user.click(screen.getByTestId('auth-logout-button'))

    await waitFor(() => expect(screen.getByTestId('auth-login-open-button')).toBeInTheDocument())
    expect(screen.queryByTestId('auth-signed-in')).not.toBeInTheDocument()
    expect(logout).toHaveBeenCalledTimes(1)
  })

  it('opens the log-in panel with an alert when the session ends', async () => {
    vi.mocked(getMe).mockResolvedValue({ user: makeUser() })
    await renderPanels()

    act(() => {
      for (const listener of [...sessionListeners]) listener()
    })

    expect(screen.getByTestId('auth-session-ended-alert')).toHaveTextContent('Your session ended. Please log in again.')
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByTestId('auth-login-panel')).toBeInTheDocument()
    expect(screen.getByTestId('auth-login-open-button')).toHaveAttribute('aria-expanded', 'true')
  })

  it('renders a display name containing markup as literal text', async () => {
    const markup = '<img src=x onerror=alert(1)>'
    vi.mocked(getMe).mockResolvedValue({ user: makeUser({ displayName: markup }) })
    await renderPanels()

    expect(screen.getByTestId('auth-signed-in')).toHaveTextContent(`Signed in as ${markup}`)
    expect(document.querySelector('img')).toBeNull()
  })

  it('shows the generic message when log-in fails for an unexpected reason', async () => {
    vi.mocked(login).mockRejectedValue(new Error('boom'))
    const user = await renderPanels()
    const panel = await openLogin(user)

    await user.type(within(panel).getByLabelText('Email'), 'ann@example.com')
    await user.type(within(panel).getByLabelText('Password'), `${MARKER_PASSWORD}{Enter}`)

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong, please try again.')
  })
})
