import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { CSRF_EXPIRED_MESSAGE, type Ad, type CurrentUser } from './api'
import App from './App'
import CurrentUserProvider from './auth/CurrentUserContext'

// Build and Test addition (code review): a `csrf_invalid` refusal seen through the real UI.
// Real CurrentUserProvider and ApiClient; only `fetch` is mocked.

function makeAd(overrides: Partial<Ad> = {}): Ad {
  return {
    id: 2,
    title: 'Mine',
    description: 'Almost new',
    createdAt: '2026-10-20T10:00:00Z',
    updatedAt: '2026-10-20T10:00:00Z',
    authorName: 'Ann',
    ownedByMe: true,
    ...overrides,
  }
}

function makeUser(): CurrentUser {
  return { id: 7, email: 'ann@example.com', displayName: 'Ann' }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function csrfProblem(): Response {
  return new Response(
    JSON.stringify({
      status: 403,
      title: 'Forbidden',
      code: 'csrf_invalid',
      detail: 'Invalid or missing anti-forgery token',
    }),
    { status: 403, headers: { 'Content-Type': 'application/problem+json' } },
  )
}

type Handler = (init?: RequestInit) => Response | Promise<Response>

let fetchMock: Mock<typeof fetch>
let handlers: Record<string, Handler>

function callsTo(key: string): RequestInit[] {
  return fetchMock.mock.calls
    .filter(([input, init]) => `${init?.method ?? 'GET'} ${String(input)}` === key)
    .map(([, init]) => init ?? {})
}

function renderBoard() {
  const user = userEvent.setup()
  render(
    <CurrentUserProvider>
      <App />
    </CurrentUserProvider>,
  )
  return user
}

beforeEach(() => {
  document.cookie = 'XSRF-TOKEN=stale-token; path=/'
  handlers = {
    'GET /api/v1/auth/me': () => {
      // The backend issues a fresh token with the refresh
      document.cookie = 'XSRF-TOKEN=fresh-token; path=/'
      return json({ user: makeUser() })
    },
    'GET /api/v1/ads': () => json([makeAd()]),
  }
  fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const key = `${init?.method ?? 'GET'} ${String(input)}`
    const handler = handlers[key]
    if (!handler) throw new Error(`Unexpected request ${key}`)
    return handler(init)
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
})

describe('csrf_invalid in the UI', () => {
  it('shows the token-expired message on Save, keeps the typed text and does not resend', async () => {
    handlers['PUT /api/v1/ads/2'] = () => csrfProblem()
    const user = renderBoard()

    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    const form = screen.getAllByTestId('ad-form').find((f) => within(f).queryByRole('button', { name: 'Save' }))!
    // The page-load /me already rotated the cookie; make the token stale again before saving
    document.cookie = 'XSRF-TOKEN=stale-token; path=/'
    const title = within(form).getByTestId('ad-form-title-input')
    await user.clear(title)
    await user.type(title, 'Mine, now cheaper')
    await user.click(within(form).getByRole('button', { name: 'Save' }))

    expect(await within(form).findByTestId('ad-form-error')).toHaveTextContent(CSRF_EXPIRED_MESSAGE)
    expect(within(form).getByTestId('ad-form-title-input')).toHaveValue('Mine, now cheaper')
    expect(within(form).getByTestId('ad-form-description-input')).toHaveValue('Almost new')
    // Not treated as a lost session: no session-ended notice, the user stays logged in
    expect(screen.queryByTestId('auth-session-ended-alert')).not.toBeInTheDocument()
    expect(screen.getByTestId('auth-logout-button')).toBeInTheDocument()
    // Exactly one PUT (no automatic resend) and one token refresh through /me after it
    expect(callsTo('PUT /api/v1/ads/2')).toHaveLength(1)
    await waitFor(() => expect(callsTo('GET /api/v1/auth/me')).toHaveLength(2))
  })

  it('lets the user retry by hand with the refreshed token', async () => {
    let attempts = 0
    handlers['PUT /api/v1/ads/2'] = () => {
      attempts += 1
      return attempts === 1 ? csrfProblem() : json(makeAd({ title: 'Mine, now cheaper' }))
    }
    const user = renderBoard()

    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    const form = screen.getAllByTestId('ad-form').find((f) => within(f).queryByRole('button', { name: 'Save' }))!
    document.cookie = 'XSRF-TOKEN=stale-token; path=/'
    const title = within(form).getByTestId('ad-form-title-input')
    await user.clear(title)
    await user.type(title, 'Mine, now cheaper')
    await user.click(within(form).getByRole('button', { name: 'Save' }))
    await within(form).findByTestId('ad-form-error')
    await waitFor(() => expect(callsTo('GET /api/v1/auth/me')).toHaveLength(2))

    await user.click(within(form).getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Mine, now cheaper')).toBeInTheDocument()
    const puts = callsTo('PUT /api/v1/ads/2')
    expect(puts).toHaveLength(2)
    expect((puts[0].headers as Record<string, string>)['X-XSRF-TOKEN']).toBe('stale-token')
    expect((puts[1].headers as Record<string, string>)['X-XSRF-TOKEN']).toBe('fresh-token')
  })

  it('keeps the new-ad input after a csrf_invalid refusal on create', async () => {
    handlers['POST /api/v1/ads'] = () => csrfProblem()
    const user = renderBoard()

    const section = await screen.findByTestId('new-ad-section')
    await user.type(within(section).getByTestId('ad-form-title-input'), 'Lamp')
    await user.type(within(section).getByTestId('ad-form-description-input'), 'Works fine')
    await user.click(within(section).getByRole('button', { name: 'Add ad' }))

    expect(await within(section).findByTestId('ad-form-error')).toHaveTextContent(CSRF_EXPIRED_MESSAGE)
    expect(within(section).getByTestId('ad-form-title-input')).toHaveValue('Lamp')
    expect(within(section).getByTestId('ad-form-description-input')).toHaveValue('Works fine')
    expect(callsTo('POST /api/v1/ads')).toHaveLength(1)
  })
})
