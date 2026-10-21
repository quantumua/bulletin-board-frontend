import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, getMe, login, logout, signup, type CurrentUser } from '../api'
import CurrentUserProvider, { useCurrentUser } from './CurrentUserContext'

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

function endSession() {
  act(() => {
    for (const listener of [...sessionListeners]) listener()
  })
}

function Consumer() {
  const { user, loading, sessionEnded, sessionVersion, login: logIn, logout: logOut, signup: signUp } =
    useCurrentUser()
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')

  function run(action: () => Promise<void>) {
    action().catch((e: Error) => setError(e.message))
  }

  return (
    <div>
      <p data-testid="status">{loading ? 'loading' : user ? `in:${user.displayName}` : 'out'}</p>
      <p data-testid="session-ended">{String(sessionEnded)}</p>
      <p data-testid="version">{sessionVersion}</p>
      <p data-testid="error">{error}</p>
      <label>
        Draft
        <input value={draft} onChange={(e) => setDraft(e.target.value)} />
      </label>
      <button type="button" onClick={() => run(() => logIn({ email: 'ann@example.com', password: MARKER_PASSWORD }))}>
        log in
      </button>
      <button
        type="button"
        onClick={() => run(() => signUp({ email: 'ann@example.com', displayName: 'Ann', password: MARKER_PASSWORD }))}
      >
        sign up
      </button>
      <button type="button" onClick={() => run(logOut)}>
        log out
      </button>
    </div>
  )
}

function renderWithProvider() {
  return render(
    <CurrentUserProvider>
      <Consumer />
    </CurrentUserProvider>,
  )
}

beforeEach(() => {
  vi.mocked(getMe).mockResolvedValue({ user: null })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.mocked(getMe).mockReset()
  vi.mocked(login).mockReset()
  vi.mocked(signup).mockReset()
  vi.mocked(logout).mockReset()
  sessionListeners.clear()
})

describe('CurrentUserProvider', () => {
  it('asks /auth/me once on mount, before any write, and starts logged out for a visitor', async () => {
    vi.mocked(login).mockResolvedValue(makeUser())
    renderWithProvider()

    expect(screen.getByTestId('status')).toHaveTextContent('loading')
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('out'))
    expect(getMe).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole('button', { name: 'log in' }))
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('in:Ann'))
    expect(vi.mocked(getMe).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(login).mock.invocationCallOrder[0])
    expect(getMe).toHaveBeenCalledTimes(1)
  })

  it('keeps the login after a reload when /auth/me returns a user', async () => {
    vi.mocked(getMe).mockResolvedValue({ user: makeUser({ displayName: 'Bob' }) })
    renderWithProvider()

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('in:Bob'))
    expect(screen.getByTestId('session-ended')).toHaveTextContent('false')
  })

  it('sets the user on log-in and sign-up and bumps the session version', async () => {
    vi.mocked(login).mockResolvedValue(makeUser())
    vi.mocked(signup).mockResolvedValue(makeUser({ displayName: 'Ann B' }))
    renderWithProvider()
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('out'))

    await userEvent.click(screen.getByRole('button', { name: 'log in' }))
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('in:Ann'))
    expect(screen.getByTestId('version')).toHaveTextContent('1')

    await userEvent.click(screen.getByRole('button', { name: 'sign up' }))
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('in:Ann B'))
    expect(screen.getByTestId('version')).toHaveTextContent('2')
  })

  it('clears the user on log-out', async () => {
    vi.mocked(getMe).mockResolvedValue({ user: makeUser() })
    vi.mocked(logout).mockResolvedValue(undefined)
    renderWithProvider()
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('in:Ann'))

    await userEvent.click(screen.getByRole('button', { name: 'log out' }))

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('out'))
    expect(logout).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('version')).toHaveTextContent('1')
  })

  it('leaves the user unchanged and surfaces the error when log-in is refused', async () => {
    vi.mocked(login).mockRejectedValue(
      new ApiError(401, { code: 'bad_credentials', detail: 'Email or password is incorrect' }),
    )
    renderWithProvider()
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('out'))

    await userEvent.click(screen.getByRole('button', { name: 'log in' }))

    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('Email or password is incorrect'))
    expect(screen.getByTestId('status')).toHaveTextContent('out')
    expect(screen.getByTestId('version')).toHaveTextContent('0')
  })

  it('logs the user out on a session-ended signal while typed input survives', async () => {
    vi.mocked(getMe).mockResolvedValue({ user: makeUser() })
    renderWithProvider()
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('in:Ann'))
    await userEvent.type(screen.getByLabelText('Draft'), 'half-written ad')

    endSession()

    expect(screen.getByTestId('status')).toHaveTextContent('out')
    expect(screen.getByTestId('session-ended')).toHaveTextContent('true')
    expect(screen.getByLabelText('Draft')).toHaveValue('half-written ad')
  })

  it('treats a failed /auth/me as logged out without crashing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.mocked(getMe).mockRejectedValue(new ApiError(0, { detail: 'Something went wrong, please try again.' }))
    renderWithProvider()

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('out'))
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0])).not.toContain(MARKER_PASSWORD)
  })

  it('refuses to be used outside its provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Consumer />)).toThrow('useCurrentUser must be used inside <CurrentUserProvider>')
  })
})
